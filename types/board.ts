import type { Layer } from "./canvas";
import type { DocumentErrorCode } from "../lib/document-version";

/**
 * Persisted board content. `layerIds` is the global paint order; layer keys are
 * stable string IDs. See lib/document-version.ts for the schema rules.
 */
export type BoardDocument = { schemaVersion: number; layerIds: string[]; layers: Record<string, Layer> };
export type Board = {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    document: BoardDocument;
};
/** A listed board whose stored document this version cannot read; its payload stays untouched. */
export type UnreadableBoard = Omit<Board, "document"> & {
    document: null;
    documentError: { code: DocumentErrorCode; message: string };
};

export function validateTitle(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 60) {
        throw new Error("Title must contain 1–60 characters");
    }
    return value.trim();
}
