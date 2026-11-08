/**
 * Normalizes a structural Miro export into a portable migration package.
 *
 * Pure and deterministic: no I/O, no clock, no board access. Every input record
 * becomes exactly one item (supported, transformed, unknown or failed) that
 * keeps its raw source record. Markup is flagged, never rendered or sanitized:
 * the importer (E001-T17) sanitizes it with the E001-T10 sanitizer.
 * Imports use `.ts` paths so Node runs this file directly (type stripping).
 */
import type {
    EditorSupport, ErrorCode, ExportPackage, ExportRecord, MigrationAsset, MigrationItem, MigrationLoss,
    MigrationPackage, PortableKind, RecordStatus,
} from "../../types/migration.ts";
import { createGeometryIndex, resolveWorld, type GeometryIndex, type Problem } from "./geometry.ts";

const SOURCE_FORMAT = "miro-clone.structural-export";
const NORMALIZER = { name: "miro-clone/lib/migration/normalize", version: "1.0.0" };
const SANITIZE_AT = "import (E001-T17) with the E001-T10 sanitizer";

const KIND_BY_TYPE: Record<string, PortableKind> = {
    sticky_note: "note", text: "text", shape: "shape", card: "card", app_card: "card", image: "image",
    embed: "embed", preview: "link-preview", frame: "frame", connector: "connector", group: "group",
    tag: "tag", mindmap_node: "mindmap-node",
};

const support = (status: EditorSupport["status"], task: string | null, detail: string) => ({ status, task, detail });
const SUPPORT: Record<PortableKind, EditorSupport> = {
    note: support("current", null, "Note layer."),
    text: support("current", null, "Text layer."),
    shape: support("none", null, "Shape kind has no editor layer; the shape name is kept."),
    card: support("planned", "E001-T12", "Card fields are kept; no card layer yet."),
    image: support("planned", "E001-T04", "No image layer or durable asset store yet; asset URL is kept."),
    embed: support("planned", "E001-T12", "No embed player is planned; the URL is kept for a link card."),
    "link-preview": support("planned", "E001-T12", "No website/product card layer yet; the exact URL is kept."),
    frame: support("planned", "E001-T08", "No frame layer yet; geometry and children are kept."),
    connector: support("none", null, "No connector model is planned in E001; endpoints, captions and style are kept."),
    group: support("planned", "E001-T08", "Group-vs-frame semantics are unresolved; membership is kept."),
    tag: support("none", null, "No tag model is planned in E001; tag records and item tagIds are kept."),
    "mindmap-node": support("none", null, "No mind map model is planned; the raw record is kept."),
};
const EDITOR_SHAPES: Record<string, string> = { rectangle: "Rectangle layer.", circle: "Ellipse layer." };

/** What a person does to fix each error. Raw records always stay in the package. */
const ACTIONS: Record<ErrorCode, string> = {
    "export-failed": "Fix the item in Miro or re-export; the raw record is retained for manual recovery.",
    "duplicate-id": "Re-export; if it persists, rename the ID in a copy of the export, never the original.",
    "parent-cycle": "Clear parentId on one record of the cycle in a copy of the export (never the original), or fix the frames in Miro and re-export.",
    "missing-parent": "Re-export the board including the parent frame; the raw record is retained for recovery.",
    "parent-unresolved": "Fix the parent record's error first; this record follows.",
    "missing-asset": "Re-export the board or supply the image file; the raw record is retained.",
    "invalid-geometry": "Re-export the board with a supported SDK version; the raw record is retained.",
    "coverage-mismatch": "The export file is truncated or edited; export the board again.",
};

const MARKUP = /<\/?[a-z!?][^>]*>|&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;
const NOT_TEXT = new Set(["id", "type", "url", "previewUrl", "linkedTo", "origin", "relativeTo", "parentId", "groupId"]);

type Context = GeometryIndex & { items: MigrationItem[]; errors: MigrationPackage["errors"]; losses: MigrationLoss[] };

/** Thrown when the input is not a structural export package at all. */
export class InvalidPackageError extends Error {
    code = "invalid-package" as const;
}

function checkSource(input: unknown): ExportPackage {
    const pkg = input as ExportPackage;
    const isObject = (value: unknown) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
    if (!isObject(pkg)) throw new InvalidPackageError("Package is not a JSON object.");
    if (pkg.format !== SOURCE_FORMAT) throw new InvalidPackageError(`Expected format ${SOURCE_FORMAT}, found ${String(pkg.format)}.`);
    if (pkg.formatVersion !== 1) throw new InvalidPackageError(`Unsupported formatVersion ${String(pkg.formatVersion)}; expected 1.`);
    const notArray = (["records", "assets", "losses"] as const).find(key => !Array.isArray(pkg[key]));
    if (notArray) throw new InvalidPackageError(`Field "${notArray}" must be an array.`);
    if (!pkg.records.every(isObject)) throw new InvalidPackageError("Every entry in records must be an object.");
    return pkg;
}

function editorSupportFor(kind: PortableKind, raw: unknown): EditorSupport {
    if (kind !== "shape") return SUPPORT[kind];
    const shape = (raw as { shape?: unknown } | null)?.shape;
    if (typeof shape === "string" && Object.hasOwn(EDITOR_SHAPES, shape)) return support("current", null, EDITOR_SHAPES[shape]);
    return support("none", null, `Editor draws rectangle and ellipse only; shape "${String(shape)}" is kept by name.`);
}

/** Paths of string values that contain markup tags or character references. */
function markupPaths(value: unknown, path: string, out: string[]): string[] {
    if (typeof value === "string" && MARKUP.test(value)) out.push(path);
    else if (Array.isArray(value)) value.forEach((entry, index) => markupPaths(entry, `${path}[${index}]`, out));
    else if (value && typeof value === "object") {
        for (const [key, entry] of Object.entries(value)) if (!NOT_TEXT.has(key)) markupPaths(entry, path ? `${path}.${key}` : key, out);
    }
    return out;
}

function toItem(record: ExportRecord, index: number): MigrationItem {
    const type = typeof record.type === "string" ? record.type : null;
    const kind = type !== null && Object.hasOwn(KIND_BY_TYPE, type) ? KIND_BY_TYPE[type] : null;
    const fields = markupPaths(record.raw, "", []);
    return {
        sourceId: typeof record.id === "string" && record.id !== "" ? record.id : null, targetId: null,
        sourceIndex: index, sourceType: type,
        status: "supported", kind, editor: kind ? editorSupportFor(kind, record.raw) : null,
        sourceGeometry: record.geometry ?? null, world: null, relations: record.relations ?? null,
        urls: Array.isArray(record.urls) ? record.urls : [], assetIds: Array.isArray(record.assetIds) ? record.assetIds : [],
        markup: fields.length ? { fields, requiresSanitization: true } : null, transforms: [], raw: record.raw,
    };
}

function fail(item: MigrationItem, ctx: Context, { code, message }: Problem) {
    item.status = "failed";
    item.targetId = null;
    ctx.errors.push({ code, itemId: item.sourceId, sourceIndex: item.sourceIndex, message, action: ACTIONS[code] });
}

function hasAsset(item: MigrationItem, assets: Map<string, Record<string, unknown>>): boolean {
    return item.assetIds.length > 0 && item.assetIds.every(assetId => {
        const url = assets.get(assetId)?.url;
        return typeof url === "string" && url !== "";
    });
}

const loss = (item: MigrationItem, kind: string, detail: string): MigrationLoss =>
    ({ itemId: item.sourceId, type: item.sourceType, kind, detail, origin: "normalize" });

/** Decides one item's status, world geometry and target ID. */
function settle(item: MigrationItem, record: ExportRecord, ctx: Context, assets: Map<string, Record<string, unknown>>) {
    if (record.status === "failed" || item.sourceId === null) {
        return fail(item, ctx, { code: "export-failed", message: String(record.reason ?? "Record has no usable ID.") });
    }
    if (ctx.byId.get(item.sourceId) !== item) {
        return fail(item, ctx, { code: "duplicate-id", message: `Duplicate ID ${item.sourceId}; the first record keeps it.` });
    }
    const resolved = resolveWorld(item, ctx);
    if (resolved.problem) return fail(item, ctx, resolved.problem);
    item.world = resolved.world;
    item.transforms.push(...resolved.transforms);
    if (resolved.parentRotation) {
        ctx.losses.push(loss(item, "parent-rotation-ignored", `Parent is rotated ${resolved.parentRotation}°; the conversion ignored it.`));
    }
    if (item.kind === "image" && !hasAsset(item, assets)) {
        return fail(item, ctx, { code: "missing-asset", message: `Image ${item.sourceId} has no asset entry with a URL.` });
    }
    item.status = item.kind === null ? "unknown" : item.transforms.length ? "transformed" : "supported";
    item.targetId = `miro-${item.sourceId}`;
}

function itemLosses(item: MigrationItem): MigrationLoss[] {
    const out: MigrationLoss[] = [];
    if (item.markup) out.push(loss(item, "requires-sanitization", `Markup in ${item.markup.fields.join(", ")}; sanitize at ${SANITIZE_AT}.`));
    if (item.status === "failed") return out;
    const { editor, world } = item;
    if (editor && editor.status !== "current") {
        out.push(loss(item, "editor-support", `${editor.status}${editor.task ? ` (${editor.task})` : ""}: ${editor.detail}`));
    }
    if (world && world.rotation !== 0) out.push(loss(item, "rotation-unsupported", `Editor has no rotation; item is rotated ${world.rotation}°.`));
    return out;
}

/** Normalizes a parsed structural export package. Throws InvalidPackageError on a non-package. */
export function normalizeExport(input: unknown): MigrationPackage {
    const source = checkSource(input);
    const items = source.records.map(toItem);
    const byId = new Map<string, MigrationItem>();
    items.forEach((item, index) => {
        if (item.sourceId !== null && source.records[index].status !== "failed" && !byId.has(item.sourceId)) byId.set(item.sourceId, item);
    });
    const ctx: Context = { ...createGeometryIndex(byId), items, errors: [], losses: [] };
    const assetsById = new Map(source.assets.map(asset => [String(asset.assetId), asset]));
    items.forEach((item, index) => settle(item, source.records[index], ctx, assetsById));
    const total = source.coverage?.total;
    if (total !== undefined && total !== items.length) {
        const message = `Export reports ${String(total)} items but holds ${items.length} records.`;
        ctx.errors.push({ code: "coverage-mismatch", itemId: null, sourceIndex: null, message, action: ACTIONS["coverage-mismatch"] });
    }
    return assemble(source, ctx);
}

function assetsOf(source: ExportPackage, ctx: Context): MigrationAsset[] {
    return source.assets.map(asset => {
        const owner = ctx.byId.get(String(asset.itemId));
        const status = owner && owner.assetIds.includes(String(asset.assetId)) ? "referenced" : "orphan";
        return { ...asset, status } as MigrationAsset;
    });
}

function assemble(source: ExportPackage, ctx: Context): MigrationPackage {
    const assets = assetsOf(source, ctx);
    const orphans = assets.filter(asset => asset.status === "orphan").map((asset): MigrationLoss =>
        ({ itemId: asset.itemId, type: "image", kind: "orphan-asset", detail: `Asset ${asset.assetId} belongs to no record in the package.`, origin: "normalize" }));
    const byStatus: Record<RecordStatus, number> = { supported: 0, transformed: 0, unknown: 0, failed: 0 };
    const byKind: Record<string, number> = {};
    ctx.items.forEach(({ status, kind }) => {
        byStatus[status] += 1;
        byKind[kind ?? "(none)"] = (byKind[kind ?? "(none)"] ?? 0) + 1;
    });
    const mapped = ctx.items.filter(item => item.targetId).map(item => [item.sourceId as string, item.targetId as string]);
    mapped.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const exportLosses = source.losses.map((entry): MigrationLoss => ({ ...entry, origin: "export" }));
    return {
        format: "miro-clone.migration-package", formatVersion: 1, normalizer: { ...NORMALIZER },
        source: {
            format: source.format, formatVersion: source.formatVersion, exporter: source.exporter ?? null,
            exportedAt: source.exportedAt ?? null, api: source.source?.api ?? null, board: source.source?.board ?? null,
        },
        coordinates: { sourceConvention: source.coordinateConvention ?? null, ...structuredClone(COORDINATES) },
        valid: ctx.errors.length === 0, items: ctx.items, mapping: Object.fromEntries(mapped), assets, errors: ctx.errors,
        losses: [...exportLosses, ...structuredClone(GLOBAL_LOSSES), ...ctx.items.flatMap(itemLosses), ...ctx.losses, ...orphans],
        coverage: { total: ctx.items.length, byStatus, byKind },
        sanitization: { required: ctx.items.filter(item => item.markup).length, performedHere: false, at: SANITIZE_AT },
        fidelity: structuredClone(FIDELITY),
    };
}

const COORDINATES = {
    world: "Absolute board units; x grows right, y grows down; origin is the Miro board center. left/top = center minus half the size, which the editor stores as layer x/y.",
    screen: "Editor screen point = world point + camera offset (lib/utils.ts subtracts the camera from pointer coordinates; there is no zoom yet). Normalization never produces screen coordinates.",
    conversions: {
        canvas_center: "world center = (x, y)",
        parent_top_left: "world center = parent world top-left + (x, y)",
        parent_center: "world center = parent world center + (x, y); experimental in the SDK",
        missing: "relativeTo missing: canvas_center without a parent, parent_top_left with one; recorded as a transform",
    },
    assumptions: [
        "Axis direction: Miro y grows downward like the editor's SVG, so no axis flip is applied. NOT_CHECKED on a real board.",
        "Parent frames are not rotated; a rotated parent's rotation is ignored and reported as a loss.",
        "Miro REST coverage of groups and tags is not reverified; their handling rests on the Web SDK only.",
    ],
};

const GLOBAL_LOSSES: MigrationLoss[] = [
    { itemId: null, type: null, kind: "axis-direction-unverified", detail: COORDINATES.assumptions[0], origin: "normalize" },
    { itemId: null, type: null, kind: "rest-coverage-unverified", detail: COORDINATES.assumptions[2], origin: "normalize" },
];

const FIDELITY: MigrationPackage["fidelity"] = {
    realSource: { status: "NOT_CHECKED", detail: "No import or visual comparison against the source board has been performed." },
    syntheticGeometry: { status: "NOT_PERFORMED_HERE", detail: "Synthetic geometry comparison runs only in tests/migration-normalize.test.cjs on generated fixtures; it checks conversion math, not this board." },
};
