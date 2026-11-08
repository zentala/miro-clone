import type { Board, BoardDocument } from "../types/board";
import type { Color, Layer } from "../types/canvas";
import { assertRelations } from "../lib/document-version";

/**
 * Copy-on-write edit of one board document during a single mutation.
 * The first write takes a shallow snapshot (paint order, layer record); each layer is
 * copied before its first change. Snapshots therefore share every untouched layer, so
 * history entries and change checks cost the touched layers, not the whole board.
 * Invariant: a layer object reachable from a snapshot is never mutated afterwards.
 */
export class DocumentEdit {
    before: BoardDocument | null = null;
    private copied = new Set<string>();
    constructor(public document: BoardDocument) {}
    /** Must run before any write to the document. */
    begin() {
        if (this.before) return;
        const { document } = this;
        this.before = { ...document, layerIds: [...document.layerIds], layers: { ...document.layers } };
    }
    /** The layer object this edit may change in place, copied on first use. */
    writableLayer(id: string): Layer | undefined {
        this.begin();
        const layer = this.document.layers[id];
        if (!layer || this.copied.has(id)) return layer;
        const copy = structuredClone(layer);
        this.document.layers[id] = copy;
        this.copied.add(id);
        return copy;
    }
    /** A layer object new to this edit; it is not shared with any snapshot. */
    adopt(id: string, layer: Layer) {
        this.begin();
        this.document.layers[id] = layer;
        this.copied.add(id);
    }
    /** True when the content differs from the snapshot; compares only layers that were written. */
    changed(): boolean {
        const { before, document } = this;
        if (!before) return false;
        if (before.layerIds.length !== document.layerIds.length ||
            before.layerIds.some((id, index) => id !== document.layerIds[index])) return true;
        const ids = Object.keys(before.layers);
        if (ids.length !== Object.keys(document.layers).length) return true;
        return ids.some(id => before.layers[id] !== document.layers[id] &&
            (!Object.hasOwn(document.layers, id) || JSON.stringify(before.layers[id]) !== JSON.stringify(document.layers[id])));
    }
}

/** One layer seen through an edit; reads the current value, writes through copy-on-write. */
export class LocalObject<T extends Layer = Layer> {
    constructor(private detached: T, private edit?: DocumentEdit, private id?: string) {}
    get value(): T {
        return this.edit && this.id !== undefined ? (this.edit.document.layers[this.id] as T) : this.detached;
    }
    get<K extends keyof T>(key: K): T[K] { return this.value[key]; }
    set<K extends keyof T>(key: K, value: T[K]) { this.writable()[key] = value; }
    update(values: Partial<T>) { Object.assign(this.writable(), values); }
    clone() { return new LocalObject(structuredClone(this.value)); }
    private writable(): T {
        return this.edit && this.id !== undefined ? (this.edit.writableLayer(this.id) as T) : this.detached;
    }
}

export class LayerMap {
    constructor(private edit: DocumentEdit) {}
    get size() { return this.edit.document.layerIds.length; }
    get(id: string) {
        const layer = this.edit.document.layers[id];
        return layer ? new LocalObject(layer, this.edit, id) : undefined;
    }
    set(id: string, layer: LocalObject) { this.edit.adopt(id, layer.value); }
    delete(id: string) {
        this.edit.begin();
        const layers = this.edit.document.layers;
        const parentId = layers[id]?.parentId;
        delete layers[id];
        // Children keep their absolute geometry and move up one level instead of referencing a missing parent.
        for (const [childId, layer] of Object.entries(layers)) {
            if (layer.parentId !== id) continue;
            const child = this.edit.writableLayer(childId)!;
            if (parentId === undefined) delete child.parentId;
            else child.parentId = parentId;
        }
    }
    toImmutable(): ReadonlyMap<string, Layer> { return new Map(Object.entries(this.edit.document.layers)); }
}

export class LayerList {
    constructor(private edit: DocumentEdit) {}
    private get ids() { return this.edit.document.layerIds; }
    get length() { return this.ids.length; }
    push(id: string) { this.edit.begin(); this.ids.push(id); }
    indexOf(id: string) { return this.ids.indexOf(id); }
    delete(index: number) { this.edit.begin(); this.ids.splice(index, 1); }
    move(from: number, to: number) { this.edit.begin(); const [id] = this.ids.splice(from, 1); this.ids.splice(to, 0, id); }
    toImmutable(): readonly string[] { return [...this.ids]; }
}

export type Presence = {
    selection: string[]; cursor: { x: number; y: number } | null;
    pencilDraft: [number, number, number][] | null; penColor: Color | null;
};
const MAX_HISTORY = 100;
/**
 * Local board state, session history and serialized saves. History entries are
 * copy-on-write snapshots (see DocumentEdit) that share untouched layers.
 */
export class BoardStore {
    document: BoardDocument;
    presence: Presence = { selection: [], cursor: null, pencilDraft: null, penColor: null };
    past: BoardDocument[] = [];
    future: BoardDocument[] = [];
    paused = false;
    group: BoardDocument | null = null;
    status: "Saved" | "Saving…" | "Save failed" = "Saved";
    pending = 0;
    /** A readable reason for the last refused edit, such as the board size limit; cleared by the next change. */
    notice: string | null = null;
    /** Changes made during a paused gesture (drag, resize) are saved once, when the gesture ends. */
    private deferred = false;
    private edit: DocumentEdit | null = null;
    private queue: Promise<void> = Promise.resolve();
    changed: () => void = () => {};
    constructor(public board: Board) { this.document = structuredClone(board.document); }
    storage = {
        get: <K extends "layers" | "layerIds">(key: K): K extends "layers" ? LayerMap : LayerList => {
            const edit = this.edit ?? new DocumentEdit(this.document);
            return (key === "layers" ? new LayerMap(edit) : new LayerList(edit)) as K extends "layers" ? LayerMap : LayerList;
        },
    };
    history = {
        pause: () => { if (!this.paused) { this.paused = true; this.group = null; } },
        resume: () => {
            this.paused = false; this.group = null;
            if (this.deferred) { this.deferred = false; this.pending--; this.save(); }
        },
        undo: () => {
            const previous = this.past.pop();
            if (!previous) return;
            this.future.push(this.document);
            this.restore(previous);
        },
        redo: () => {
            const next = this.future.pop();
            if (!next) return;
            this.past.push(this.document);
            this.restore(next);
        },
    };
    /** Adopts a snapshot as the live document; later edits copy layers before changing them. */
    private restore(document: BoardDocument) {
        this.document = document;
        this.presence.selection = this.presence.selection.filter(id => Object.hasOwn(document.layers, id));
        if (this.deferred) { this.deferred = false; this.pending--; }
        this.paused = false; this.group = null; this.notice = null;
        this.save(); this.changed();
    }
    mutate<T>(callback: (context: MutationContext) => T): T {
        const context: MutationContext = { storage: this.storage, self: { presence: this.presence }, setMyPresence: values => Object.assign(this.presence, values) };
        if (this.edit) return callback(context);
        const edit = new DocumentEdit(this.document);
        const presenceBefore = { ...this.presence };
        let result: T, changed: boolean;
        this.edit = edit;
        try {
            result = callback(context);
            changed = edit.changed();
            // One relation boundary for every mutation route: never save a missing parent or a cycle.
            if (changed) assertRelations(this.document);
        }
        catch (error) { if (edit.before) this.document = edit.before; throw error; }
        finally { this.edit = null; }
        if (changed) this.record(edit.before!);
        if (changed || this.presenceChanged(presenceBefore)) this.changed();
        return result;
    }
    /** Shows a refused edit's reason in the board status area. */
    refuse(message: string) { this.notice = message; this.changed(); }
    private record(before: BoardDocument) {
        if (!this.paused || !this.group) {
            this.past.push(before);
            if (this.past.length > MAX_HISTORY) this.past.shift();
            if (this.paused) this.group = before;
        }
        this.future = [];
        this.notice = null;
        if (!this.paused) this.save();
        // Count the deferred save as pending, so leaving the page mid-gesture still warns.
        else if (!this.deferred) { this.deferred = true; this.pending++; this.status = "Saving…"; }
    }
    /** The pointer cursor is not drawn locally, so cursor-only updates do not re-render the board. */
    private presenceChanged(before: Presence) {
        return before.selection !== this.presence.selection || before.pencilDraft !== this.presence.pencilDraft ||
            before.penColor !== this.presence.penColor;
    }
    save = () => {
        // The serialized text is the snapshot; later edits cannot change a queued save.
        const body = JSON.stringify({ document: this.document });
        this.pending++; this.status = "Saving…"; this.changed();
        this.queue = this.queue.then(async () => {
            try {
                const response = await fetch(`/api/boards/${encodeURIComponent(this.board.id)}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" }, body,
                });
                if (!response.ok) throw new Error("Save failed");
                this.status = "Saved";
            } catch { this.status = "Save failed"; }
            finally { this.pending--; if (this.pending) this.status = "Saving…"; this.changed(); }
        });
    };
}
export type MutationContext = {
    storage: BoardStore["storage"];
    self: { presence: Presence };
    setMyPresence: (values: Partial<Presence>, options?: { addToHistory: boolean }) => void;
};
