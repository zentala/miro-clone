"use client";
import { createContext, useEffect, useReducer, useState } from "react";
import { BoardStore } from "@/store/use-board-store";
import type { Board } from "@/types/board";
export const LocalBoardContext = createContext<{ store: BoardStore; version: number } | null>(null);
export function LocalBoardProvider({ board, children }: { board: Board; children: React.ReactNode }) {
    const [store] = useState(() => new BoardStore(board));
    const [version, update] = useReducer(n => n + 1, 0);
    useEffect(() => {
        store.changed = update;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (store.pending || store.status === "Save failed") { event.preventDefault(); event.returnValue = ""; }
        };
        const renamed = (event: Event) => {
            const board = (event as CustomEvent<Board>).detail;
            if (board.id === store.board.id) { store.board = board; store.changed(); }
        };
        window.addEventListener("board-renamed", renamed);
        window.addEventListener("beforeunload", beforeUnload);
        return () => { store.changed = () => {}; window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("board-renamed", renamed); };
    }, [store]);
    return <LocalBoardContext.Provider value={{ store, version }}>{children}</LocalBoardContext.Provider>;
}
