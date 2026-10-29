import { randomUUID } from "node:crypto";
import { getDatabase } from "./sqlite";
import { Board, validateDocument, validateTitle } from "../types/board";

type Row = { id: string; title: string; created_at: number; updated_at: number; document: string };
function decode(row: unknown): Board | null {
    if (!row) return null;
    const r = row as Row;
    return { id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at, document: JSON.parse(r.document) };
}
export function listBoards() {
    return getDatabase().prepare("SELECT * FROM boards ORDER BY created_at DESC").all().map(decode);
}
export function getBoard(id: string) {
    return decode(getDatabase().prepare("SELECT * FROM boards WHERE id = ?").get(id));
}
export function createBoard(title: unknown) {
    const id = randomUUID(), now = Date.now();
    getDatabase().prepare("INSERT INTO boards VALUES (?, ?, ?, ?, ?)").run(id, validateTitle(title), now, now, JSON.stringify({ layers: {}, layerIds: [] }));
    return getBoard(id)!;
}
export function updateBoard(id: string, input: { title?: unknown; document?: unknown }) {
    // Validate before any write; independent field updates never overwrite the other field.
    const title = input.title === undefined ? undefined : validateTitle(input.title);
    const document = input.document === undefined ? undefined : JSON.stringify(validateDocument(input.document));
    if (title !== undefined || document !== undefined) {
        getDatabase().prepare("UPDATE boards SET title=COALESCE(?, title), document=COALESCE(?, document), updated_at=? WHERE id=?")
            .run(title ?? null, document ?? null, Date.now(), id);
    }
    return getBoard(id);
}
export function deleteBoard(id: string) {
    getDatabase().prepare("DELETE FROM boards WHERE id=?").run(id);
}
