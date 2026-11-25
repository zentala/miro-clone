import { nanoid } from "nanoid";
import { useMutation } from "@/hooks/use-local-board";
import { LocalObject } from "@/store/use-board-store";
import { CanvasMode, CanvasState, Color, LayerType, Point } from "@/types/canvas";
import { penPointsToPathLayer } from "@/lib/utils";
import { MAX_LAYERS } from "@/lib/document-version";
import { BoardStore } from "@/store/use-board-store";
import type { AssetMetadata } from "@/types/asset";

const CAPACITY_NOTICE = `This board is full: it can hold at most ${MAX_LAYERS} objects.`;
const MAX_IMAGE_EDGE = 800;

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

    const insertImage = useMutation((
        { storage, setMyPresence },
        asset: Pick<AssetMetadata, "id" | "width" | "height">,
        center: Point
    ) => {
        const liveLayers = storage.get("layers");
        if (liveLayers.size >= MAX_LAYERS) {
            store.refuse(CAPACITY_NOTICE);
            return false;
        }

        const scale = Math.min(1, MAX_IMAGE_EDGE / asset.width, MAX_IMAGE_EDGE / asset.height);
        const width = asset.width * scale;
        const height = asset.height * scale;
        const id = nanoid();
        liveLayers.set(id, new LocalObject({
            type: LayerType.Image,
            x: center.x - width / 2,
            y: center.y - height / 2,
            width,
            height,
            assetId: asset.id,
        }));
        storage.get("layerIds").push(id);
        setMyPresence({ selection: [id] }, { addToHistory: true });
        setCanvasState({ mode: CanvasMode.None });
        return true;
    }, [setCanvasState, store]);

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

    return { insertLayer, insertImage, continueDrawing, insertPath, startDrawing };
}
