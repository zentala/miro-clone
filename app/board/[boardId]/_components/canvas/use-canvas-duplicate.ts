import { nanoid } from "nanoid";
import { useMutation } from "@/hooks/use-local-board";
import { useLocalBoard } from "@/hooks/use-local-board";
import { CanvasMode, CanvasState } from "@/types/canvas";
import { MAX_LAYERS } from "@/lib/document-version";

const CAPACITY_NOTICE = `This board is full: it can hold at most ${MAX_LAYERS} objects.`;

export function useCanvasDuplicate(setCanvasState: (state: CanvasState) => void) {
    const store = useLocalBoard();
    return useMutation(({ storage, self, setMyPresence }) => {
        const liveLayers = storage.get("layers");
        const liveLayerIds = storage.get("layerIds");
        const newLayerIds: string[] = [];
        const layersIdsToCopy = self.presence.selection;

        if (liveLayerIds.length + layersIdsToCopy.length > MAX_LAYERS) {
            store.refuse(CAPACITY_NOTICE);
            return;
        }
        if (layersIdsToCopy.length === 0) return;

        for (const layerId of layersIdsToCopy) {
            const newLayerId = nanoid();
            const layer = liveLayers.get(layerId);
            if (!layer) continue;
            const newLayer = layer.clone();
            newLayer.set("x", newLayer.get("x") + 10);
            newLayer.set("y", newLayer.get("y") + 10);
            liveLayerIds.push(newLayerId);
            liveLayers.set(newLayerId, newLayer);
            newLayerIds.push(newLayerId);
        }

        setMyPresence({ selection: newLayerIds }, { addToHistory: true });
        setCanvasState({ mode: CanvasMode.None });
    }, []);
}
