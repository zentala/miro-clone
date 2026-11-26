"use client";

import type { FrameLayer } from "@/types/canvas";

interface FrameProps {
    id: string;
    layer: FrameLayer;
    onPointerDown: (event: React.PointerEvent, id: string) => void;
}

/** A non-clipping frame surface. Its label remains visible above the bounds. */
export function Frame({ id, layer, onPointerDown }: FrameProps) {
    return (
        <g data-frame-id={id} data-frame-name={layer.name}>
            <rect
                data-frame-bounds="true"
                x={layer.x} y={layer.y} width={layer.width} height={layer.height}
                fill="white" stroke="#d4d4d4" strokeWidth="1"
                onPointerDown={event => onPointerDown(event, id)}
            />
            <text x={layer.x} y={layer.y - 6} fill="#525252" fontFamily="Inter, sans-serif" fontSize="12" pointerEvents="none">
                {layer.name}
            </text>
        </g>
    );
}
