/**
 * Portable migration package (`miro-clone.migration-package`, version 1).
 *
 * Produced by `lib/migration/normalize.ts` from a structural export
 * (`tools/miro-export`). It keeps every source record verbatim, adds world
 * geometry, a stable source-to-target ID mapping, actionable errors and an
 * explicit loss list. It is not a board document and is never written to one.
 */

/** One record of a structural export (`tools/miro-export`), as read; untrusted input. */
export type ExportRecord = {
    id?: unknown; sourceIndex?: unknown; type?: unknown; status?: unknown; reason?: unknown;
    geometry?: SourceGeometry | null; relations?: Relations | null; urls?: ItemUrl[]; assetIds?: string[]; raw?: unknown;
};

/** Structural export package (`miro-clone.structural-export`, version 1); see docs/migration.md. */
export type ExportPackage = {
    format: string; formatVersion: number; exporter?: unknown; exportedAt?: unknown;
    source?: { api?: unknown; board?: unknown }; coordinateConvention?: unknown; records: ExportRecord[];
    assets: Record<string, unknown>[]; losses: Omit<MigrationLoss, "origin">[]; coverage?: { total?: unknown };
};

/** How one input record is accounted for. */
export type RecordStatus = "supported" | "transformed" | "unknown" | "failed";

/** Portable item kinds. Deliberately wider than the editor's five layer types. */
export type PortableKind =
    | "note" | "text" | "shape" | "card" | "image" | "embed" | "link-preview"
    | "frame" | "connector" | "group" | "tag" | "mindmap-node";

/** Whether the current editor can show a kind, or which task plans it. */
export type EditorSupport = {
    status: "current" | "planned" | "none";
    task: string | null;
    detail: string;
};

/** Geometry as the exporter read it (Miro center origin, parent-relative or canvas-center). */
export type SourceGeometry = {
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    rotation: number | null;
    origin: string | null;
    relativeTo: string | null;
};

/**
 * Absolute world geometry: the editor's coordinate space. `left`/`top` are the
 * top-left corner the editor stores as layer x/y; they are null when the size is unknown.
 */
export type WorldGeometry = {
    centerX: number;
    centerY: number;
    left: number | null;
    top: number | null;
    width: number | null;
    height: number | null;
    rotation: number;
};

export type Relations = {
    parentId: string | null;
    groupId: string | null;
    childrenIds: string[];
    itemsIds: string[];
    tagIds: string[];
    connectorStart: string | null;
    connectorEnd: string | null;
};

export type ItemUrl = { field: string; url: string };

/** Text fields that carry markup. The package never renders or sanitizes them. */
export type MarkupFlag = { fields: string[]; requiresSanitization: true };

export type MigrationItem = {
    sourceId: string | null;
    targetId: string | null;
    /** Position in the export's records array (equals the SDK read order in an unedited export). */
    sourceIndex: number;
    sourceType: string | null;
    status: RecordStatus;
    kind: PortableKind | null;
    editor: EditorSupport | null;
    sourceGeometry: SourceGeometry | null;
    world: WorldGeometry | null;
    relations: Relations | null;
    urls: ItemUrl[];
    assetIds: string[];
    markup: MarkupFlag | null;
    transforms: string[];
    /** The source record exactly as exported; kept so any record can be recovered. */
    raw: unknown;
};

export type ErrorCode =
    | "export-failed" | "duplicate-id" | "parent-cycle" | "missing-parent"
    | "parent-unresolved" | "missing-asset" | "invalid-geometry" | "coverage-mismatch";

/** A problem that blocks importing a record, with the action that fixes it. */
export type MigrationError = {
    code: ErrorCode;
    itemId: string | null;
    sourceIndex: number | null;
    message: string;
    action: string;
};

export type MigrationLoss = {
    itemId: string | null;
    type: string | null;
    kind: string;
    detail: string;
    origin: "export" | "normalize";
};

export type MigrationAsset = Record<string, unknown> & {
    assetId: string;
    itemId: string;
    url: string | null;
    status: "referenced" | "orphan";
};

export type MigrationPackage = {
    format: "miro-clone.migration-package";
    formatVersion: 1;
    normalizer: { name: string; version: string };
    source: {
        format: string;
        formatVersion: number;
        exporter: unknown;
        exportedAt: unknown;
        api: unknown;
        board: unknown;
    };
    coordinates: {
        sourceConvention: unknown;
        world: string;
        screen: string;
        conversions: Record<string, string>;
        assumptions: string[];
    };
    valid: boolean;
    items: MigrationItem[];
    mapping: Record<string, string>;
    assets: MigrationAsset[];
    errors: MigrationError[];
    losses: MigrationLoss[];
    coverage: {
        total: number;
        byStatus: Record<RecordStatus, number>;
        byKind: Record<string, number>;
    };
    sanitization: { required: number; performedHere: false; at: string };
    fidelity: {
        realSource: { status: "NOT_CHECKED"; detail: string };
        syntheticGeometry: { status: "NOT_PERFORMED_HERE"; detail: string };
    };
};
