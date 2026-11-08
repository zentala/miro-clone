"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Canvas } from "./_components/canvas";
import { Loader } from "lucide-react";
import { LocalBoardProvider } from "@/providers/local-board-provider";
import type { Board } from "@/types/board";
const GENERIC_ERROR = "Unable to load board.";
class LoadError extends Error {}
/** HTTP 409 means the stored board is kept untouched because this version cannot read it. */
async function loadError(response: Response): Promise<string> {
    if (response.status !== 409) return GENERIC_ERROR;
    const body = await response.json().catch(() => ({}));
    if (body.code === "unsupported-version") return "This board was saved by a newer version of the app. Update the app to open it; the board is unchanged.";
    return `This version of the app cannot open this board; the board is unchanged. ${typeof body.error === "string" ? body.error : ""}`.trim();
}
export default function BoardPage({ params }: { params: { boardId: string } }) {
    const [board, setBoard] = useState<Board | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setBoard(null); setError(null);
        fetch(`/api/boards/${encodeURIComponent(params.boardId)}`, { cache: "no-store", signal: controller.signal })
            .then(async response => { if (!response.ok) throw new LoadError(await loadError(response)); return response.json(); })
            .then(setBoard).catch(error => { if (error.name !== "AbortError") setError(error instanceof LoadError ? error.message : GENERIC_ERROR); });
        return () => controller.abort();
    }, [params.boardId]);
    if (error) return <main className="p-8"><p role="alert">{error}</p> <Link href="/">Back to boards</Link></main>;
    if (!board) return <main className="h-full w-full bg-neutral-100 flex items-center justify-center"><Loader aria-label="Loading board" className="h-6 w-6 animate-spin" /></main>;
    return <LocalBoardProvider key={board.id} board={board}><Canvas boardId={board.id} /></LocalBoardProvider>;
}
