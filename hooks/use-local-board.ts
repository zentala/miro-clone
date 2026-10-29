"use client";
import { useCallback, useContext } from "react";
import { LocalBoardContext } from "@/providers/local-board-provider";
import { BoardStore, MutationContext, Presence } from "@/store/use-board-store";
import type { Layer } from "@/types/canvas";
export function useLocalBoard(): BoardStore {
    const context = useContext(LocalBoardContext);
    if (!context) throw new Error("LocalBoardProvider is required");
    return context.store;
}
export function useStorage<T>(selector: (root: { layers: ReadonlyMap<string, Layer>; layerIds: readonly string[] }) => T, _equality?: unknown): T {
    const store = useLocalBoard();
    return selector({ layers: new Map(Object.entries(store.document.layers)), layerIds: store.document.layerIds });
}
export function useSelf<T>(selector: (self: { presence: Presence }) => T): T {
    return selector({ presence: useLocalBoard().presence });
}
export function useHistory() { return useLocalBoard().history; }
export function useCanUndo() { return useLocalBoard().past.length > 0; }
export function useCanRedo() { return useLocalBoard().future.length > 0; }
export function useMutation<Args extends unknown[], Result>(callback: (context: MutationContext, ...args: Args) => Result, _dependencies: unknown[]) {
    const store = useLocalBoard();
    // Keep the current render's closure, including camera, selection and tool state.
    return useCallback((...args: Args) => store.mutate(context => callback(context, ...args)), [store, callback]);
}
