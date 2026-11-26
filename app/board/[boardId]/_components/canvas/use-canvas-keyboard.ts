import { useEffect } from "react";
import { CanvasMode, Point } from "@/types/canvas";
import type { useHistory } from "@/hooks/use-local-board";

type History = ReturnType<typeof useHistory>;
const MOVE_OFFSET = 5;

export function useCanvasKeyboard(
    mode: CanvasMode,
    history: History,
    duplicateLayers: () => void,
    moveSelectedLayers: (offset: Point) => void
) {
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const target = e.target as HTMLElement;
            if (target.isContentEditable || target.closest("input, textarea, select")) return;
            if ((e.ctrlKey || e.metaKey) && ["z", "d"].includes(e.key.toLowerCase())) e.preventDefault();
            let offset: Point = { x: 0, y: 0 };
            switch (e.key.length === 1 ? e.key.toLowerCase() : e.key) {
                case "d":
                    if ((e.ctrlKey || e.metaKey) && mode === CanvasMode.None) duplicateLayers();
                    break;
                case "z":
                    if (e.ctrlKey || e.metaKey) e.shiftKey ? history.redo() : history.undo();
                    break;
                case "ArrowUp": offset = { x: 0, y: -MOVE_OFFSET }; moveSelectedLayers(offset); break;
                case "ArrowDown": offset = { x: 0, y: MOVE_OFFSET }; moveSelectedLayers(offset); break;
                case "ArrowLeft": offset = { x: -MOVE_OFFSET, y: 0 }; moveSelectedLayers(offset); break;
                case "ArrowRight": offset = { x: MOVE_OFFSET, y: 0 }; moveSelectedLayers(offset); break;
                default: break;
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [history, duplicateLayers, moveSelectedLayers, mode]);
}
