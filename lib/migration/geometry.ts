/**
 * World-geometry resolution for migration items: parent cycles and the
 * conversion of Miro canvas-center or parent-relative positions into absolute
 * world coordinates. Pure; results are memoized per source ID.
 */
import type { ErrorCode, MigrationItem, SourceGeometry, WorldGeometry } from "../../types/migration.ts";

export type Problem = { code: ErrorCode; message: string };
/** The nearest rotated ancestor whose rotation a conversion ignored. */
export type RotatedAncestor = { id: string; rotation: number };
export type Resolved = { world: WorldGeometry | null; transforms: string[]; rotatedAncestor: RotatedAncestor | null; problem: Problem | null };
type Anchor = { x: number; y: number; rotatedAncestor: RotatedAncestor | null };

export type GeometryIndex = {
    byId: Map<string, MigrationItem>;
    /** IDs of records the exporter marked failed, with their position in the package. */
    failedIds: Map<string, number>;
    cycles: Map<string, string[]>;
    memo: Map<string, Resolved>;
};

/** Indexes items by source ID (first occurrence wins) and finds parentId cycles. */
export function createGeometryIndex(byId: Map<string, MigrationItem>, failedIds: Map<string, number>): GeometryIndex {
    return { byId, failedIds, cycles: findCycles(byId), memo: new Map() };
}

/** Records on a parentId cycle, each mapped to the cycle path. */
function findCycles(byId: Map<string, MigrationItem>): Map<string, string[]> {
    const state = new Map<string, "open" | "done">();
    const cycles = new Map<string, string[]>();
    byId.forEach((_, start) => {
        const path: string[] = [];
        let id: string | null = start;
        while (id !== null && byId.has(id) && !state.has(id)) {
            state.set(id, "open");
            path.push(id);
            id = byId.get(id)?.relations?.parentId ?? null;
        }
        if (id !== null && state.get(id) === "open") {
            const cycle = path.slice(path.indexOf(id));
            cycle.forEach(member => cycles.set(member, cycle));
        }
        path.forEach(visited => state.set(visited, "done"));
    });
    return cycles;
}

const failed = (code: ErrorCode, message: string): Resolved => ({ world: null, transforms: [], rotatedAncestor: null, problem: { code, message } });

function box(centerX: number, centerY: number, g: SourceGeometry): WorldGeometry {
    const corner = (size: number | null, center: number) => (size === null ? null : center - size / 2);
    return {
        centerX, centerY, left: corner(g.width, centerX), top: corner(g.height, centerY),
        width: g.width, height: g.height, rotation: g.rotation ?? 0,
    };
}

/** World geometry of an indexed item, or the problem that prevents it. */
export function resolveWorld(item: MigrationItem, index: GeometryIndex): Resolved {
    const id = item.sourceId as string;
    if (!index.memo.has(id)) index.memo.set(id, computeWorld(item, index));
    return index.memo.get(id) as Resolved;
}

function computeWorld(item: MigrationItem, index: GeometryIndex): Resolved {
    const cycle = index.cycles.get(item.sourceId as string);
    if (cycle) return failed("parent-cycle", `Parent cycle ${[...cycle, cycle[0]].join(" -> ")}.`);
    const g = item.sourceGeometry;
    if (!g) return { world: null, transforms: [], rotatedAncestor: null, problem: null };
    const sizes = [g.width, g.height, g.rotation].filter(value => value !== null);
    if (![g.x, g.y, ...sizes].every(Number.isFinite)) return failed("invalid-geometry", "Geometry has non-numeric values.");
    const parentId = item.relations?.parentId ?? null;
    const mode = g.relativeTo ?? (parentId ? "parent_top_left" : "canvas_center");
    const transforms = g.relativeTo ? [] : [`relativeTo missing; assumed ${mode}`];
    if (mode === "canvas_center") return { world: box(g.x, g.y, g), transforms, rotatedAncestor: null, problem: null };
    if (mode !== "parent_top_left" && mode !== "parent_center") return failed("invalid-geometry", `Unknown relativeTo "${mode}".`);
    const anchor = parentAnchor(parentId, mode, index);
    if ("code" in anchor) return failed(anchor.code, anchor.message);
    transforms.push(`coordinates converted from ${mode} to world`);
    return { world: box(anchor.x + g.x, anchor.y + g.y, g), transforms, rotatedAncestor: anchor.rotatedAncestor, problem: null };
}

/** The parent point a relative position is measured from: its world top-left or center. */
function parentAnchor(parentId: string | null, mode: string, index: GeometryIndex): Anchor | Problem {
    if (parentId === null) return { code: "missing-parent", message: `Coordinates are ${mode} but parentId is empty.` };
    const parent = index.byId.get(parentId);
    const unresolved = (why: string): Problem => ({ code: "parent-unresolved", message: `Parent ${parentId} ${why}.` });
    if (!parent && index.failedIds.has(parentId)) return unresolved(`failed in the export (source index ${index.failedIds.get(parentId)})`);
    if (!parent) return { code: "missing-parent", message: `Parent ${parentId} is not in the package.` };
    const { world, problem, rotatedAncestor } = resolveWorld(parent, index);
    if (problem) return unresolved(`has no world position (${problem.code})`);
    if (!world) return unresolved("has no position");
    // A rotated parent is ignored for its children and, through them, for every deeper descendant.
    const ignored = world.rotation !== 0 ? { id: parentId, rotation: world.rotation } : rotatedAncestor;
    if (mode === "parent_center") return { x: world.centerX, y: world.centerY, rotatedAncestor: ignored };
    if (world.left === null || world.top === null) return unresolved("has no width/height, so its top-left is unknown");
    return { x: world.left, y: world.top, rotatedAncestor: ignored };
}
