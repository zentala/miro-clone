import { nanoid } from "nanoid";
import { useMutation } from "@/hooks/use-local-board";
import { LocalObject } from "@/store/use-board-store";
import { CanvasMode, CanvasState, Color, LayerType, Point } from "@/types/canvas";
import { penPointsToPathLayer } from "@/lib/utils";
import { MAX_LAYERS } from "@/lib/document-version";
import { BoardStore } from "@/store/use-board-store";

const CAPACITY_NOTICE = `This board is full: it can hold at most ${MAX_LAYERS} objects.`;

export function useCanvasContentActions(
    canvasState: CanvasState,
    setCanvasState: (state: CanvasState) => void,
    lastUsedColor: Color,
    store: BoardStore
) {
    const insertLayer = useMutation((
        { storage, setMyPresence },
        layerType: LayerType.Ellipse | LayerType.Rectangle | LayerType.Text | LayerType.Note,
        position: Point
    ) => {
        const liveLayers = storage.get("layers");
        if (liveLayers.size >= MAX_LAYERS) {
            store.refuse(CAPACITY_NOTICE);
            setCanvasState({ mode: CanvasMode.None });
            return;
        }

        const liveLayerIds = storage.get("layerIds");
        const layerId = nanoid();
        liveLayerIds.push(layerId);
        liveLayers.set(layerId, new LocalObject({
            type: layerType,
            x: position.x,
            y: position.y,
            height: 100,
            width: 100,
            fill: lastUsedColor,
        }));
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
        setCanvasState({ mode: CanvasMode.None });
    }, [lastUsedColor]);

    const continueDrawing = useMutation(({ setMyPresence, self }, point: Point, event: React.PointerEvent) => {
        const { pencilDraft } = self.presence;
        if (canvasState.mode !== CanvasMode.Pencil || event.buttons !== 1 || pencilDraft == null) return;

        setMyPresence({
            cursor: point,
            pencilDraft: pencilDraft.length === 1 && pencilDraft[0][0] === point.x && pencilDraft[0][1] === point.y
                ? pencilDraft
                : [...pencilDraft, [point.x, point.y, event.pressure]],
        });
    }, [canvasState.mode]);

    const insertPath = useMutation(({ storage, self, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const { pencilDraft } = self.presence;
        if (pencilDraft == null || pencilDraft.length < 2) {
            setMyPresence({ pencilDraft: null });
            return;
        }
        if (liveLayers.size >= MAX_LAYERS) {
            store.refuse(CAPACITY_NOTICE);
            setMyPresence({ pencilDraft: null });
            return;
        }

        const id = nanoid();
        liveLayers.set(id, new LocalObject(penPointsToPathLayer(pencilDraft, lastUsedColor)));
        storage.get("layerIds").push(id);
        setMyPresence({ pencilDraft: null });
        setCanvasState({ mode: CanvasMode.Pencil });
    }, [lastUsedColor]);

    const startDrawing = useMutation(({ setMyPresence }, point: Point, pressure: number) => {
        setMyPresence({ pencilDraft: [[point.x, point.y, pressure]], penColor: lastUsedColor });
    }, [lastUsedColor]);

    return { insertLayer, continueDrawing, insertPath, startDrawing };
}
