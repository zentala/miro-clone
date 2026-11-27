import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { getDatabase } from "../sqlite";
import { createEmptyDocument, CURRENT_SCHEMA_VERSION, validateDocument } from "../document-version";
import { validateTitle } from "../../types/board";
import { ingestAsset } from "../assets";
import { LayerType, type Layer } from "../../types/canvas";
import { isHttpSourceUrl } from "../../types/extraction";
import type { MigrationItem, MigrationPackage } from "../../types/migration";
import { legacyText } from "../rich-text";

type ImportOptions = { title?: string; assetsDirectory?: string };
type ImportRun = { package_hash: string; board_id: string; state: string; manifest: string };
const COLORS: Record<string, [number, number, number]> = {
    white: [255, 255, 255], yellow: [255, 255, 0], light_yellow: [255, 255, 224],
    red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0], black: [0, 0, 0],
};
const color = (value: unknown) => {
    if (typeof value !== "string") return { r: 255, g: 255, b: 255 };
    const hex = /^#([\da-f]{6})$/i.exec(value);
    if (hex) return { r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16) };
    const [r, g, b] = COLORS[value.toLowerCase()] ?? COLORS.white;
    return { r, g, b };
};
const record = (item: MigrationItem): Record<string, unknown> =>
    item.raw && typeof item.raw === "object" ? item.raw as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? legacyText(value) : "";

function mediaType(bytes: Buffer): string {
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
    if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
    if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    throw new Error("Local asset is not a supported PNG, JPEG, GIF or WebP file");
}

function convert(item: MigrationItem, assetIds: Map<string, string>, mapping: MigrationPackage["mapping"]): Layer | null {
    const raw = record(item), world = item.world;
    if (!world || world.left === null || world.top === null || world.width === null || world.height === null || world.width <= 0 || world.height <= 0) return null;
    const x = world.left, y = world.top, width = world.width, height = world.height;
    const parentSourceId = item.relations?.parentId;
    const parentId = parentSourceId && Object.hasOwn(mapping, parentSourceId) ? mapping[parentSourceId] : undefined;
    const rel = { ...(parentId ? { parentId } : {}), ...(raw.locked === true || raw.isLocked === true ? { locked: true } : {}) };
    const fill = color((raw.style as Record<string, unknown> | undefined)?.fillColor);
    const sourceContent = raw.content ?? raw.title ?? raw.description;
    const value = text(sourceContent);
    switch (item.kind) {
        case "frame": return { type: LayerType.Frame, x, y, width, height, name: text(raw.title) || "Imported frame", ...rel };
        case "note": return { type: LayerType.Note, x, y, width, height, fill, value, ...rel };
        case "text": return { type: LayerType.Text, x, y, width, height, fill, value, ...rel };
        case "shape": {
            if (raw.shape === "ellipse" || raw.shape === "circle") return { type: LayerType.Ellipse, x, y, width, height, fill, value, ...rel };
            if (raw.shape !== "rectangle") return null;
            return { type: LayerType.Rectangle, x, y, width, height, fill, value, ...rel };
        }
        case "image": {
            const sourceAsset = item.assetIds.find(id => assetIds.has(id));
            if (!sourceAsset) return null;
            return { type: LayerType.Image, x, y, width, height, assetId: assetIds.get(sourceAsset)!, ...rel };
        }
        case "card": case "link-preview": case "embed": {
            const url = item.urls.find(entry => entry.field === "url")?.url;
            if (!isHttpSourceUrl(url)) return null;
            return { type: LayerType.ProductCard, x, y, width, height, sourceUrl: url, title: text(raw.title) || undefined,
                extractionStatus: "unsupported", ...rel };
        }
        default: return null;
    }
}

function ensureSchema() {
    getDatabase().exec(`CREATE TABLE IF NOT EXISTS migration_imports (
        package_hash TEXT PRIMARY KEY, board_id TEXT NOT NULL, state TEXT NOT NULL,
        manifest TEXT NOT NULL, package_json TEXT NOT NULL, error TEXT
    )`);
}

/** Import a normalized v1 package into a new board; package retries return the original board unchanged. */
export async function importMigrationPackage(pkg: MigrationPackage, options: ImportOptions = {}) {
    if (pkg.format !== "miro-clone.migration-package" || pkg.formatVersion !== 1) throw new Error("Only migration-package v1 is supported");
    if (!pkg.valid) throw new Error("Invalid migration packages cannot be imported");
    for (const item of pkg.items) {
        if (item.sourceId !== null && item.targetId !== null && pkg.mapping[item.sourceId] !== item.targetId) {
            throw new Error(`Package mapping does not preserve source ID ${item.sourceId}`);
        }
    }
    const bytes = Buffer.from(JSON.stringify(pkg));
    const packageHash = createHash("sha256").update(bytes).digest("hex");
    const db = getDatabase();
    ensureSchema();
    const previous = db.prepare("SELECT * FROM migration_imports WHERE package_hash=?").get(packageHash) as ImportRun | undefined;
    if (previous?.state === "complete") return { boardId: previous.board_id, resumed: false, retry: true, ...JSON.parse(previous.manifest) };
    const boardId = previous?.board_id ?? randomUUID();
    if (!previous) {
        db.exec("BEGIN IMMEDIATE");
        try {
            db.prepare("INSERT INTO boards VALUES (?, ?, ?, ?, ?)").run(boardId, validateTitle(options.title ?? "Imported board"), Date.now(), Date.now(), JSON.stringify(createEmptyDocument()));
            db.prepare("INSERT INTO migration_imports VALUES (?, ?, 'started', ?, ?, NULL)")
                .run(packageHash, boardId, JSON.stringify({ imported: [] }), bytes.toString("utf8"));
            db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
    try {
        const importedAssets = new Map<string, string>();
        for (const asset of pkg.assets.filter(entry => entry.status === "referenced")) {
            if (!options.assetsDirectory) continue;
            if (!/^[A-Za-z0-9_-]+$/.test(asset.assetId)) throw new Error(`Unsafe package asset ID ${asset.assetId}`);
            const directory = resolve(options.assetsDirectory);
            const path = resolve(directory, asset.assetId);
            if (!path.startsWith(`${directory}${sep}`) || isAbsolute(asset.assetId)) throw new Error("Asset path escapes the selected local asset directory");
            const data = await readFile(path);
            const declaredType = typeof asset.mediaType === "string" ? asset.mediaType : mediaType(data);
            const { asset: stored } = await ingestAsset(data, declaredType);
            importedAssets.set(asset.assetId, stored.id);
        }
        const layers: Record<string, Layer> = {};
        const imported: string[] = [];
        const sourceByTarget = new Map<string, MigrationItem>();
        const unsupported: { sourceId: string | null; targetId: string | null; sourceIndex: number; status: MigrationItem["status"]; kind: string | null; reason: string }[] = [];
        const importLosses: { itemId: string | null; sourceIndex: number; kind: string; detail: string }[] = [];
        for (const item of pkg.items) {
            if (!item.targetId) {
                unsupported.push({ sourceId: item.sourceId, targetId: null, sourceIndex: item.sourceIndex,
                    status: item.status, kind: item.kind,
                    reason: "Package did not assign a target ID; raw source record is retained in the import package." });
                continue;
            }
            const layer = convert(item, importedAssets, pkg.mapping);
            if (!layer) {
                unsupported.push({ sourceId: item.sourceId, targetId: item.targetId, sourceIndex: item.sourceIndex,
                    status: item.status, kind: item.kind,
                    reason: item.kind === "image" && item.assetIds.some(id => !importedAssets.has(id))
                        ? "Original asset bytes were not provided locally; raw source record is retained in the import package."
                        : "No current board layer can represent this record without changing its meaning; raw source record is retained in the import package." });
                continue;
            }
            const parentSourceId = item.relations?.parentId;
            if (parentSourceId && !Object.hasOwn(pkg.mapping, parentSourceId)) {
                importLosses.push({ itemId: item.sourceId, sourceIndex: item.sourceIndex, kind: "parent-not-imported",
                    detail: `Parent ${parentSourceId} has no target mapping; the source relation is retained in the raw package.` });
            }
            layers[item.targetId] = layer;
            imported.push(item.targetId);
            sourceByTarget.set(item.targetId, item);
            if (item.world && item.world.rotation !== 0) {
                importLosses.push({ itemId: item.sourceId, sourceIndex: item.sourceIndex, kind: "rotation-unsupported",
                    detail: `Layer model cannot preserve ${item.world.rotation}° rotation; original geometry remains in the raw package.` });
            }
        }
        for (const [id, layer] of Object.entries(layers)) {
            if (layer.parentId && !layers[layer.parentId]) {
                const item = sourceByTarget.get(id);
                delete layer.parentId;
                if (item) importLosses.push({ itemId: item.sourceId, sourceIndex: item.sourceIndex, kind: "parent-not-imported",
                    detail: "The parent has no supported board frame; source relation is retained in the raw package." });
            }
        }
        const document = validateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION, layerIds: imported, layers });
        db.exec("BEGIN IMMEDIATE");
        try {
            const boardRow = db.prepare("SELECT document FROM boards WHERE id=?").get(boardId) as { document: string } | undefined;
            if (!boardRow) throw new Error("Import target board was removed");
            const current = JSON.parse(boardRow.document);
            if (current.layerIds?.length || Object.keys(current.layers ?? {}).length) {
                throw new Error("Cannot resume import because the destination board has local edits");
            }
            db.prepare("UPDATE boards SET document=?, updated_at=? WHERE id=?").run(JSON.stringify(document), Date.now(), boardId);
            const manifest = { imported, sourceCount: pkg.items.length, unsupportedCount: unsupported.length,
                unsupported, packageLosses: pkg.losses, importLosses };
            db.prepare("UPDATE migration_imports SET state='complete', manifest=?, error=NULL WHERE package_hash=?")
                .run(JSON.stringify(manifest), packageHash);
            db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        return { boardId, resumed: !!previous, retry: false, imported, sourceCount: pkg.items.length,
            unsupportedCount: unsupported.length, unsupported, packageLosses: pkg.losses, importLosses };
    } catch (error) {
        db.prepare("UPDATE migration_imports SET state='interrupted', error=? WHERE package_hash=?")
            .run((error as Error).message, packageHash);
        throw error;
    }
}

/** Read-only recovery status for incomplete imports; rerunning the same package resumes it. */
export function listInterruptedImports() {
    ensureSchema();
    return getDatabase().prepare("SELECT package_hash AS packageHash, board_id AS boardId, state, error FROM migration_imports WHERE state!='complete' ORDER BY rowid").all();
}

/** Resume an interrupted package from its durable import ledger. */
export async function resumeInterruptedImport(packageHash: string, options: ImportOptions = {}) {
    ensureSchema();
    const row = getDatabase().prepare("SELECT package_json, state FROM migration_imports WHERE package_hash=?").get(packageHash) as { package_json: string; state: string } | undefined;
    if (!row || row.state === "complete") throw new Error("No interrupted import exists for that package hash");
    return importMigrationPackage(JSON.parse(row.package_json) as MigrationPackage, options);
}
