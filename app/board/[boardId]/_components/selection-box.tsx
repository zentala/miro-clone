"use client";

import { useSelectionBounds } from "@/hooks/use-selection-bounds";
import { useSelf, useStorage } from "@/hooks/use-local-board";
import { LayerType, Side, XYWH } from "@/types/canvas";
import { memo } from "react";

interface SelectionBoxProps {
    onResizeHandlePointerDown: (corner: Side, initialBounds: XYWH) => void;
    /** Camera zoom; handles and outlines keep their on-screen size. */
    zoom: number;
}

const HANDLE_SCREEN_WIDTH = 6;

export const SelectionBox = memo(
    ({ onResizeHandlePointerDown, zoom }: SelectionBoxProps) => {
        const handleWidth = HANDLE_SCREEN_WIDTH / zoom;
        const soleLayerId = useSelf((me) =>
            me.presence.selection.length === 1 ? me.presence.selection[0] : null
        );

        const isShowingHandles = useStorage(
            (root) =>
                soleLayerId &&
                root.layers.get(soleLayerId)?.type !== LayerType.Path
        );

        const bounds = useSelectionBounds();

        if (!bounds) {
            return null;
        }

        return (
            <>
                <rect
                    className="fill-transparent stroke-blue-500 stroke-1 pointer-events-none"
                    vectorEffect="non-scaling-stroke"
                    style={{
                        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
                    }}
                    x={0}
                    y={0}
                    width={bounds.width}
                    height={bounds.height}
                />
                {isShowingHandles && (
                    <>
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "nwse-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x - handleWidth / 2}px, ${bounds.y - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Top + Side.Left, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "ns-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x + bounds.width / 2 - handleWidth / 2}px, ${bounds.y - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Top, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "nesw-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x + bounds.width - handleWidth / 2}px, ${bounds.y - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Top + Side.Right, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "ew-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x + bounds.width - handleWidth / 2}px, ${bounds.y + bounds.height / 2 - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Right, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "nwse-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x + bounds.width - handleWidth / 2}px, ${bounds.y + bounds.height - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Right + Side.Bottom, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "ns-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x + bounds.width / 2 - handleWidth / 2}px, ${bounds.y + bounds.height - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Bottom, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "nesw-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x - handleWidth / 2}px, ${bounds.y + bounds.height - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Left + Side.Bottom, bounds);
                            }}
                        />
                        <rect
                            className="fill-white stroke-1 stroke-blue-500"
                            vectorEffect="non-scaling-stroke"
                            x={0}
                            y={0}
                            style={{
                                cursor: "ew-resize",
                                width: `${handleWidth}px`,
                                height: `${handleWidth}px`,
                                transform: `translate(${bounds.x - handleWidth / 2}px, ${bounds.y + bounds.height / 2 - handleWidth / 2}px)`,
                            }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                onResizeHandlePointerDown(Side.Left, bounds);
                            }}
                        />
                    </>
                )}
            </>
        );
    }
);

SelectionBox.displayName = "SelectionBox";
