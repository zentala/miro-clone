import type { ImageLayer } from "@/types/canvas";

interface ImageProps {
    id: string;
    alt: string;
    layer: ImageLayer;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
    selectionColor?: string;
}

export function Image({ id, alt, layer, onPointerDown, selectionColor }: ImageProps) {
    const { x, y, width, height, assetId } = layer;
    return (
        <g onPointerDown={event => onPointerDown(event, id)} data-image-layer="true">
            <image
                href={`/api/assets/${assetId}`}
                x={x}
                y={y}
                width={width}
                height={height}
                preserveAspectRatio="xMidYMid meet"
                aria-label={alt}
                role="img"
            />
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
