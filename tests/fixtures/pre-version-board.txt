import type { Layer } from "./canvas";

export type BoardDocument = { layerIds: string[]; layers: Record<string, Layer> };
export type Board = {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    document: BoardDocument;
};

export function validateTitle(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 60) {
        throw new Error("Title must contain 1–60 characters");
    }
    return value.trim();
}

export function validateDocument(value: unknown): BoardDocument {
    if (!value || typeof value !== "object") throw new Error("Invalid document");
    const doc = value as BoardDocument;
    if (!Array.isArray(doc.layerIds) || doc.layerIds.length > 100 ||
        !doc.layers || typeof doc.layers !== "object" || Array.isArray(doc.layers) ||
        new Set(doc.layerIds).size !== doc.layerIds.length ||
        Object.keys(doc.layers).length !== doc.layerIds.length) throw new Error("Invalid layers");
    for (const id of doc.layerIds) {
        if (typeof id !== "string" || !Object.hasOwn(doc.layers, id)) throw new Error("Invalid layer id");
        const layer = doc.layers[id];
        if (!layer || !Number.isInteger(layer.type) || layer.type < 0 || layer.type > 4 ||
            ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) ||
            layer.width < 0 || layer.height < 0 || !layer.fill ||
            ![layer.fill.r, layer.fill.g, layer.fill.b].every(v => Number.isInteger(v) && v >= 0 && v <= 255) ||
            (layer.value !== undefined && typeof layer.value !== "string")) throw new Error("Invalid layer");
        if (layer.type === 2 && (!Array.isArray(layer.points) || layer.points.length < 2 ||
            layer.points.length > 100000 || !layer.points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)))) {
            throw new Error("Invalid stroke");
        }
    }
    return doc;
}
