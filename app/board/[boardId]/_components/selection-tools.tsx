"use client";

import { useSelectionBounds } from "@/hooks/use-selection-bounds";
import { useMutation, useSelf, useStorage } from "@/hooks/use-local-board";
import { Camera, Color, LayerType } from "@/types/canvas";
import { memo } from "react";
import { ColorPicker } from "./color-picker";
import { useDeleteLayers } from "@/hooks/use-delete-layers";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { BringToFront, Copy, SendToBack, Trash2 } from "lucide-react";
import { BringToFrontIcon, SendToBackIcon } from "@/components/icon";

interface SelectionToolsProps {
    camera: Camera;
    setLastUsedColor: (color: Color) => void;
    onDuplicate: () => void;
    lastUsedColor: Color;
}

export const SelectionTools = memo(
    ({ camera, setLastUsedColor, onDuplicate, lastUsedColor }: SelectionToolsProps) => {
        const selection = useSelf((me) => me.presence.selection);
        const selectedFrames = useStorage(root => selection.filter(id => root.layers.get(id)?.type === LayerType.Frame));
        const selectedParentId = useStorage(root => {
            const parents = selection.map(id => root.layers.get(id)?.parentId);
            if (!parents.length || parents.some(parentId => parentId !== parents[0])) return null;
            return parents[0] ?? "";
        });
        const frames = useStorage(root => root.layerIds.flatMap(id => {
            const layer = root.layers.get(id);
            return layer?.type === LayerType.Frame ? [{ id, name: layer.name, parentId: layer.parentId }] : [];
        }));
        const activeFrameId = selectedFrames.length === 1 ? selectedFrames[0] : null;
        const activeFrameName = useStorage(root => {
            const layer = activeFrameId ? root.layers.get(activeFrameId) : undefined;
            return layer?.type === LayerType.Frame ? layer.name : undefined;
        });
        const assignToFrame = useMutation(({ storage }, targetId: string) => {
            if (!selection.length) return;
            const target = targetId || undefined;
            if (targetId === "__mixed__") return;
            const layers = storage.get("layers");
            for (const id of selection) {
                if (id === target) continue;
                layers.get(id)?.set("parentId", target);
            }
        }, [selection]);
        const renameFrame = useMutation(({ storage }, name: string) => {
            if (activeFrameId && name.trim()) storage.get("layers").get(activeFrameId)?.set("name", name.trim());
        }, [activeFrameId]);
        const containsImage = useStorage((root) =>
            selection.some(id => root.layers.get(id)?.type === LayerType.Image)
        );

        const moveToFront = useMutation(
            ({ storage }) => {
                const liveLayerIds = storage.get("layerIds");
                const indices: number[] = [];
                const arr = liveLayerIds.toImmutable();

                for (let i = 0; i < arr.length; i++) {
                    if (selection.includes(arr[i])) {
                        indices.push(i);
                    }
                }

                for (let i = indices.length - 1; i >= 0; i--) {
                    liveLayerIds.move(
                        indices[i],
                        arr.length - 1 - (indices.length - 1 - i)
                    );
                }
            },
            [selection]
        );

        const moveToBack = useMutation(
            ({ storage }) => {
                const liveLayerIds = storage.get("layerIds");
                const indices: number[] = [];
                const arr = liveLayerIds.toImmutable();

                for (let i = 0; i < arr.length; i++) {
                    if (selection.includes(arr[i])) {
                        indices.push(i);
                    }
                }

                for (let i = 0; i < indices.length; i++) {
                    liveLayerIds.move(indices[i], i);
                }
            },
            [selection]
        );

        const setFill = useMutation(
            ({ storage }, fill: Color) => {
                const liveLayers = storage.get("layers");
                setLastUsedColor(fill);
                if (!selection) {
                    return;
                }
                selection.forEach((id) => {
                    const layer = liveLayers.get(id);
                    if (layer?.get("type") !== LayerType.Image && layer?.get("type") !== LayerType.Frame) layer?.set("fill", fill);
                });
            },
            [selection, setLastUsedColor]
        );

        const deleteLayers = useDeleteLayers();

        const selectionBounds = useSelectionBounds();

        if (!selectionBounds) {
            return null;
        }

        const x = (selectionBounds.width / 2 + selectionBounds.x) * camera.zoom + camera.x;
        const y = selectionBounds.y * camera.zoom + camera.y;

        return (
            <div
                className="absolute p-3 rounded-xl bg-white shadow-sm border flex select-none"
                style={{
                    transform: `translate(
                    calc(${x}px - 50%),
                    calc(${y - 16}px - 100%)
                )`,
                }}
            >
                {!containsImage && <ColorPicker onChange={setFill} lastUsedColor={lastUsedColor} />}
                {activeFrameId && <input aria-label="Frame name" className="h-10 w-32 border rounded px-2 text-sm" value={activeFrameName ?? ""} onChange={event => renameFrame(event.target.value)} />}
                {frames.length > 0 && <select aria-label="Containing frame" className="h-10 max-w-40 border rounded px-2 text-sm"
                    value={selectedParentId ?? "__mixed__"} onChange={event => assignToFrame(event.currentTarget.value)}>
                    {selectedParentId === null && <option value="__mixed__" disabled>Multiple frames</option>}
                    <option value="">Board root</option>
                    {frames.filter(frame => !selection.includes(frame.id) && !selection.some(selectedId => {
                        let parentId: string | undefined = frame.parentId;
                        while (parentId) {
                            if (parentId === selectedId) return true;
                            parentId = frames.find(candidate => candidate.id === parentId)?.parentId;
                        }
                        return false;
                    })).map(frame => <option key={frame.id} value={frame.id}>{frame.name}</option>)}
                </select>}
                <div className="flex flex-col gap-y-0.5">
                    <Hint label="Bring to front">
                        <Button
                            onClick={moveToFront}
                            variant="board"
                            size="icon"
                        >
                            <BringToFrontIcon
                                color="black"
                                height={30}
                                width={30}
                            />
                        </Button>
                    </Hint>
                    <Hint label="Send to back" side="bottom">
                        <Button
                            onClick={moveToBack}
                            variant="board"
                            size="icon"
                        >
                            <SendToBackIcon
                                color="black"
                                height={30}
                                width={30}
                            />
                        </Button>
                    </Hint>
                </div>
                <div className="flex flex-col items-center pl-2 ml-2 border-l border-neutral-200">
                    <Hint label="Duplicate (ctrl + D)">
                        <Button
                            onClick={onDuplicate}
                            variant="board"
                            size="icon"
                        >
                            <Copy />
                        </Button>
                    </Hint>
                    <Hint label="Delete" side="bottom">
                        <Button
                            variant="boardDestructive"
                            size="icon"
                            onClick={deleteLayers}
                        >
                            <Trash2 />
                        </Button>
                    </Hint>
                </div>
            </div>
        );
    }
);

SelectionTools.displayName = "SelectionTools";
