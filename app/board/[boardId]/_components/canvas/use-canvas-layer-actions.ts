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

const MIN_IMAGE_EDGE = 1;

function resizeImageBounds(bounds: XYWH, corner: Side, point: Point): XYWH {
    const ratio = bounds.width / bounds.height;
    if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return bounds;

    const changesWidth = (corner & (Side.Left | Side.Right)) !== 0;
    const changesHeight = (corner & (Side.Top | Side.Bottom)) !== 0;
    const anchorX = corner & Side.Left ? bounds.x + bounds.width : bounds.x;
    const anchorY = corner & Side.Top ? bounds.y + bounds.height : bounds.y;
    const minimumWidth = Math.min(MIN_IMAGE_EDGE, ratio);
    const minimumHeight = Math.min(MIN_IMAGE_EDGE, 1 / ratio);
    const pointerWidth = changesWidth ? Math.abs(point.x - anchorX) : bounds.width;
    const pointerHeight = changesHeight ? Math.abs(point.y - anchorY) : bounds.height;
    let width: number;
    let height: number;

    if (changesWidth && changesHeight) {
        width = Math.max(pointerWidth, pointerHeight * ratio, minimumWidth);
        height = width / ratio;
    } else if (changesWidth) {
        width = Math.max(pointerWidth, minimumWidth);
        height = width / ratio;
    } else if (changesHeight) {
        height = Math.max(pointerHeight, minimumHeight);
        width = height * ratio;
    } else {
        return bounds;
    }

    if (![width, height].every(value => Number.isFinite(value) && value > 0)) return bounds;

    const x = changesWidth
        ? point.x < anchorX ? anchorX - width : anchorX
        : bounds.x + (bounds.width - width) / 2;
    const y = changesHeight
        ? point.y < anchorY ? anchorY - height : anchorY
        : bounds.y + (bounds.height - height) / 2;
    if (![x, y].every(Number.isFinite)) return bounds;
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
