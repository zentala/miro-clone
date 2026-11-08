"use client";

import { RefObject, useCallback, useEffect, useState } from "react";
import type { Camera, Point } from "@/types/canvas";
import { DEFAULT_CAMERA, nextZoomLevel, zoomCameraAt } from "@/lib/utils";

/** Zoom change per wheel pixel with Ctrl/⌘ or a trackpad pinch; one mouse-wheel notch is about 1.28×. */
const WHEEL_ZOOM_SPEED = 0.0025;
const MAX_WHEEL_DELTA = 100;
const LINE_HEIGHT = 16;

const viewportCenter = (): Point => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

/**
 * Board camera (pan and zoom). It is view state only: never saved, never part of history.
 * Plain wheel pans; Ctrl/⌘ + wheel and trackpad pinch zoom about the pointer.
 */
export function useBoardCamera(svgRef: RefObject<SVGSVGElement>) {
    const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            // Non-passive, so Ctrl + wheel zooms the board instead of the page.
            e.preventDefault();
            const scale = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
            const deltaX = e.deltaX * scale, deltaY = e.deltaY * scale;
            if (e.ctrlKey || e.metaKey) {
                const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, deltaY));
                const anchor = { x: e.clientX, y: e.clientY };
                setCamera(current => zoomCameraAt(current, anchor, current.zoom * Math.exp(-delta * WHEEL_ZOOM_SPEED)));
            } else {
                setCamera(current => ({ ...current, x: current.x - deltaX, y: current.y - deltaY }));
            }
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, [svgRef]);

    const zoomIn = useCallback(() => setCamera(c => zoomCameraAt(c, viewportCenter(), nextZoomLevel(c.zoom, 1))), []);
    const zoomOut = useCallback(() => setCamera(c => zoomCameraAt(c, viewportCenter(), nextZoomLevel(c.zoom, -1))), []);
    const resetZoom = useCallback(() => setCamera(c => zoomCameraAt(c, viewportCenter(), 1)), []);
    const resetCamera = useCallback(() => setCamera(DEFAULT_CAMERA), []);

    return { camera, zoomIn, zoomOut, resetZoom, resetCamera };
}
