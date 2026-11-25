"use client";

import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import { LocalBoardContext } from "@/providers/local-board-provider";
import { BoardStore, MutationContext, Presence } from "@/store/use-board-store";
import type { Layer } from "@/types/canvas";

type StorageRoot = { layers: ReadonlyMap<string, Layer>; layerIds: readonly string[] };
type Selector<T> = (store: BoardStore) => T;
type Equality<T> = (previous: T, next: T) => boolean;

const storageRoots = new WeakMap<BoardStore, { revision: number; root: StorageRoot }>();

function getStorageRoot(store: BoardStore): StorageRoot {
    const cached = storageRoots.get(store);
    if (cached?.revision === store.revision) return cached.root;

    const root = {
        layers: new Map(Object.entries(store.document.layers)),
        layerIds: store.document.layerIds,
    };
    storageRoots.set(store, { revision: store.revision, root });
    return root;
}

export function useLocalBoard(): BoardStore {
    const store = useContext(LocalBoardContext);
    if (!store) throw new Error("LocalBoardProvider is required");
    return store;
}

export function useBoardSelector<T>(selector: Selector<T>, equality: Equality<T> = Object.is): T {
    const store = useLocalBoard();
    const selectorRef = useRef(selector);
    const equalityRef = useRef(equality);
    const selected = useRef<{
        revision: number;
        selector: Selector<T>;
        equality: Equality<T>;
        value: T;
    } | null>(null);
    selectorRef.current = selector;
    equalityRef.current = equality;

    const getSnapshot = useCallback(() => {
        const revision = store.revision;
        const previous = selected.current;
        const currentSelector = selectorRef.current;
        const currentEquality = equalityRef.current;
        if (
            previous?.revision === revision &&
            previous.selector === currentSelector &&
            previous.equality === currentEquality
        ) return previous.value;

        const next = currentSelector(store);
        if (previous && currentEquality(previous.value, next)) {
            selected.current = {
                revision,
                selector: currentSelector,
                equality: currentEquality,
                value: previous.value,
            };
            return previous.value;
        }
        selected.current = { revision, selector: currentSelector, equality: currentEquality, value: next };
        return next;
    }, [store]);

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useStorage<T>(
    selector: (root: StorageRoot) => T,
    equality?: Equality<T>
): T {
    return useBoardSelector((store) => selector(getStorageRoot(store)), equality);
}

export function useSelf<T>(selector: (self: { presence: Presence }) => T, equality?: Equality<T>): T {
    return useBoardSelector((store) => selector({ presence: store.presence }), equality);
}

export function useHistory() { return useLocalBoard().history; }
export function useCanUndo() { return useBoardSelector((store) => store.past.length > 0); }
export function useCanRedo() { return useBoardSelector((store) => store.future.length > 0); }

export function useMutation<Args extends unknown[], Result>(callback: (context: MutationContext, ...args: Args) => Result, _dependencies: unknown[]) {
    const store = useLocalBoard();
    // Keep the current render's closure, including camera, selection and tool state.
    return useCallback((...args: Args) => store.mutate(context => callback(context, ...args)), [store, callback]);
}
