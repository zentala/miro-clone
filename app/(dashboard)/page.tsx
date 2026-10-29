"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Actions } from "@/components/actions";
import type { Board } from "@/types/board";
export default function DashboardPage() {
    const router = useRouter();
    const [boards, setBoards] = useState<Board[]>([]);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const load = () => fetch("/api/boards", { cache: "no-store" })
            .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(setBoards).catch(() => setError("Unable to load boards"))
            .finally(() => setLoading(false));
        load(); window.addEventListener("boards-changed", load);
        return () => window.removeEventListener("boards-changed", load);
    }, []);
    async function create() {
        setPending(true); setError("");
        try {
            const response = await fetch("/api/boards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Untitled board" }) });
            if (!response.ok) throw new Error();
            const board: Board = await response.json();
            router.push(`/board/${board.id}`);
        } catch { setError("Unable to create board"); setPending(false); }
    }
    return <>
        <div className="flex items-center justify-between mb-8"><h1 className="text-2xl font-semibold">Boards</h1><Button disabled={pending} onClick={create}>New board</Button></div>
        {error && <p role="alert">{error}</p>}
        {loading ? <p>Loading boards…</p> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-5">
            {boards.map(board => <article key={board.id} className="border rounded-lg overflow-hidden">
                <Link href={`/board/${board.id}`} className="block"><div className="h-40 bg-neutral-100" style={{ backgroundImage: "url(/placeholders/1.svg)", backgroundSize: "cover" }} /><h2 className="p-3 font-semibold">{board.title}</h2></Link>
                <Actions id={board.id} title={board.title}><Button variant="ghost">Board actions</Button></Actions>
            </article>)}
            {!boards.length && <p>No boards yet. Create your first board.</p>}
        </div>}
    </>;
}
