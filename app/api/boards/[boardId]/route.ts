import { NextResponse } from "next/server";
import { deleteBoard, getBoard, UnreadableBoardError, updateBoard } from "@/lib/boards";
import { DocumentError } from "@/lib/document-version";
import { isForeignOrigin } from "@/lib/same-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { boardId: string } };
const noStore = { "Cache-Control": "no-store" };
/** 409: the stored document is unreadable here and stays untouched; 400: the submitted document is refused. */
function documentFailure(error: unknown) {
    if (error instanceof UnreadableBoardError) {
        return NextResponse.json({ error: error.message, code: error.reason.code }, { status: 409, headers: noStore });
    }
    if (error instanceof DocumentError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    return null;
}
export async function GET(_request: Request, { params }: Context) {
    try {
        const board = getBoard(params.boardId);
        return NextResponse.json(board ?? { error: "Board not found" }, { status: board ? 200 : 404, headers: noStore });
    } catch (error) {
        const response = documentFailure(error);
        if (response) return response;
        throw error;
    }
}
export async function PATCH(request: Request, { params }: Context) {
    if (isForeignOrigin(request)) return new Response("Forbidden", { status: 403 });
    try {
        const board = updateBoard(params.boardId, await request.json());
        return NextResponse.json(board ?? { error: "Board not found" }, { status: board ? 200 : 404 });
    } catch (error) {
        return documentFailure(error) ??
            NextResponse.json({ error: "Unable to save board; invalid document or local storage failure" }, { status: 400 });
    }
}
export async function DELETE(request: Request, { params }: Context) {
    if (isForeignOrigin(request)) return new Response("Forbidden", { status: 403 });
    deleteBoard(params.boardId);
    return new Response(null, { status: 204 });
}
