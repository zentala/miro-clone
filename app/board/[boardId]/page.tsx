"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Canvas } from "./_components/canvas";
import { Loader } from "lucide-react";
import { LocalBoardProvider } from "@/providers/local-board-provider";
import type { Board } from "@/types/board";
export default function BoardPage({ params }: { params: { boardId: string } }) {
    const [board, setBoard] = useState<Board | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        setBoard(null); setError(false);
        fetch(`/api/boards/${encodeURIComponent(params.boardId)}`, { cache: "no-store", signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
            .then(setBoard).catch(error => { if (error.name !== "AbortError") setError(true); });
        return () => controller.abort();
    }, [params.boardId]);
    if (error) return <main className="p-8">Unable to load board. <Link href="/">Back to boards</Link></main>;
    if (!board) return <main className="h-full w-full bg-neutral-100 flex items-center justify-center"><Loader aria-label="Loading board" className="h-6 w-6 animate-spin" /></main>;
    return <LocalBoardProvider key={board.id} board={board}><Canvas boardId={board.id} /></LocalBoardProvider>;
}
