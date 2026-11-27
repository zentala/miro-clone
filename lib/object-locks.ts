import type { BoardStore } from "../store/use-board-store";
export {
    assertUnlockedChanges,
    LOCKED_FRAME_NOTICE,
    LOCKED_GEOMETRY_NOTICE,
    LockViolation,
    MIXED_LOCK_NOTICE,
    isEffectivelyLocked,
} from "../store/use-board-store";

/** The common toolbar, keyboard and context-menu action changes only each object's own lock bit. */
export function toggleObjectLocks(store: BoardStore, ids: readonly string[]): void {
    const selected = ids.filter(id => store.document.layers[id]);
    if (!selected.length) return;
    const unlock = selected.every(id => store.document.layers[id].locked === true);
    store.mutate(({ storage }) => {
        const layers = storage.get("layers");
        for (const id of selected) {
            const layer = layers.get(id);
            if (unlock) layer?.unset("locked");
            else layer?.set("locked", true);
        }
    });
}
