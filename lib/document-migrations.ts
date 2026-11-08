/**
 * Upgrades stored or submitted board documents to the current schema.
 * Upgrades run in memory; the stored payload changes only on the next accepted save.
 */
import type { BoardDocument } from "../types/board";
import {
    CURRENT_SCHEMA_VERSION, DocumentError, LEGACY_SCHEMA_VERSION, isRecord, validateDocument,
} from "./document-version";

type RawDocument = Record<string, unknown>;

/** Step N turns a version-N document into version N+1 without mutating its input. */
const UPGRADES: Record<number, (document: RawDocument) => RawDocument> = {
    // v1 -> v2: explicit version. Absent parentId means root and absent locked means
    // unlocked, so every layer, ID and paint-order entry stays unchanged.
    1: document => ({ ...document, schemaVersion: 2 }),
};

/** Unversioned documents are version 1; any other value must be a positive integer. */
export function schemaVersionOf(document: RawDocument): number {
    const version = document.schemaVersion;
    if (version === undefined) return LEGACY_SCHEMA_VERSION;
    if (!Number.isInteger(version) || (version as number) < LEGACY_SCHEMA_VERSION) {
        throw new DocumentError("invalid-schema", "schemaVersion must be a positive integer");
    }
    return version as number;
}

/** Returns a validated current-version copy, or throws DocumentError. Never writes storage. */
export function upgradeDocument(value: unknown): BoardDocument {
    if (!isRecord(value)) throw new DocumentError("invalid-schema", "Document must be a JSON object");
    let version = schemaVersionOf(value);
    if (version > CURRENT_SCHEMA_VERSION) {
        throw new DocumentError("unsupported-version",
            `Document schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`);
    }
    let document = value;
    for (; version < CURRENT_SCHEMA_VERSION; version++) document = UPGRADES[version](document);
    return validateDocument(document);
}
