import { useCallback } from "react";
import { useMutation, useHistory } from "@/hooks/use-local-board";
import { CanvasMode, CanvasState, Point, LayerType } from "@/types/canvas";
import { pointerEventToCanvasPoint } from "@/lib/utils";

interface PointerActions {
    canvasState: CanvasState;
    setCanvasState: (state: CanvasState) => void;
    camera: { x: number; y: number; zoom: number };
    startDrawing: (point: Point, pressure: number) => void;
    insertPath: () => void;
    insertLayer: (type: LayerType.Rectangle | LayerType.Ellipse | LayerType.Text | LayerType.Note, point: Point) => void;
    unSelectLayers: () => void;
    startMultiSelection: (current: Point, origin: Point) => void;
    updateSelectionNet: (current: Point, origin: Point) => void;
    translateSelectedLayers: (point: Point) => void;
    resizeSelectedLayer: (point: Point) => void;
    continueDrawing: (point: Point, event: React.PointerEvent) => void;
}

export function useCanvasPointerHandlers({
    canvasState,
    setCanvasState,
    camera,
    startDrawing,
    insertPath,
    insertLayer,
    unSelectLayers,
    startMultiSelection,
    updateSelectionNet,
    translateSelectedLayers,
    resizeSelectedLayer,
    continueDrawing,
}: PointerActions) {
    const history = useHistory();

    const onPointerMove = useMutation(({ setMyPresence }, event: React.PointerEvent) => {
        event.preventDefault();
        const current = pointerEventToCanvasPoint(event, camera);
        if (canvasState.mode === CanvasMode.Pressing) startMultiSelection(current, canvasState.origin);
        else if (canvasState.mode === CanvasMode.SelectionNet) updateSelectionNet(current, canvasState.origin);
        else if (canvasState.mode === CanvasMode.Translating) translateSelectedLayers(current);
        else if (canvasState.mode === CanvasMode.Resizing) resizeSelectedLayer(current);
        else if (canvasState.mode === CanvasMode.Pencil) continueDrawing(current, event);
        setMyPresence({ cursor: current });
    }, [continueDrawing, canvasState, resizeSelectedLayer, camera, translateSelectedLayers, startMultiSelection, updateSelectionNet]);

    const onPointerLeave = useMutation(({ setMyPresence }) => setMyPresence({ cursor: null }), []);

    const onPointerDown = useCallback((event: React.PointerEvent) => {
        if (canvasState.mode === CanvasMode.Inserting) return;
        const point = pointerEventToCanvasPoint(event, camera);
        if (canvasState.mode === CanvasMode.Pencil) {
            startDrawing(point, event.pressure);
            return;
        }
        setCanvasState({ mode: CanvasMode.Pressing, origin: point });
    }, [camera, canvasState.mode, setCanvasState, startDrawing]);

    const onPointerUp = useMutation(({}, event: React.PointerEvent) => {
        const point = pointerEventToCanvasPoint(event, camera);
        if (canvasState.mode === CanvasMode.None || canvasState.mode === CanvasMode.Pressing) {
            unSelectLayers();
            setCanvasState({ mode: CanvasMode.None });
        } else if (canvasState.mode === CanvasMode.Pencil) insertPath();
        else if (canvasState.mode === CanvasMode.Inserting) insertLayer(canvasState.layerType, point);
        else setCanvasState({ mode: CanvasMode.None });
        history.resume();
    }, [setCanvasState, camera, canvasState, history, insertLayer, unSelectLayers, insertPath]);

    return { onPointerMove, onPointerLeave, onPointerDown, onPointerUp };
}
