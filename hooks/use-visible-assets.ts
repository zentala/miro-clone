"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chooseAssetVariantWidth } from "@/types/asset";

const MAX_ACTIVE_REQUESTS = 8;
const PREVIEW_WIDTH = 48;
type Job = { url: string; signal: AbortSignal; resolve: (blob: Blob) => void; reject: (error: unknown) => void; onAbort: () => void };
const pending: Job[] = [];
let active = 0;

function pump() {
    while (active < MAX_ACTIVE_REQUESTS && pending.length) {
        const job = pending.shift()!;
        job.signal.removeEventListener("abort", job.onAbort);
        if (job.signal.aborted) { job.reject(new DOMException("Aborted", "AbortError")); continue; }
        active++;
        fetch(job.url, { signal: job.signal, cache: "force-cache" })
            .then(response => {
                if (!response.ok) throw new Error(`Image request failed (${response.status})`);
                return response.blob();
            })
            .then(job.resolve, job.reject)
            .finally(() => { active--; pump(); });
    }
}

function boundedFetch(url: string, signal: AbortSignal) {
    return new Promise<Blob>((resolve, reject) => {
        const job: Job = { url, signal, resolve, reject, onAbort: () => {
            const index = pending.indexOf(job);
            if (index >= 0) pending.splice(index, 1);
            reject(new DOMException("Aborted", "AbortError"));
        } };
        signal.addEventListener("abort", job.onAbort, { once: true });
        pending.push(job);
        pump();
    });
}

/** Observe one SVG image in screen space and fetch only its current resolution. */
export function useVisibleAssets(assetId: string, cameraZoom: number) {
    const [node, setNode] = useState<SVGRectElement | null>(null);
    const [visible, setVisible] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [variant, setVariant] = useState<string | null>(null);
    const [requestedWidth, setRequestedWidth] = useState(PREVIEW_WIDTH);
    const previewRef = useRef<{ assetId: string; url: string; mediaType: string } | null>(null);
    const ref = useCallback((element: SVGRectElement | null) => setNode(element), []);

    useEffect(() => {
        if (!node || typeof IntersectionObserver === "undefined") { setVisible(Boolean(node)); return; }
        const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
        observer.observe(node);
        return () => observer.disconnect();
    }, [cameraZoom, node]);

    useEffect(() => {
        if (!node) return;
        let frame = 0;
        const measure = () => {
            frame = 0;
            const bounds = node.getBoundingClientRect();
            if (bounds.width <= 0) return;
            const width = chooseAssetVariantWidth(bounds.width, window.devicePixelRatio || 1);
            setRequestedWidth(current => current === width ? current : width);
        };
        const scheduleMeasure = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };
        const camera = node.closest("[data-board-camera]");
        const mutations = new MutationObserver(scheduleMeasure);
        if (camera) mutations.observe(camera, { attributes: true, attributeFilter: ["transform"] });
        const resize = new ResizeObserver(scheduleMeasure);
        resize.observe(node);
        window.addEventListener("resize", scheduleMeasure);
        scheduleMeasure();
        return () => {
            if (frame) cancelAnimationFrame(frame);
            mutations.disconnect();
            resize.disconnect();
            window.removeEventListener("resize", scheduleMeasure);
        };
    }, [node]);

    useEffect(() => {
        if (!visible) return;
        const controller = new AbortController();
        let live = true;
        let variantUrl: string | null = null;
        const load = async () => {
            try {
                if (requestedWidth <= PREVIEW_WIDTH) setVariant(null);
                if (previewRef.current?.assetId !== assetId) {
                    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
                    previewRef.current = null;
                    setPreview(null);
                    setVariant(null);
                    const previewBlob = await boundedFetch(`/api/assets/${assetId}?width=${PREVIEW_WIDTH}`, controller.signal);
                    if (!live) return;
                    const url = URL.createObjectURL(previewBlob);
                    previewRef.current = { assetId, url, mediaType: previewBlob.type };
                    setPreview(url);
                }
                if (requestedWidth > PREVIEW_WIDTH && previewRef.current?.mediaType !== "image/gif") {
                    const variantBlob = await boundedFetch(`/api/assets/${assetId}?width=${requestedWidth}`, controller.signal);
                    if (!live) return;
                    variantUrl = URL.createObjectURL(variantBlob);
                    setVariant(variantUrl);
                } else setVariant(null);
            } catch (error) {
                if ((error as Error).name !== "AbortError") console.error("Unable to load board image", error);
            }
        };
        void load();
        return () => {
            live = false;
            controller.abort();
            if (variantUrl) URL.revokeObjectURL(variantUrl);
        };
    }, [assetId, requestedWidth, visible]);

    useEffect(() => {
        if (!visible) {
            if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
            previewRef.current = null;
            setPreview(null);
            setVariant(null);
        }
    }, [visible]);

    useEffect(() => () => {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    }, []);

    return { ref, href: variant ?? preview };
}
