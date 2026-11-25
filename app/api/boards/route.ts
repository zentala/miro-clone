import { NextResponse } from "next/server";
import { createBoard, listBoards } from "@/lib/boards";
import { isForeignOrigin } from "@/lib/same-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
    return NextResponse.json(listBoards(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
    if (isForeignOrigin(request)) return new Response("Forbidden", { status: 403 });
    try {
        const body = await request.json();
        return NextResponse.json(createBoard(body.title), { status: 201 });
    } catch {
        return NextResponse.json({ error: "Unable to create board; check the title and local storage" }, { status: 400 });
    }
}
