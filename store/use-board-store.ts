import type { Board, BoardDocument } from "../types/board";
import type { Color, Layer } from "../types/canvas";

export type Presence = {
    selection: string[]; cursor: { x: number; y: number } | null;
    pencilDraft: [number, number, number][] | null; penColor: Color | null;
};
export class LocalObject<T extends Layer = Layer> {
    constructor(public value: T) {}
    get<K extends keyof T>(key: K): T[K] { return this.value[key]; }
    set<K extends keyof T>(key: K, value: T[K]) { this.value[key] = value; }
    update(values: Partial<T>) { Object.assign(this.value, values); }
    clone() { return new LocalObject(structuredClone(this.value)); }
}
class LayerMap {
    constructor(private document: BoardDocument) {}
    get size() { return this.document.layerIds.length; }
    get(id: string) { const layer = this.document.layers[id]; return layer ? new LocalObject(layer) : undefined; }
    set(id: string, layer: LocalObject) { this.document.layers[id] = layer.value; }
    delete(id: string) { delete this.document.layers[id]; }
    toImmutable(): ReadonlyMap<string, Layer> { return new Map(Object.entries(this.document.layers)); }
}
class LayerList {
    constructor(private ids: string[]) {}
    get length() { return this.ids.length; }
    push(id: string) { this.ids.push(id); }
    indexOf(id: string) { return this.ids.indexOf(id); }
    delete(index: number) { this.ids.splice(index, 1); }
    move(from: number, to: number) { const [id] = this.ids.splice(from, 1); this.ids.splice(to, 0, id); }
    toImmutable(): readonly string[] { return [...this.ids]; }
}
export class BoardStore {
    document: BoardDocument;
    presence: Presence = { selection: [], cursor: null, pencilDraft: null, penColor: null };
    past: BoardDocument[] = [];
    future: BoardDocument[] = [];
    paused = false;
    group: BoardDocument | null = null;
    status: "Saved" | "Saving…" | "Save failed" = "Saved";
    pending = 0;
    private depth = 0;
    private queue: Promise<void> = Promise.resolve();
    changed: () => void = () => {};
    constructor(public board: Board) { this.document = structuredClone(board.document); }
    storage = {
        get: <K extends "layers" | "layerIds">(key: K): K extends "layers" ? LayerMap : LayerList =>
            (key === "layers" ? new LayerMap(this.document) : new LayerList(this.document.layerIds)) as K extends "layers" ? LayerMap : LayerList,
    };
    history = {
        pause: () => { if (!this.paused) { this.paused = true; this.group = null; } },
        resume: () => { this.paused = false; this.group = null; },
        undo: () => {
            const previous = this.past.pop();
            if (!previous) return;
            this.future.push(structuredClone(this.document));
            this.restore(previous);
        },
        redo: () => {
            const next = this.future.pop();
            if (!next) return;
            this.past.push(structuredClone(this.document));
            this.restore(next);
        },
    };
    private restore(document: BoardDocument) {
        this.document = structuredClone(document);
        this.presence.selection = this.presence.selection.filter(id => Object.hasOwn(document.layers, id));
        this.paused = false; this.group = null;
        this.save(); this.changed();
    }
    mutate<T>(callback: (context: MutationContext) => T): T {
        const context: MutationContext = { storage: this.storage, self: { presence: this.presence }, setMyPresence: values => Object.assign(this.presence, values) };
        if (this.depth) return callback(context);
        const before = structuredClone(this.document);
        let result: T;
        this.depth++;
        try { result = callback(context); }
        catch (error) { this.document = before; throw error; }
        finally { this.depth--; }
        if (JSON.stringify(before) !== JSON.stringify(this.document)) {
            if (!this.paused || !this.group) {
                this.past.push(before);
                if (this.past.length > 100) this.past.shift();
                if (this.paused) this.group = before;
            }
            this.future = [];
            this.save();
        }
        this.changed();
        return result;
    }
    save = () => {
        const document = structuredClone(this.document);
        this.pending++; this.status = "Saving…"; this.changed();
        this.queue = this.queue.then(async () => {
            try {
                const response = await fetch(`/api/boards/${encodeURIComponent(this.board.id)}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ document }),
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
