import { Skeleton } from "@/components/ui/skeleton";
import { ToolButton } from "./tool-button";
import {
    Circle,
    Code2,
    ImagePlus,
    MousePointer2,
    Pencil,
    Redo2,
    Square,
    StickyNote,
    TypeIcon,
    Undo2,
} from "lucide-react";
import { CanvasMode, CanvasState, LayerType } from "@/types/canvas";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSelf } from "@/hooks/use-local-board";

interface ToolbarProps {
    canvasState: CanvasState;
    setCanvasState: (newState: CanvasState) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onImportImage: (file: File) => Promise<void>;
}

const Toolbar = ({
    canvasState,
    setCanvasState,
    undo,
    redo,
    canUndo,
    canRedo,
    onImportImage,
}: ToolbarProps) => {
    const selection = useSelf((me) => me.presence.selection);
    const imageInput = useRef<HTMLInputElement>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [isImportingImage, setIsImportingImage] = useState(false);

    const importImage = useCallback(async (file: File) => {
        setImageError(null);
        setIsImportingImage(true);
        try {
            await onImportImage(file);
        } catch (error) {
            setImageError(error instanceof Error ? error.message : "Unable to add this image.");
        } finally {
            setIsImportingImage(false);
        }
    }, [onImportImage]);

    const onImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void importImage(file);
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (selection?.length > 0 || target.isContentEditable || target.closest("input, textarea")) return;
            if ((e.ctrlKey || e.metaKey) && ["a", "t", "n", "r", "e"].includes(e.key.toLowerCase())) e.preventDefault();
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") e.preventDefault();
            switch (e.key.toLowerCase()) {
                case "a":
                    if (e.ctrlKey || e.metaKey) setCanvasState({ mode: CanvasMode.None });
                    break;

                case "t":
                    if (e.ctrlKey || e.metaKey)
                        setCanvasState({
                            layerType: LayerType.Text,
                            mode: CanvasMode.Inserting,
                        });
                    break;

                case "c":
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey)
                        setCanvasState({ mode: CanvasMode.Inserting, layerType: LayerType.Text, codeBlock: true });
                    break;

                case "n":
                    if (e.ctrlKey || e.metaKey)
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Note,
                        });
                    break;

                case "r":
                    if (e.ctrlKey || e.metaKey)
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Rectangle,
                        });
                    break;

                case "e":
                    if (e.ctrlKey || e.metaKey)
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Ellipse,
                        });
                    break;

                default:
                    break;
            }
        };

        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [selection, setCanvasState]);

    useEffect(() => {
        const onPaste = (event: ClipboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.isContentEditable || target?.closest("input, textarea")) return;
            const image = Array.from(event.clipboardData?.items ?? [])
                .find(item => item.kind === "file" && item.type.startsWith("image/"))
                ?.getAsFile();
            if (!image) return;
            event.preventDefault();
            void importImage(image);
        };
        document.addEventListener("paste", onPaste);
        return () => document.removeEventListener("paste", onPaste);
    }, [importImage]);

    return (
        <div className="absolute top-[50%] -translate-y-[50%] left-2 flex flex-col gap-y-4">
            <div className="bg-white rounded-md p-1.5 flex gap-1 flex-col items-center shadow-md">
                <ToolButton
                    label="Select (Ctrl+A)"
                    icon={MousePointer2}
                    onClick={() => setCanvasState({ mode: CanvasMode.None })}
                    isActive={
                        canvasState.mode === CanvasMode.None ||
                        canvasState.mode === CanvasMode.Translating ||
                        canvasState.mode === CanvasMode.SelectionNet ||
                        canvasState.mode === CanvasMode.Pressing ||
                        canvasState.mode === CanvasMode.Resizing
                    }
                />
                <ToolButton
                    label="Text (Ctrl+T)"
                    icon={TypeIcon}
                    onClick={() =>
                        setCanvasState({
                            layerType: LayerType.Text,
                            mode: CanvasMode.Inserting,
                        })
                    }
                    isActive={
                        canvasState.mode === CanvasMode.Inserting &&
                        canvasState.layerType === LayerType.Text && !canvasState.codeBlock
                    }
                />
                <ToolButton
                    label="Code block (Ctrl+Shift+C)"
                    icon={Code2}
                    onClick={() => setCanvasState({ mode: CanvasMode.Inserting, layerType: LayerType.Text, codeBlock: true })}
                    isActive={canvasState.mode === CanvasMode.Inserting && canvasState.codeBlock === true}
                />
                <ToolButton
                    label="Sticky Note (Ctrl+N)"
                    icon={StickyNote}
                    onClick={() =>
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Note,
                        })
                    }
                    isActive={
                        canvasState.mode === CanvasMode.Inserting &&
                        canvasState.layerType === LayerType.Note
                    }
                />
                <ToolButton
                    label="Rectangle (Ctrl+R)"
                    icon={Square}
                    onClick={() =>
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Rectangle,
                        })
                    }
                    isActive={
                        canvasState.mode === CanvasMode.Inserting &&
                        canvasState.layerType === LayerType.Rectangle
                    }
                />
                <ToolButton
                    label="Ellipse (Ctrl+E)"
                    icon={Circle}
                    onClick={() =>
                        setCanvasState({
                            mode: CanvasMode.Inserting,
                            layerType: LayerType.Ellipse,
                        })
                    }
                    isActive={
                        canvasState.mode === CanvasMode.Inserting &&
                        canvasState.layerType === LayerType.Ellipse
                    }
                />
                <ToolButton
                    label="Pen"
                    icon={Pencil}
                    onClick={() =>
                        setCanvasState({
                            mode: CanvasMode.Pencil,
                        })
                    }
                    isActive={canvasState.mode === CanvasMode.Pencil}
                />
                <ToolButton
                    label="Add image"
                    icon={ImagePlus}
                    onClick={() => imageInput.current?.click()}
                    isDisabled={isImportingImage}
                />
                <input
                    ref={imageInput}
                    aria-label="Choose image file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={onImageInputChange}
                    type="file"
                />
            </div>
            <div className="bg-white rounded-md p-1.5 flex flex-col items-center shadow-md">
                <ToolButton
                    label="Undo (Ctrl+Z)"
                    icon={Undo2}
                    onClick={undo}
                    isDisabled={!canUndo}
                />
                <ToolButton
                    label="Redo (Ctrl+Shift+Z)"
                    icon={Redo2}
                    onClick={redo}
                    isDisabled={!canRedo}
                />
            </div>
            {imageError && (
                <div role="alert" className="absolute left-16 top-0 z-50 max-w-80 rounded-md bg-white px-3 py-2 text-sm text-destructive shadow-md">
                    {imageError}
                </div>
            )}
        </div>
    );
};

export const ToolbarSkeleton = () => {
    return (
        <div className="absolute top-[50%] -translate-y-[50%] left-2 flex flex-col gap-y-4 rounded-md animate-shimmer bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 bg-[length:200%_100%] h-[360px] w-[52px]">
            <Skeleton />
        </div>
    );
};

export default Toolbar;
