/**
 * Board document schema: the current version, its validation boundary and the
 * shared object relations (stable IDs, optional parents, own lock bits).
 * Pure functions only, so server routes and the browser store share one rule.
 */
import type { BoardDocument } from "../types/board";
import { LayerType, type Layer } from "../types/canvas";

/** Schema this application writes. Adding a layer type or field bumps it and adds an upgrade step. */
export const CURRENT_SCHEMA_VERSION = 2;
/** Documents saved before explicit versioning have no schemaVersion field. */
export const LEGACY_SCHEMA_VERSION = 1;
/**
 * Most layers one board may hold; the editor and the server enforce the same bound.
 * Set from the T07 browser measurement (ARCH.md, "Measured browser capacity").
 */
export const MAX_LAYERS = 5000;
const MAX_PATH_POINTS = 100000;
const SUPPORTED_LAYER_TYPES = new Set<number>([
    LayerType.Rectangle, LayerType.Ellipse, LayerType.Path, LayerType.Text, LayerType.Note,
]);

export type DocumentErrorCode =
    | "invalid-schema"
    | "unsupported-version"
    | "unsupported-record"
    | "duplicate-id"
    | "missing-reference"
    | "cycle";

/** A document this version refuses, with a code that separates the kinds of refusal. */
export class DocumentError extends Error {
    constructor(public readonly code: DocumentErrorCode, message: string) {
        super(message);
        this.name = "DocumentError";
    }
}

function fail(code: DocumentErrorCode, message: string): never {
    throw new DocumentError(code, message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function createEmptyDocument(): BoardDocument {
    return { schemaVersion: CURRENT_SCHEMA_VERSION, layerIds: [], layers: {} };
}

function isColor(value: unknown): boolean {
    return isRecord(value) &&
        [value.r, value.g, value.b].every(v => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255);
}

function isStroke(points: unknown): boolean {
    return Array.isArray(points) && points.length >= 2 && points.length <= MAX_PATH_POINTS &&
        points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
}

function validateLayer(id: string, value: unknown) {
    if (!isRecord(value) || !Number.isInteger(value.type)) fail("invalid-schema", `Layer ${id} has no numeric type`);
    if (!SUPPORTED_LAYER_TYPES.has(value.type as number)) {
        fail("unsupported-record", `Layer ${id} has unsupported type ${value.type}`);
    }
    const layer = value as Layer;
    if (![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) ||
        layer.width < 0 || layer.height < 0 || !isColor(layer.fill) ||
        (layer.value !== undefined && typeof layer.value !== "string")) {
        fail("invalid-schema", `Layer ${id} has invalid geometry, fill or content`);
    }
    if (layer.type === LayerType.Path && !isStroke(layer.points)) fail("invalid-schema", `Layer ${id} has an invalid stroke`);
    if (layer.parentId !== undefined && (typeof layer.parentId !== "string" || !layer.parentId)) {
        fail("invalid-schema", `Layer ${id} has an invalid parent ID`);
    }
    if (layer.locked !== undefined && typeof layer.locked !== "boolean") {
        fail("invalid-schema", `Layer ${id} has a non-boolean lock`);
    }
}

/** Validates a current-version document. Older versions go through upgradeDocument first. */
export function validateDocument(value: unknown): BoardDocument {
    if (!isRecord(value)) fail("invalid-schema", "Document must be a JSON object");
    if (value.schemaVersion !== CURRENT_SCHEMA_VERSION) {
        fail("unsupported-version", `Expected schema version ${CURRENT_SCHEMA_VERSION}`);
    }
    const { layerIds, layers } = value;
    if (!Array.isArray(layerIds) || !isRecord(layers)) fail("invalid-schema", "Document needs layerIds and layers");
    if (layerIds.length > MAX_LAYERS) fail("invalid-schema", `Boards hold at most ${MAX_LAYERS} objects`);
    const ordered = new Set<string>();
    for (const id of layerIds) {
        if (typeof id !== "string" || !id) fail("invalid-schema", "Layer IDs must be non-empty strings");
        if (ordered.has(id)) fail("duplicate-id", `Layer ${id} appears more than once in the paint order`);
        ordered.add(id);
        if (!Object.hasOwn(layers, id)) fail("missing-reference", `Paint order references missing layer ${id}`);
        validateLayer(id, layers[id]);
    }
    for (const id of Object.keys(layers)) {
        if (!ordered.has(id)) fail("missing-reference", `Layer ${id} is missing from the paint order`);
    }
    const document = value as BoardDocument;
    assertRelations(document);
    return document;
}

/** Rejects parent references to missing layers and parent cycles, including self-parents. */
export function assertRelations(document: BoardDocument) {
    const resolved = new Set<string>();
    for (const id of document.layerIds) {
        const chain = new Set<string>();
        for (let current: string | undefined = id; current !== undefined && !resolved.has(current);) {
            if (chain.has(current)) fail("cycle", `Parent cycle through layer ${current}`);
            chain.add(current);
            const layer: Layer | undefined = document.layers[current];
            if (!layer) fail("missing-reference", `Layer ${current} does not exist`);
            if (layer.parentId !== undefined && !Object.hasOwn(document.layers, layer.parentId)) {
                fail("missing-reference", `Layer ${current} references missing parent ${layer.parentId}`);
            }
            current = layer.parentId;
        }
        chain.forEach(visited => resolved.add(visited));
    }
}

/**
 * True when the layer or any ancestor has its own lock bit set. Inherited
 * protection is computed here and never copied into descendants' lock bits.
 * Expects a document whose relations passed assertRelations.
 */
export function isEffectivelyLocked(document: BoardDocument, id: string): boolean {
    for (let current: string | undefined = id; current !== undefined; current = document.layers[current]?.parentId) {
        if (document.layers[current]?.locked) return true;
    }
    return false;
}
