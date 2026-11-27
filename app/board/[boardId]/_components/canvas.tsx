"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
    CanvasMode,
    LayerType,
    type CanvasState,
    type Color,
    type Point,
    type CodeLayer,
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
import { LocalObject } from "@/store/use-board-store";
import { isHttpSourceUrl } from "@/types/extraction";
import { framesBehindLayers } from "@/lib/document-version";
import { pointerEventToCanvasPoint } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isEffectivelyLocked, toggleObjectLocks } from "@/lib/object-locks";
import { Lock, Unlock } from "lucide-react";

const SELECTION_NET_THRESHOLD = 5;

interface CanvasProps {
    boardId: string;
}

export const Canvas = ({ boardId }: CanvasProps) => {
    const [canvasState, setCanvasState] = useState<CanvasState>({ mode: CanvasMode.None });
    const [lastUsedColor, setLastUsedColor] = useState<Color>({ r: 255, g: 255, b: 255 });
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const store = useLocalBoard();
    const history = useHistory();
    const layerIds = useStorage((root) => root.layerIds);
    const paintLayerIds = useStorage(root => framesBehindLayers(root.layerIds, root.layers));
    const pencilDraft = useSelf((me) => me.presence.pencilDraft);
    const selection = useSelf((me) => me.presence.selection);
    const allOwnLocked = useStorage(root => selection.length > 0 && selection.every(id => root.layers.get(id)?.locked === true));
    const canUndo = useCanUndo();
    const canRedo = useCanRedo();
    const title = useBoardSelector((current) => current.board.title);
    const { camera, zoomIn, zoomOut, resetZoom, resetCamera } = useBoardCamera(svgRef);
    const layerActions = useCanvasLayerActions(canvasState, setCanvasState, layerIds, camera);
    const { insertImage: insertImageLayer, ...contentActions } = useCanvasContentActions(canvasState, setCanvasState, lastUsedColor, store);
    const duplicateLayers = useCanvasDuplicate(setCanvasState);

    const createFrame = useCallback(() => {
        if (layerIds.length >= MAX_LAYERS) {
            store.refuse(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
            return;
        }
        const bounds = svgRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const id = nanoid();
        store.mutate(({ storage, setMyPresence }) => {
            storage.get("layers").set(id, new LocalObject({
                type: LayerType.Frame,
                x: (bounds.width / 2 - camera.x) / camera.zoom - 200,
                y: (bounds.height / 2 - camera.y) / camera.zoom - 150,
                width: 400,
                height: 300,
                name: "Frame",
            }));
            storage.get("layerIds").push(id);
            setMyPresence({ selection: [id] }, { addToHistory: true });
        });
    }, [camera, layerIds.length, store]);

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

    const insertPastedUrl = useCallback((sourceUrl: string) => {
        const svg = svgRef.current;
        if (!svg) return;
        if (layerIds.length >= MAX_LAYERS) {
            store.refuse(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
            return;
        }

        const bounds = svg.getBoundingClientRect();
        const center = {
            x: (bounds.width / 2 - camera.x) / camera.zoom,
            y: (bounds.height / 2 - camera.y) / camera.zoom,
        };
        const id = nanoid();
        store.mutate(({ storage, setMyPresence }) => {
            storage.get("layers").set(id, new LocalObject({
                type: LayerType.ProductCard,
                x: center.x - 160,
                y: center.y - 136,
                width: 320,
                height: 272,
                sourceUrl,
                extractionStatus: "unsupported",
                extractionMessage: "Automatic preview is not connected. The source URL and manual edits are saved.",
            }));
            storage.get("layerIds").push(id);
            setMyPresence({ selection: [id] }, { addToHistory: true });
        });
        setCanvasState({ mode: CanvasMode.None });
    }, [camera, layerIds.length, store]);

    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            if (event.defaultPrevented) return;
            const target = event.target;
            if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;
            const pasted = event.clipboardData?.getData("text/plain");
            const sourceUrl = pasted?.trim();
            if (!isHttpSourceUrl(sourceUrl)) return;
            event.preventDefault();
            event.stopPropagation();
            insertPastedUrl(sourceUrl);
        };
        document.addEventListener("paste", onPaste);
        return () => document.removeEventListener("paste", onPaste);
    }, [insertPastedUrl]);

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

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            if (selection.length) setContextMenu({ x: event.clientX, y: event.clientY });
        };
        svg.addEventListener("contextmenu", onContextMenu);
        return () => svg.removeEventListener("contextmenu", onContextMenu);
    }, [selection]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
                event.preventDefault();
                toggleObjectLocks(store, selection);
                setContextMenu(null);
            }
        };
        const onDoubleClick = (event: MouseEvent) => {
            if (!(event.target instanceof Element) || !svgRef.current?.contains(event.target)) return;
            if (selection.some(id => isEffectivelyLocked(store.document, id))) {
                event.preventDefault();
                event.stopImmediatePropagation();
                store.refuse("This object is locked. Unlock it before editing its text.");
            }
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("dblclick", onDoubleClick, true);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("dblclick", onDoubleClick, true);
        };
    }, [selection, store]);

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

    const onCanvasPointerUp = (event: React.PointerEvent) => {
        if (canvasState.mode !== CanvasMode.Inserting || canvasState.codeBlock !== true) {
            pointerHandlers.onPointerUp(event);
            return;
        }
        event.preventDefault();
        if (layerIds.length >= MAX_LAYERS) {
            store.refuse(`This board is full: it can hold at most ${MAX_LAYERS} objects.`);
            setCanvasState({ mode: CanvasMode.None });
            history.resume();
            return;
        }
        const point = pointerEventToCanvasPoint(event, camera);
        const id = nanoid();
        store.mutate(({ storage, setMyPresence }) => {
            storage.get("layers").set(id, new LocalObject<CodeLayer>({
                type: LayerType.Text,
                codeBlock: true,
                x: point.x,
                y: point.y,
                width: 320,
                height: 220,
                fill: lastUsedColor,
                value: "",
                fontSize: 14,
                showLineNumbers: true,
            }));
            storage.get("layerIds").push(id);
            setMyPresence({ selection: [id] }, { addToHistory: true });
        });
        setCanvasState({ mode: CanvasMode.None });
        history.resume();
    };

    return (
        <>
            <BoardSurface
                boardId={boardId}
                svgRef={svgRef}
                layerIds={paintLayerIds}
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
                onPointerUp={onCanvasPointerUp}
                onPointerDown={pointerHandlers.onPointerDown}
                onLayerPointerDown={onStableLayerPointerDown}
                onResizeHandlePointerDown={layerActions.onResizeHandlePointerDown}
                exportAsPng={exportAsPng}
                onImportImage={importImage}
            />
            <Button aria-label="New frame" className="fixed right-4 top-20 z-30" variant="board" onClick={createFrame}>New frame</Button>
            <div data-canvas-overlay="rich-text-toolbar" className="pointer-events-none fixed inset-0 z-50" />
            {contextMenu && <div role="menu" className="fixed z-[60] rounded-md border bg-white p-1 shadow-md"
                style={{ left: contextMenu.x, top: contextMenu.y }}>
                <button role="menuitem" className="flex h-9 items-center gap-2 rounded px-3 text-sm hover:bg-neutral-100"
                    onClick={() => { toggleObjectLocks(store, selection); setContextMenu(null); }}>
                    {allOwnLocked ? <Unlock size={16} /> : <Lock size={16} />}
                    {allOwnLocked ? "Unlock selected objects" : "Lock selected objects"}
                </button>
            </div>}
        </>
    );
};
