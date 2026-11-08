export type Color = {
    r: number;
    g: number;
    b: number;
};

export type Camera = {
    x: number;
    y: number;
};

/** Relation and protection fields shared by every layer type (document schema v2). */
export type ObjectRelations = {
    /** Containing object; absent means the layer sits at the board root. */
    parentId?: string;
    /** The layer's own lock bit. Effective protection also inherits from every ancestor. */
    locked?: boolean;
};

/** Stored numeric values; append new types only, never renumber. */
export enum LayerType {
    Rectangle,
    Ellipse,
    Path,
    Text,
    Note,
}

export type RectangleLayer = ObjectRelations & {
    type: LayerType.Rectangle;
    x: number;
    y: number;
    height: number;
    width: number;
    fill: Color;
    value?: string;
};

export type EllipseLayer = ObjectRelations & {
    type: LayerType.Ellipse;
    x: number;
    y: number;
    height: number;
    width: number;
    fill: Color;
    value?: string;
};

export type PathLayer = ObjectRelations & {
    type: LayerType.Path;
    x: number;
    y: number;
    height: number;
    width: number;
    fill: Color;
    points: number[][];
    value?: string;
};

export type TextLayer = ObjectRelations & {
    type: LayerType.Text;
    x: number;
    y: number;
    height: number;
    width: number;
    fill: Color;
    value?: string;
};

export type NoteLayer = ObjectRelations & {
    type: LayerType.Note;
    x: number;
    y: number;
    height: number;
    width: number;
    fill: Color;
    value?: string;
};

export type Point = {
    x: number;
    y: number;
};

export type XYWH = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export enum Side {
    Top = 1,
    Bottom = 2,
    Left = 4,
    Right = 8,
}

export type CanvasState =
    | {
          mode: CanvasMode.None;
      }
    | {
          mode: CanvasMode.SelectionNet;
          origin: Point;
          current?: Point;
      }
    | {
          mode: CanvasMode.Translating;
          current: Point;
      }
    | {
          mode: CanvasMode.Inserting;
          layerType:
              | LayerType.Ellipse
              | LayerType.Rectangle
              | LayerType.Text
              | LayerType.Note;
      }
    | {
          mode: CanvasMode.Pencil;
      }
    | {
          mode: CanvasMode.Pressing;
          origin: Point;
      }
    | {
          mode: CanvasMode.Resizing;
          initialBounds: XYWH;
          corner: Side;
      };

export enum CanvasMode {
    None,
    SelectionNet,
    Translating,
    Inserting,
    Pencil,
    Pressing,
    Resizing,
}

export type Layer =
    | RectangleLayer
    | EllipseLayer
    | PathLayer
    | TextLayer
    | NoteLayer;
