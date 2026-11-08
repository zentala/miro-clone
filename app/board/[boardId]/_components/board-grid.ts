import type { CSSProperties } from "react";
import type { Camera } from "@/types/canvas";

/** Dot spacing in world units; on screen it scales with zoom. */
export const GRID_SPACING = 24;
/** neutral-300 (212, 212, 212) on the neutral-100 workspace (DESIGN.md decision ledger). */
const DOT_RGB = "212, 212, 212";

/** Hidden below 25 % zoom, where dots would turn into noise; fades in up to full strength at 50 %. */
export function gridOpacity(zoom: number) {
    if (zoom < 0.25) return 0;
    return Math.min(1, (zoom - 0.125) / 0.375);
}

/**
 * Navigation grid as a CSS background of the workspace behind the SVG scene. It is
 * view state only: never saved, never part of the SVG, so PNG export and hit-testing
 * cannot include it. Dots sit on world multiples of GRID_SPACING plus half a cell.
 */
export function gridBackground(camera: Camera): CSSProperties {
    const opacity = gridOpacity(camera.zoom);
    if (opacity === 0) return {};
    const size = GRID_SPACING * camera.zoom;
    return {
        backgroundImage: `radial-gradient(circle, rgba(${DOT_RGB}, ${opacity}) 1px, transparent 1.5px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
    };
}
