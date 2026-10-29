import { NextResponse } from "next/server";
import { createBoard, listBoards } from "@/lib/boards";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
    return NextResponse.json(listBoards(), { headers: { "Cache-Control": "no-store" } });
}
function forbidden(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    try {
        const protocol = new URL(request.url).protocol;
        const host = request.headers.get("host");
        // Use the incoming authority, never Forwarded or X-Forwarded-Host.
        if ((protocol !== "http:" && protocol !== "https:") ||
            !host || /[\s/\\@?#,]/.test(host)) return true;
        const actualOrigin = new URL(`${protocol}//${host}`).origin;
        return origin !== actualOrigin;
    } catch {
        return true;
    }
}
export async function POST(request: Request) {
    if (forbidden(request)) return new Response("Forbidden", { status: 403 });
    try {
        const body = await request.json();
        return NextResponse.json(createBoard(body.title), { status: 201 });
    } catch {
        return NextResponse.json({ error: "Unable to create board; check the title and local storage" }, { status: 400 });
    }
}
