"use client";

import { useCallback, useRef, useState } from "react";
import {
    CanvasMode,
    CanvasState,
    Color,
    Point,
} from "@/types/canvas";
import { MAX_LAYERS } from "@/lib/document-version";
import {
    useBoardSelector,
    useCanRedo,
    useCanUndo,
    useHistory,
    useSelf,
    useStorage,
    useLocalBoard,
} from "@/hooks/use-local-board";
import { exportBoardPng } from "./export-png";
import { useDisableScrollBounce } from "@/hooks/use-disable-scroll-bounce";
import { useBoardCamera } from "./use-board-camera";
import { BoardSurface } from "./canvas/board-surface";
import { useCanvasDuplicate } from "./canvas/use-canvas-duplicate";
import { useCanvasKeyboard } from "./canvas/use-canvas-keyboard";
import { useCanvasLayerActions } from "./canvas/use-canvas-layer-actions";
import { useCanvasContentActions } from "./canvas/use-canvas-content-actions";
import { useCanvasPointerHandlers } from "./canvas/use-canvas-pointer-handlers";

const SELECTION_NET_THRESHOLD = 5;

interface CanvasProps {
    boardId: string;
}

export const Canvas = ({ boardId }: CanvasProps) => {
    const [canvasState, setCanvasState] = useState<CanvasState>({ mode: CanvasMode.None });
    const [lastUsedColor, setLastUsedColor] = useState<Color>({ r: 255, g: 255, b: 255 });
    const svgRef = useRef<SVGSVGElement | null>(null);
    const store = useLocalBoard();
    const history = useHistory();
    const layerIds = useStorage((root) => root.layerIds);
    const pencilDraft = useSelf((me) => me.presence.pencilDraft);
    const canUndo = useCanUndo();
    const canRedo = useCanRedo();
    const title = useBoardSelector((current) => current.board.title);
    const { camera, zoomIn, zoomOut, resetZoom, resetCamera } = useBoardCamera(svgRef);
    const layerActions = useCanvasLayerActions(canvasState, setCanvasState, layerIds, camera);
    const { insertImage: insertImageLayer, ...contentActions } = useCanvasContentActions(canvasState, setCanvasState, lastUsedColor, store);
    const duplicateLayers = useCanvasDuplicate(setCanvasState);

    const importImage = useCallback(async (file: File) => {
        if (layerIds.length >= MAX_LAYERS) {
            store.refuse(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
            throw new Error(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
        }
        const svg = svgRef.current;
        if (!svg) throw new Error("The board is not ready to add an image.");

        let response: Response;
        try {
            response = await fetch("/api/assets", {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
        } catch {
            throw new Error("Unable to upload the image to local storage.");
        }
        const result = await response.json().catch(() => null) as { id?: unknown; width?: unknown; height?: unknown; error?: unknown } | null;
        if (!response.ok) {
            throw new Error(typeof result?.error === "string" ? result.error : "Unable to upload the image to local storage.");
        }
        if (typeof result?.id !== "string" || !Number.isFinite(result.width) || !Number.isFinite(result.height) ||
            (result.width as number) <= 0 || (result.height as number) <= 0) {
            throw new Error("The local asset service returned invalid image dimensions.");
        }

        const bounds = svg.getBoundingClientRect();
        const center = {
            x: (bounds.width / 2 - camera.x) / camera.zoom,
            y: (bounds.height / 2 - camera.y) / camera.zoom,
        };
        if (!insertImageLayer({ id: result.id, width: result.width as number, height: result.height as number }, center)) {
            throw new Error(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
        }
    }, [camera, insertImageLayer, layerIds.length, store]);

    useDisableScrollBounce();

    const startMultiSelection = useCallback((current: Point, origin: Point) => {
        if (Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > SELECTION_NET_THRESHOLD) {
            setCanvasState({ mode: CanvasMode.SelectionNet, origin, current });
        }
    }, []);

    const pointerHandlers = useCanvasPointerHandlers({
        canvasState,
        setCanvasState,
        camera,
        ...contentActions,
        ...layerActions,
        startMultiSelection,
    });
    useCanvasKeyboard(canvasState.mode, history, duplicateLayers, layerActions.moveSelectedLayers);

    const layerPointerDownRef = useRef(layerActions.onLayerPointerDown);
    layerPointerDownRef.current = layerActions.onLayerPointerDown;
    const onStableLayerPointerDown = useCallback(
        (event: React.PointerEvent, layerId: string) => layerPointerDownRef.current(event, layerId),
        []
    );

    const exportAsPng = useCallback(() => {
        if (svgRef.current && layerIds.length > 0) {
            void exportBoardPng(svgRef.current, `${title || "download"}.png`);
        }
    }, [layerIds.length, title]);

    return (
        <>
            <BoardSurface
                boardId={boardId}
                svgRef={svgRef}
                layerIds={layerIds}
                canvasState={canvasState}
                setCanvasState={setCanvasState}
                camera={camera}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                resetZoom={resetZoom}
                resetCamera={resetCamera}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={history.undo}
                redo={history.redo}
                lastUsedColor={lastUsedColor}
                setLastUsedColor={setLastUsedColor}
                onDuplicate={duplicateLayers}
                pencilDraft={pencilDraft}
                onPointerMove={pointerHandlers.onPointerMove}
                onPointerLeave={pointerHandlers.onPointerLeave}
                onPointerUp={pointerHandlers.onPointerUp}
                onPointerDown={pointerHandlers.onPointerDown}
                onLayerPointerDown={onStableLayerPointerDown}
                onResizeHandlePointerDown={layerActions.onResizeHandlePointerDown}
                exportAsPng={exportAsPng}
                onImportImage={importImage}
            />
            <div data-canvas-overlay="rich-text-toolbar" className="pointer-events-none fixed inset-0 z-50" />
        </>
    );
};
