import { useCallback, useRef } from "react";
import { useMutation, useHistory } from "@/hooks/use-local-board";
import {
    CanvasMode,
    CanvasState,
    Point,
    Side,
    XYWH,
    LayerType,
} from "@/types/canvas";
import {
    findIntersectingLayersWithRectangle,
    pointerEventToCanvasPoint,
    resizeBounds,
} from "@/lib/utils";

function resizeImageBounds(bounds: XYWH, corner: Side, point: Point): XYWH {
    const raw = resizeBounds(bounds, corner, point);
    const changesWidth = (corner & (Side.Left | Side.Right)) !== 0;
    const changesHeight = (corner & (Side.Top | Side.Bottom)) !== 0;
    const ratio = bounds.width / bounds.height;
    let width = raw.width;
    let height = raw.height;

    if (changesWidth && changesHeight) {
        width = Math.max(raw.width, raw.height * ratio);
        height = width / ratio;
    } else if (changesWidth) {
        height = width / ratio;
    } else {
        width = height * ratio;
    }

    const x = corner & Side.Left
        ? bounds.x + bounds.width - width
        : corner & Side.Right ? bounds.x : bounds.x + (bounds.width - width) / 2;
    const y = corner & Side.Top
        ? bounds.y + bounds.height - height
        : corner & Side.Bottom ? bounds.y : bounds.y + (bounds.height - height) / 2;
    return { x, y, width, height };
}

export function useCanvasLayerActions(
    canvasState: CanvasState,
    setCanvasState: (state: CanvasState) => void,
    layerIds: readonly string[],
    camera: { x: number; y: number; zoom: number }
) {
    const history = useHistory();
    const translatePointRef = useRef<Point | null>(null);

    const translateSelectedLayers = useMutation(({ storage, self }, point: Point) => {
        if (canvasState.mode !== CanvasMode.Translating) return;
        const from = translatePointRef.current ?? canvasState.current;
        translatePointRef.current = point;
        const offset = { x: point.x - from.x, y: point.y - from.y };
        const liveLayers = storage.get("layers");
        for (const id of self.presence.selection) {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ x: layer.get("x") + offset.x, y: layer.get("y") + offset.y });
        }
        setCanvasState({ mode: CanvasMode.Translating, current: point });
    }, [canvasState]);

    const unSelectLayers = useMutation(({ setMyPresence, self }) => {
        if (self.presence.selection.length > 0) setMyPresence({ selection: [] }, { addToHistory: true });
    }, []);

    const updateSelectionNet = useMutation(({ storage, setMyPresence }, current: Point, origin: Point) => {
        const layers = storage.get("layers").toImmutable();
        setCanvasState({ mode: CanvasMode.SelectionNet, origin, current });
        const ids = findIntersectingLayersWithRectangle(layerIds, layers, origin, current);
        setMyPresence({ selection: ids });
    }, [layerIds]);

    const resizeSelectedLayer = useMutation(({ storage, self }, point: Point) => {
        if (canvasState.mode !== CanvasMode.Resizing) return;
        const layer = storage.get("layers").get(self.presence.selection[0]);
        if (!layer) return;
        const bounds = layer.get("type") === LayerType.Image
            ? resizeImageBounds(canvasState.initialBounds, canvasState.corner, point)
            : resizeBounds(canvasState.initialBounds, canvasState.corner, point);
        layer.update(bounds);
    }, [canvasState]);

    const onResizeHandlePointerDown = useCallback((corner: Side, initialBounds: XYWH) => {
        history.pause();
        setCanvasState({ mode: CanvasMode.Resizing, initialBounds, corner });
    }, [history, setCanvasState]);

    const onLayerPointerDown = useMutation(({ self, setMyPresence }, event: React.PointerEvent, layerId: string) => {
        if (canvasState.mode === CanvasMode.Pencil || canvasState.mode === CanvasMode.Inserting) return;
        history.pause();
        event.stopPropagation();
        const point = pointerEventToCanvasPoint(event, camera);
        if (!self.presence.selection.includes(layerId)) setMyPresence({ selection: [layerId] }, { addToHistory: true });
        translatePointRef.current = point;
        setCanvasState({ mode: CanvasMode.Translating, current: point });
    }, [setCanvasState, history, camera, canvasState.mode]);

    const moveSelectedLayers = useMutation(({ storage, self, setMyPresence }, offset: Point) => {
        const liveLayers = storage.get("layers");
        const selection = self.presence.selection;
        if (selection.length === 0) return;
        for (const id of selection) {
            const layer = liveLayers.get(id);
            if (layer) layer.update({ x: layer.get("x") + offset.x, y: layer.get("y") + offset.y });
        }
        setMyPresence({ selection }, { addToHistory: true });
    }, [canvasState, history]);

    return { translateSelectedLayers, unSelectLayers, updateSelectionNet, resizeSelectedLayer, onResizeHandlePointerDown, onLayerPointerDown, moveSelectedLayers };
}
