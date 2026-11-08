import { randomUUID } from "node:crypto";
import { getDatabase } from "./sqlite";
import { Board, BoardDocument, UnreadableBoard, validateTitle } from "../types/board";
import { createEmptyDocument, DocumentError } from "./document-version";
import { upgradeDocument } from "./document-migrations";

type Row = { id: string; title: string; created_at: number; updated_at: number; document: string };

/** A stored payload this version cannot read, such as a newer schema. Callers must not overwrite it. */
export class UnreadableBoardError extends Error {
    constructor(public readonly reason: DocumentError) {
        super(reason.message);
        this.name = "UnreadableBoardError";
    }
}

const metadata = (r: Row) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at });

/** Upgrades in memory only; the stored text changes on the next accepted save. */
function decode(row: Row): Board {
    try {
        let stored: unknown;
        try { stored = JSON.parse(row.document); }
        catch { throw new DocumentError("invalid-schema", "Stored document is not valid JSON"); }
        return { ...metadata(row), document: upgradeDocument(stored) };
    } catch (error) {
        if (error instanceof DocumentError) throw new UnreadableBoardError(error);
        throw error;
    }
}
function selectRow(id: string) {
    return getDatabase().prepare("SELECT * FROM boards WHERE id = ?").get(id) as Row | undefined;
}
export function listBoards(): (Board | UnreadableBoard)[] {
    const rows = getDatabase().prepare("SELECT * FROM boards ORDER BY created_at DESC").all() as Row[];
    return rows.map(row => {
        try { return decode(row); }
        catch (error) {
            if (!(error instanceof UnreadableBoardError)) throw error;
            return { ...metadata(row), document: null, documentError: { code: error.reason.code, message: error.message } };
        }
    });
}
/** Throws UnreadableBoardError when the stored document cannot be read by this version. */
export function getBoard(id: string): Board | null {
    const row = selectRow(id);
    return row ? decode(row) : null;
}
export function createBoard(title: unknown) {
    const id = randomUUID(), now = Date.now();
    getDatabase().prepare("INSERT INTO boards VALUES (?, ?, ?, ?, ?)").run(id, validateTitle(title), now, now, JSON.stringify(createEmptyDocument()));
    return getBoard(id)!;
}
/**
 * Asset IDs a document references through layer `assetId` fields. Reads raw
 * parsed JSON of any schema version; a non-string value is returned as-is so
 * callers can refuse it.
 */
export function assetReferences(document: unknown): unknown[] {
    const layers = (document as { layers?: unknown } | null)?.layers;
    if (!layers || typeof layers !== "object") return [];
    return Object.values(layers as Record<string, unknown>)
        .map(layer => (layer as { assetId?: unknown } | null)?.assetId)
        .filter(assetId => assetId !== undefined);
}
/** Refuses saves that reference assets without published metadata; file health is the asset report's job. */
function assertAssetReferences(document: BoardDocument) {
    const lookup = getDatabase().prepare("SELECT 1 FROM assets WHERE id = ?");
    for (const assetId of assetReferences(document)) {
        if (typeof assetId !== "string") throw new DocumentError("invalid-schema", "Asset IDs must be strings");
        if (!lookup.get(assetId)) throw new DocumentError("missing-reference", `Asset ${assetId} is not stored`);
    }
}
function encodeDocument(input: unknown) {
    const document = upgradeDocument(input);
    assertAssetReferences(document);
    return JSON.stringify(document);
}
export function updateBoard(id: string, input: { title?: unknown; document?: unknown }) {
    // Validate before any write; independent field updates never overwrite the other field.
    const title = input.title === undefined ? undefined : validateTitle(input.title);
    const document = input.document === undefined ? undefined : encodeDocument(input.document);
    const row = selectRow(id);
    if (!row) return null;
    // Refuse every write to a row whose stored payload this version cannot read.
    decode(row);
    if (title !== undefined || document !== undefined) {
        getDatabase().prepare("UPDATE boards SET title=COALESCE(?, title), document=COALESCE(?, document), updated_at=? WHERE id=?")
            .run(title ?? null, document ?? null, Date.now(), id);
    }
    return getBoard(id);
}
export function deleteBoard(id: string) {
    getDatabase().prepare("DELETE FROM boards WHERE id=?").run(id);
}
