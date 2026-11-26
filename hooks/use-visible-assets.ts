"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";
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
    const currentVariantRef = useRef<string | null>(null);
    const ownedUrlsRef = useRef(new Set<string>());
    const retiredUrlsRef = useRef(new Set<string>());
    const replacementUrlsRef = useRef(new Map<string, string>());
    const loadedUrlsRef = useRef(new Set<string>());
    const imageElementRef = useRef<SVGImageElement | null>(null);
    const renderedHrefRef = useRef<string | null>(null);
    const ref = useCallback((element: SVGRectElement | null) => setNode(element), []);

    const collectRetiredUrls = useCallback(() => {
        retiredUrlsRef.current.forEach(url => {
            if (imageElementRef.current && renderedHrefRef.current === url) return;
            const replacement = replacementUrlsRef.current.get(url);
            const replacementIsRendered = replacement !== undefined && renderedHrefRef.current === replacement;
            if (replacementIsRendered && !loadedUrlsRef.current.has(replacement)) return;
            URL.revokeObjectURL(url);
            retiredUrlsRef.current.delete(url);
            ownedUrlsRef.current.delete(url);
            loadedUrlsRef.current.delete(url);
            replacementUrlsRef.current.delete(url);
        });
    }, []);

    const retireUrl = useCallback((url: string | null) => {
        if (!url || !ownedUrlsRef.current.has(url)) return;
        retiredUrlsRef.current.add(url);
        if (imageElementRef.current && renderedHrefRef.current === url) return;
        queueMicrotask(collectRetiredUrls);
    }, [collectRetiredUrls]);

    const associateRetiredUrlsWithReplacement = useCallback((url: string) => {
        retiredUrlsRef.current.forEach(retired => replacementUrlsRef.current.set(retired, url));
    }, []);

    const updateVariant = useCallback((url: string | null) => {
        const previous = currentVariantRef.current;
        if (previous && previous !== url) {
            const replacement = url ?? previewRef.current?.url;
            if (replacement) replacementUrlsRef.current.set(previous, replacement);
            retireUrl(previous);
        }
        currentVariantRef.current = url;
        setVariant(url);
    }, [retireUrl]);

    const onImageLoad = useCallback((event: SyntheticEvent<SVGImageElement>) => {
        const url = event.currentTarget.href.baseVal;
        if (!url.startsWith("blob:")) return;
        loadedUrlsRef.current.add(url);
        collectRetiredUrls();
    }, [collectRetiredUrls]);

    const onImageRef = useCallback((element: SVGImageElement | null) => {
        imageElementRef.current = element;
        if (element) return;
        renderedHrefRef.current = null;
        ownedUrlsRef.current.forEach(url => retiredUrlsRef.current.add(url));
        replacementUrlsRef.current.clear();
        queueMicrotask(collectRetiredUrls);
    }, [collectRetiredUrls]);

    const href = variant ?? preview;
    useLayoutEffect(() => {
        const previous = renderedHrefRef.current;
        renderedHrefRef.current = href;
        retiredUrlsRef.current.forEach(retired => {
            const replacement = replacementUrlsRef.current.get(retired);
            if (replacement === undefined || replacement === previous) {
                if (href) replacementUrlsRef.current.set(retired, href);
                else replacementUrlsRef.current.delete(retired);
            }
        });
        collectRetiredUrls();
    }, [href, collectRetiredUrls]);

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
                if (requestedWidth <= PREVIEW_WIDTH) updateVariant(null);
                if (previewRef.current?.assetId !== assetId) {
                    retireUrl(previewRef.current?.url ?? null);
                    previewRef.current = null;
                    setPreview(null);
                    updateVariant(null);
                    const previewBlob = await boundedFetch(`/api/assets/${assetId}?width=${PREVIEW_WIDTH}`, controller.signal);
                    if (!live) return;
                    const url = URL.createObjectURL(previewBlob);
                    ownedUrlsRef.current.add(url);
                    associateRetiredUrlsWithReplacement(url);
                    previewRef.current = { assetId, url, mediaType: previewBlob.type };
                    setPreview(url);
                }
                if (requestedWidth > PREVIEW_WIDTH && previewRef.current?.mediaType !== "image/gif") {
                    const variantBlob = await boundedFetch(`/api/assets/${assetId}?width=${requestedWidth}`, controller.signal);
                    if (!live) return;
                    variantUrl = URL.createObjectURL(variantBlob);
                    ownedUrlsRef.current.add(variantUrl);
                    associateRetiredUrlsWithReplacement(variantUrl);
                    updateVariant(variantUrl);
                } else updateVariant(null);
            } catch (error) {
                if ((error as Error).name !== "AbortError") console.error("Unable to load board image", error);
            }
        };
        void load();
        return () => {
            live = false;
            controller.abort();
            retireUrl(variantUrl);
        };
    }, [assetId, requestedWidth, visible, associateRetiredUrlsWithReplacement, retireUrl, updateVariant]);

    useEffect(() => {
        if (!visible) {
            retireUrl(previewRef.current?.url ?? null);
            previewRef.current = null;
            setPreview(null);
            updateVariant(null);
        }
    }, [visible, retireUrl, updateVariant]);

    useEffect(() => () => {
        retireUrl(previewRef.current?.url ?? null);
        retireUrl(currentVariantRef.current);
    }, [retireUrl]);

    return { ref, href, onLoad: onImageLoad, imageRef: onImageRef };
}
