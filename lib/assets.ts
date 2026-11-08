/**
 * Durable original-asset storage beside the SQLite file.
 *
 * Layout under the data root (directory of the SQLite file):
 *   assets/<first two hex chars>/<sha256>   original bytes, never modified
 *   assets/.incoming/<uuid>.part            temporary writes in progress
 *
 * Ingestion order: temp file + fsync -> rename to the canonical path ->
 * fsync directory -> metadata row. The row is the publication point, so an
 * interrupted ingestion can leave an unregistered file or a temp file, never
 * a reference to missing data. Nothing here deletes stored data.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { Transformer } from "@napi-rs/image";
import type { AssetErrorCode, AssetMediaType, AssetMetadata, AssetReport } from "../types/asset";
import { assetReferences } from "./boards";
import { getDatabase, getDatabasePath } from "./sqlite";

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const ASSET_ID = /^[0-9a-f]{64}$/;
const INCOMING = ".incoming";
/** Magic bytes per accepted type, and the format name the decoder must report for it. */
const SIGNATURES: { mediaType: AssetMediaType; format: string; matches: (b: Buffer) => boolean }[] = [
    { mediaType: "image/png", format: "png", matches: b => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { mediaType: "image/jpeg", format: "jpeg", matches: b => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
    { mediaType: "image/webp", format: "webp", matches: b => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];

export class AssetError extends Error {
    constructor(public readonly code: AssetErrorCode, message: string) {
        super(message);
        this.name = "AssetError";
    }
}

type Row = { id: string; media_type: AssetMediaType; byte_size: number; width: number; height: number; created_at: number };
const toMetadata = (r: Row): AssetMetadata =>
    ({ id: r.id, mediaType: r.media_type, byteSize: r.byte_size, width: r.width, height: r.height, createdAt: r.created_at });

export function assetsRoot(): string {
    return join(dirname(getDatabasePath()), "assets");
}

/** The only path an asset ID maps to; anything but 64 lowercase hex characters is refused. */
export function assetPath(id: string): string {
    if (!ASSET_ID.test(id)) throw new AssetError("invalid-id", "Asset IDs are 64 lowercase hexadecimal characters");
    const root = assetsRoot();
    const path = join(root, id.slice(0, 2), id);
    if (!path.startsWith(root + sep)) throw new AssetError("invalid-id", "Asset path escapes the asset root");
    return path;
}

export function getAsset(id: string): AssetMetadata | null {
    const row = getDatabase().prepare("SELECT * FROM assets WHERE id = ?").get(id) as Row | undefined;
    return row ? toMetadata(row) : null;
}

/** Media type from magic bytes, checked against the declared type, then decoded to prove the content and read its size. */
async function inspect(bytes: Buffer, declaredType: string | null) {
    if (bytes.length === 0) throw new AssetError("empty", "The upload is empty");
    if (bytes.length > MAX_ASSET_BYTES) throw new AssetError("too-large", `Assets hold at most ${MAX_ASSET_BYTES} bytes`);
    const signature = SIGNATURES.find(candidate => candidate.matches(bytes));
    if (!signature) throw new AssetError("unsupported-media-type", "Only PNG, JPEG and WebP images are accepted");
    const declared = declaredType?.split(";")[0].trim().toLowerCase();
    if (declared !== signature.mediaType) {
        throw new AssetError("media-type-mismatch", `Declared ${declared || "no type"} but the content is ${signature.mediaType}`);
    }
    let metadata;
    try { metadata = await new Transformer(bytes).metadata(); }
    catch (error) { throw new AssetError("undecodable", `The image cannot be decoded: ${(error as Error).message}`); }
    if (metadata.format !== signature.format || !(metadata.width > 0 && metadata.height > 0)) {
        throw new AssetError("undecodable", `The content decodes as ${metadata.format}, not ${signature.format}`);
    }
    return { mediaType: signature.mediaType, width: metadata.width, height: metadata.height };
}

async function syncDirectory(path: string) {
    const handle = await open(path, "r");
    try { await handle.sync(); } finally { await handle.close(); }
}

/** SHA-256 of a stored file, or null when it does not exist. */
async function fileDigest(path: string): Promise<string | null> {
    const hash = createHash("sha256");
    try {
        for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
    return hash.digest("hex");
}

/** Puts the bytes at the canonical path, keeping an intact existing copy and replacing a damaged one. */
async function storeFile(id: string, bytes: Buffer) {
    const target = assetPath(id);
    if (await fileDigest(target) === id) return;
    const incoming = join(assetsRoot(), INCOMING);
    await mkdir(incoming, { recursive: true });
    await mkdir(dirname(target), { recursive: true });
    const temporary = join(incoming, `${randomUUID()}.part`);
    try {
        const handle = await open(temporary, "wx", 0o644);
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, target);
    } catch (error) {
        // Roll back only this call's own unpublished temp file.
        await rm(temporary, { force: true });
        throw error;
    }
    await syncDirectory(dirname(target));
}

/**
 * Stores an original and publishes its metadata. Idempotent: the same bytes
 * return the existing asset, re-registering or repairing its file if needed.
 */
export async function ingestAsset(input: Uint8Array, declaredType: string | null): Promise<{ asset: AssetMetadata; created: boolean }> {
    const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    const { mediaType, width, height } = await inspect(bytes, declaredType);
    const id = createHash("sha256").update(bytes).digest("hex");
    const existing = getAsset(id);
    await storeFile(id, bytes);
    if (existing) return { asset: existing, created: false };
    getDatabase().prepare("INSERT OR IGNORE INTO assets VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, mediaType, bytes.length, width, height, Date.now());
    return { asset: getAsset(id)!, created: true };
}

/** Metadata and file path of a servable asset; a registered asset whose file is gone is `data-missing`. */
export async function openAsset(id: string): Promise<{ asset: AssetMetadata; path: string }> {
    const path = assetPath(id);
    const asset = getAsset(id);
    if (!asset) throw new AssetError("not-found", "Asset not found");
    const size = await stat(path).then(info => info.isFile() ? info.size : -1, () => -1);
    if (size !== asset.byteSize) throw new AssetError("data-missing", "The asset is registered but its stored file is missing or damaged");
    return { asset, path };
}

/** Asset ID -> IDs of stored boards referencing it, plus boards whose JSON cannot be read. */
function boardReferences() {
    const uses = new Map<string, string[]>();
    const unscannedBoards: string[] = [];
    const rows = getDatabase().prepare("SELECT id, document FROM boards ORDER BY id").all() as { id: string; document: string }[];
    for (const row of rows) {
        let references: unknown[];
        try { references = assetReferences(JSON.parse(row.document)); }
        catch { unscannedBoards.push(row.id); continue; }
        references.filter((v): v is string => typeof v === "string").forEach(assetId => {
            const boards = uses.get(assetId) ?? [];
            if (!boards.includes(row.id)) uses.set(assetId, [...boards, row.id]);
        });
    }
    return { uses, unscannedBoards };
}

async function listDirectory(path: string): Promise<string[]> {
    return readdir(path).catch(error => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
    });
}

/** Canonical asset files present on disk; stray names are not asset files and are left alone. */
async function storedFiles(): Promise<string[]> {
    const ids: string[] = [];
    for (const shard of await listDirectory(assetsRoot())) {
        if (!/^[0-9a-f]{2}$/.test(shard)) continue;
        for (const name of await listDirectory(join(assetsRoot(), shard))) {
            if (ASSET_ID.test(name) && name.startsWith(shard)) ids.push(name);
        }
    }
    return ids.sort();
}

/** Read-only scan; hashes every stored file. Classification is documented in ARCH "Durable assets". */
export async function inspectAssets(): Promise<AssetReport> {
    const { uses, unscannedBoards } = boardReferences();
    const rows = getDatabase().prepare("SELECT * FROM assets ORDER BY id").all() as Row[];
    const registered = new Set(rows.map(row => row.id));
    const report: AssetReport = { referenced: [], unused: [], missing: [], unregistered: [], deletable: [], danglingReferences: [], unscannedBoards };
    for (const row of rows) {
        const boards = uses.get(row.id) ?? [];
        const size = await stat(assetPath(row.id)).then(info => info.size, () => -1);
        const problem = size < 0 ? "absent" : size !== row.byte_size ? "size-mismatch"
            : await fileDigest(assetPath(row.id)) !== row.id ? "hash-mismatch" : null;
        if (problem) report.missing.push({ id: row.id, problem, boards });
        else if (boards.length) report.referenced.push({ id: row.id, boards });
        else report.unused.push(row.id);
    }
    for (const id of await storedFiles()) {
        if (!registered.has(id)) report.unregistered.push({ id, intact: await fileDigest(assetPath(id)) === id });
    }
    report.deletable = (await listDirectory(join(assetsRoot(), INCOMING))).sort().map(name => join(INCOMING, name));
    uses.forEach((boards, assetId) => {
        if (!registered.has(assetId)) boards.forEach(boardId => report.danglingReferences.push({ boardId, assetId }));
    });
    return report;
}
