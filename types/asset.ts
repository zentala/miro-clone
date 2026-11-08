/**
 * Durable original assets. An asset ID is the SHA-256 hex digest of the
 * original bytes, so a document reference names exactly one byte sequence.
 * Documents reference assets through a layer's `assetId`; bytes never enter
 * the document JSON.
 */
/** Types the bundled decoder can verify; its build has no GIF decoder. */
export type AssetMediaType = "image/png" | "image/jpeg" | "image/webp";

/** Metadata row, published only after the original file is durably in place. */
export type AssetMetadata = {
    id: string;
    mediaType: AssetMediaType;
    byteSize: number;
    width: number;
    height: number;
    createdAt: number;
};

export type AssetErrorCode =
    | "empty"
    | "too-large"
    | "unsupported-media-type"
    | "media-type-mismatch"
    | "undecodable"
    | "invalid-id"
    | "not-found"
    | "data-missing";

/**
 * Read-only consistency report over metadata, files and board documents.
 * Nothing in it is deleted automatically; see ARCH "Durable assets".
 */
export type AssetReport = {
    /** Registered, file intact, referenced by at least one stored board. */
    referenced: { id: string; boards: string[] }[];
    /** Registered and intact, but no stored board references it. Kept: undo history, imports or backups may still need it. */
    unused: string[];
    /** Registered, but the file is absent or its bytes no longer match the ID. Restore from backup or re-ingest the original. */
    missing: { id: string; problem: "absent" | "size-mismatch" | "hash-mismatch"; boards: string[] }[];
    /** Canonical file without metadata: ingestion stopped before publication. Re-ingesting the original registers it. */
    unregistered: { id: string; intact: boolean }[];
    /** Incomplete temporary writes that were never published. The only data safe to delete by hand. */
    deletable: string[];
    /** Board references to asset IDs without metadata. Saves refuse these, so any entry means outside edits. */
    danglingReferences: { boardId: string; assetId: string }[];
    /** Boards whose stored JSON could not be parsed, so their references are unknown. */
    unscannedBoards: string[];
};
