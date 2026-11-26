"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalBoard } from "@/hooks/use-local-board";
import { useVisibleAssets } from "@/hooks/use-visible-assets";
import { CameraZoomContext } from "./image";
import { LayerType, type Layer, type ProductCardLayer } from "@/types/canvas";
import { mergeProductMetadata, PRODUCT_EXTRACTION_REQUEST_EVENT, type ProductExtractionRequest } from "@/types/extraction";

interface ProductCardProps {
    id: string;
    layer: ProductCardLayer;
    onPointerDown: (event: React.PointerEvent, layerId: string) => void;
    selectionColor?: string;
}

const COVER_HEIGHT = 112;

function ProductCardCover({ assetId, x, y, width, height, zoom }: {
    assetId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}) {
    if (!assetId) {
        return <rect x={x} y={y} width={width} height={height} fill="#f3f4f6" />;
    }
    return <StoredCover assetId={assetId} x={x} y={y} width={width} height={height} zoom={zoom} />;
}

function StoredCover({ assetId, x, y, width, height, zoom }: {
    assetId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}) {
    const { ref, imageRef, onLoad, href } = useVisibleAssets(assetId, zoom);
    return <>
        <rect ref={ref} x={x} y={y} width={width} height={height} fill="#f3f4f6" />
        {href && <image ref={imageRef} onLoad={onLoad} href={href} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Product preview" />}
    </>;
}

function setCardFields(id: string, store: ReturnType<typeof useLocalBoard>, fields: Partial<ProductCardLayer>) {
    store.mutate(({ storage }) => {
        const layer = storage.get("layers").get(id);
        if (!layer || layer.get("type") !== LayerType.ProductCard) return;
        layer.update(fields as unknown as Partial<Layer>);
    });
}

function statusText(layer: ProductCardLayer) {
    switch (layer.extractionStatus) {
        case "pending": return "Preview pending";
        case "offline": return "Preview unavailable offline";
        case "unsupported": return "Automatic preview unavailable";
        case "error": return "Preview could not be loaded";
        case "ready": return layer.extractionMessage ?? "Preview ready";
    }
}

export function ProductCard({ id, layer, onPointerDown, selectionColor }: ProductCardProps) {
    const store = useLocalBoard();
    const zoom = useContext(CameraZoomContext);
    const fileInput = useRef<HTMLInputElement | null>(null);
    const [title, setTitle] = useState(layer.title ?? "");
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => setTitle(layer.title ?? ""), [layer.title]);

    const editTitle = () => {
        if (title === (layer.title ?? "")) return;
        setCardFields(id, store, { title, titleSource: "manual" });
    };

    const replaceImage = async (file?: File) => {
        if (!file) return;
        setUploadError(null);
        try {
            const response = await fetch("/api/assets", {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const result = await response.json().catch(() => null) as { id?: unknown; error?: unknown } | null;
            if (!response.ok || typeof result?.id !== "string" || !/^[0-9a-f]{64}$/.test(result.id)) {
                throw new Error(typeof result?.error === "string" ? result.error : "Unable to save this image locally.");
            }
            setCardFields(id, store, { assetId: result.id, imageSource: "manual" });
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : "Unable to save this image locally.");
        }
    };

    const retryExtraction = () => {
        setCardFields(id, store, { extractionStatus: "pending", extractionMessage: undefined });
        const detail: ProductExtractionRequest = {
            cardId: id,
            sourceUrl: layer.sourceUrl,
            complete: metadata => {
                const latest = store.document.layers[id];
                if (latest?.type === LayerType.ProductCard) setCardFields(id, store, mergeProductMetadata(latest, metadata));
            },
            fail: (status, message) => setCardFields(id, store, { extractionStatus: status, extractionMessage: message }),
        };
        const request = new CustomEvent<ProductExtractionRequest>(PRODUCT_EXTRACTION_REQUEST_EVENT, { detail, cancelable: true });
        const claimed = !window.dispatchEvent(request);
        if (!claimed) {
            setCardFields(id, store, {
                extractionStatus: "unsupported",
                extractionMessage: "No local extraction provider is connected. The source URL and manual edits are saved.",
            });
        }
    };

    const stopControlPointer = (event: React.PointerEvent) => event.stopPropagation();
    const bodyY = layer.y + COVER_HEIGHT;

    return <g onPointerDown={event => onPointerDown(event, id)} data-product-card="true">
        <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx="8" fill="white" />
        <ProductCardCover assetId={layer.assetId} x={layer.x} y={layer.y} width={layer.width} height={COVER_HEIGHT} zoom={zoom} />
        {!layer.assetId && <text x={layer.x + layer.width / 2} y={layer.y + COVER_HEIGHT / 2 + 4} textAnchor="middle" className="fill-neutral-500 text-xs">No local preview</text>}
        <foreignObject x={layer.x} y={bodyY} width={layer.width} height={Math.max(0, layer.height - COVER_HEIGHT)}>
            <div className="h-full w-full rounded-b-lg border border-t-0 border-neutral-200 bg-white p-2 flex flex-col gap-1.5 font-sans">
                <Input
                    aria-label="Product title"
                    value={title}
                    placeholder="Add a title"
                    maxLength={240}
                    onPointerDown={stopControlPointer}
                    onChange={event => setTitle(event.currentTarget.value)}
                    onBlur={editTitle}
                />
                <a
                    href={layer.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={layer.sourceUrl}
                    className="max-h-9 overflow-hidden break-all text-xs leading-4 text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onPointerDown={stopControlPointer}
                >
                    {layer.sourceUrl}
                </a>
                <div className="flex items-center gap-1.5">
                    <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Choose a local product image"
                        className="sr-only"
                        onChange={event => { void replaceImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
                    />
                    <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 px-2 text-xs" onPointerDown={stopControlPointer} onClick={() => fileInput.current?.click()}>
                        {layer.assetId ? "Replace image" : "Add image"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 px-2 text-xs" onPointerDown={stopControlPointer} onClick={retryExtraction}>
                        Retry preview
                    </Button>
                </div>
                <div className="min-h-4 truncate text-[11px] leading-4 text-neutral-500" role="status" aria-live="polite" title={layer.extractionMessage ?? statusText(layer)}>
                    {uploadError ?? layer.extractionMessage ?? statusText(layer)}
                </div>
            </div>
        </foreignObject>
        <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx="8" fill="none" stroke={selectionColor ?? "#d1d5db"} strokeWidth={selectionColor ? 2 : 1} pointerEvents="none" />
    </g>;
}
