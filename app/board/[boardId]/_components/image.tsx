import type { ImageLayer } from "@/types/canvas";
import { createContext, useContext, useId } from "react";
import { useVisibleAssets } from "@/hooks/use-visible-assets";

export const CameraZoomContext = createContext(1);

interface ImageProps {
    id: string;
    alt: string;
    layer: ImageLayer;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    selectionColor?: string;
}

export function Image({ id, alt, layer, onPointerDown, selectionColor }: ImageProps) {
    const { x, y, width, height, assetId } = layer;
    const gradientId = useId();
    const zoom = useContext(CameraZoomContext);
    const { ref, href } = useVisibleAssets(assetId, zoom);
    return (
        <g onPointerDown={event => onPointerDown(event, id)} data-image-layer="true">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e5e7eb" />
                    <stop offset="50%" stopColor="#f3f4f6" />
                    <stop offset="100%" stopColor="#d1d5db" />
                </linearGradient>
            </defs>
            <rect ref={ref} x={x} y={y} width={width} height={height} fill={`url(#${gradientId})`} />
            {href && <image
                href={href}
                x={x}
                y={y}
                width={width}
                height={height}
                preserveAspectRatio="xMidYMid meet"
                aria-label={alt}
                role="img"
            />}
            {selectionColor && (
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="none"
                    pointerEvents="none"
                    stroke={selectionColor}
                />
            )}
        </g>
    );
}
