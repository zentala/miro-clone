"use client";

import { Minus, Plus } from "lucide-react";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/utils";

interface ZoomControlsProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
}

/** Bottom-right zoom panel: step out, current level (click for 100 %), step in. */
export const ZoomControls = ({ zoom, onZoomIn, onZoomOut, onResetZoom }: ZoomControlsProps) => {
    const percent = `${Math.round(zoom * 100)}%`;

    return (
        <div className="bg-white rounded-md px-1.5 h-12 flex items-center shadow-md">
            <Hint label="Zoom out" side="top" sideOffset={10}>
                <Button aria-label="Zoom out" variant="board" size="icon" onClick={onZoomOut} disabled={zoom <= MIN_ZOOM}>
                    <Minus />
                </Button>
            </Hint>
            <Hint label="Zoom to 100%" side="top" sideOffset={10}>
                <Button
                    aria-label={`Zoom ${percent}, reset to 100%`}
                    data-zoom-level={zoom}
                    variant="board"
                    className="w-16 px-0 text-sm tabular-nums"
                    onClick={onResetZoom}
                >
                    {percent}
                </Button>
            </Hint>
            <Hint label="Zoom in" side="top" sideOffset={10}>
                <Button aria-label="Zoom in" variant="board" size="icon" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM}>
                    <Plus />
                </Button>
            </Hint>
        </div>
    );
};
