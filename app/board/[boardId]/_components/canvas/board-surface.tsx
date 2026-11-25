"use client";

import Info from "../info";
import Toolbar from "../toolbar";
import { CanvasMode, CanvasState } from "@/types/canvas";
import { LayerPreview } from "../layer-preview";
import { SelectionBox } from "../selection-box";
import { SelectionTools } from "../selection-tools";
import { Path } from "../path";
import { ResetCamera } from "../reset-camera";
import { ZoomControls } from "../zoom-controls";
import { gridBackground } from "../board-grid";
import { isDefaultCamera, colorToCss } from "@/lib/utils";
import { CameraZoomContext } from "../image";
import type { Camera, Color, Side, XYWH } from "@/types/canvas";
import type { RefObject } from "react";

interface BoardSurfaceProps {
    boardId: string;
    svgRef: RefObject<SVGSVGElement>;
    layerIds: readonly string[];
    canvasState: CanvasState;
    setCanvasState: (state: CanvasState) => void;
    camera: Camera;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    resetCamera: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    lastUsedColor: Color;
    setLastUsedColor: (color: Color) => void;
    onDuplicate: () => void;
    pencilDraft: [number, number, number][] | null;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerLeave: () => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerDown: (event: React.PointerEvent) => void;
    onLayerPointerDown: (event: React.PointerEvent, layerId: string) => void;
    onResizeHandlePointerDown: (corner: Side, bounds: XYWH) => void;
    exportAsPng: () => void;
    onImportImage: (file: File) => Promise<void>;
}

export function BoardSurface({
    boardId,
    svgRef,
    layerIds,
    canvasState,
    setCanvasState,
    camera,
    zoomIn,
    zoomOut,
    resetZoom,
    resetCamera,
    canUndo,
    canRedo,
    undo,
    redo,
    lastUsedColor,
    setLastUsedColor,
    onDuplicate,
    pencilDraft,
    onPointerMove,
    onPointerLeave,
    onPointerUp,
    onPointerDown,
    onLayerPointerDown,
    onResizeHandlePointerDown,
    exportAsPng,
    onImportImage,
}: BoardSurfaceProps) {
    return (
        <main className="h-full w-full relative bg-neutral-100 touch-none" style={gridBackground(camera)}>
            <Info boardId={boardId} exportAsPng={exportAsPng} />
            <Toolbar canvasState={canvasState} setCanvasState={setCanvasState} canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} onImportImage={onImportImage} />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
                {!isDefaultCamera(camera) && <ResetCamera resetCamera={resetCamera} />}
                <ZoomControls zoom={camera.zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom} />
            </div>
            <SelectionTools onDuplicate={onDuplicate} camera={camera} setLastUsedColor={setLastUsedColor} lastUsedColor={lastUsedColor} />
            <svg
                ref={svgRef}
                className="h-[100vh] w-[100vw]"
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerUp={onPointerUp}
                onPointerDown={onPointerDown}
            >
                <g data-board-camera="true" transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
                    <CameraZoomContext.Provider value={camera.zoom}>
                        <g data-board-layers="true">
                            {layerIds.map((layerId) => (
                                <LayerPreview key={layerId} id={layerId} onLayerPointerDown={onLayerPointerDown} />
                            ))}
                        </g>
                    </CameraZoomContext.Provider>
                    <g data-editor-overlay="true">
                        <SelectionBox onResizeHandlePointerDown={onResizeHandlePointerDown} zoom={camera.zoom} />
                    </g>
                    {canvasState.mode === CanvasMode.SelectionNet && canvasState.current && (
                        <rect
                            className="fill-blue-500/5 stroke-blue-500 stroke-1"
                            vectorEffect="non-scaling-stroke"
                            x={Math.min(canvasState.origin.x, canvasState.current.x)}
                            y={Math.min(canvasState.origin.y, canvasState.current.y)}
                            width={Math.abs(canvasState.origin.x - canvasState.current.x)}
                            height={Math.abs(canvasState.origin.y - canvasState.current.y)}
                        />
                    )}
                    {pencilDraft && pencilDraft.length > 0 && (
                        <Path points={pencilDraft} fill={colorToCss(lastUsedColor)} x={0} y={0} />
                    )}
                </g>
            </svg>
        </main>
    );
}
