"use client";
import { createContext, useEffect, useState } from "react";
import { BoardStore } from "@/store/use-board-store";
import type { Board } from "@/types/board";
export const LocalBoardContext = createContext<BoardStore | null>(null);
export function LocalBoardProvider({ board, children }: { board: Board; children: React.ReactNode }) {
    const [store] = useState(() => new BoardStore(board));
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (store.pending || store.status === "Save failed") { event.preventDefault(); event.returnValue = ""; }
        };
        const renamed = (event: Event) => {
            const board = (event as CustomEvent<Board>).detail;
            if (board.id === store.board.id) { store.board = board; store.refresh(); }
        };
        window.addEventListener("board-renamed", renamed);
        window.addEventListener("beforeunload", beforeUnload);
        return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("board-renamed", renamed); };
    }, [store]);
    return <LocalBoardContext.Provider value={store}>{children}</LocalBoardContext.Provider>;
}
