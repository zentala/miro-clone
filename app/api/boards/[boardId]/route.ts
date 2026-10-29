import { NextResponse } from "next/server";
import { deleteBoard, getBoard, updateBoard } from "@/lib/boards";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { boardId: string } };
export async function GET(_request: Request, { params }: Context) {
    const board = getBoard(params.boardId);
    return NextResponse.json(board ?? { error: "Board not found" }, { status: board ? 200 : 404, headers: { "Cache-Control": "no-store" } });
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
export async function PATCH(request: Request, { params }: Context) {
    if (forbidden(request)) return new Response("Forbidden", { status: 403 });
    try {
        const board = updateBoard(params.boardId, await request.json());
        return NextResponse.json(board ?? { error: "Board not found" }, { status: board ? 200 : 404 });
    } catch {
        return NextResponse.json({ error: "Unable to save board; invalid document or local storage failure" }, { status: 400 });
    }
}
export async function DELETE(request: Request, { params }: Context) {
    if (forbidden(request)) return new Response("Forbidden", { status: 403 });
    deleteBoard(params.boardId);
    return new Response(null, { status: 204 });
}
