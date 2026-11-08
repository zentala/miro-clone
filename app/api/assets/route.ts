import { NextResponse } from "next/server";
import { AssetError, MAX_ASSET_BYTES, ingestAsset, inspectAssets } from "@/lib/assets";
import { isForeignOrigin } from "@/lib/same-origin";
import type { AssetErrorCode } from "@/types/asset";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_STATUS: Partial<Record<AssetErrorCode, number>> = {
    "empty": 400, "too-large": 413, "unsupported-media-type": 415, "media-type-mismatch": 415, "undecodable": 422,
};

/** Reads the raw body, refusing it as soon as it exceeds the asset limit. */
async function readBody(request: Request): Promise<Uint8Array> {
    if (Number(request.headers.get("content-length")) > MAX_ASSET_BYTES) {
        throw new AssetError("too-large", `Assets hold at most ${MAX_ASSET_BYTES} bytes`);
    }
    const reader = request.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
        total += part.value.byteLength;
        if (total > MAX_ASSET_BYTES) {
            await reader.cancel();
            throw new AssetError("too-large", `Assets hold at most ${MAX_ASSET_BYTES} bytes`);
        }
        chunks.push(part.value);
    }
    return Buffer.concat(chunks);
}

/** Read-only consistency report; never deletes or repairs anything. */
export async function GET() {
    return NextResponse.json(await inspectAssets(), { headers: { "Cache-Control": "no-store" } });
}

/** Raw image bytes in the body, media type in Content-Type. 201 when stored, 200 when the same bytes already were. */
export async function POST(request: Request) {
    if (isForeignOrigin(request)) return new Response("Forbidden", { status: 403 });
    try {
        const { asset, created } = await ingestAsset(await readBody(request), request.headers.get("content-type"));
        return NextResponse.json(asset, { status: created ? 201 : 200 });
    } catch (error) {
        const status = error instanceof AssetError ? UPLOAD_STATUS[error.code] : undefined;
        if (!status) return NextResponse.json({ error: "Unable to store the asset in local storage" }, { status: 500 });
        return NextResponse.json({ error: (error as AssetError).message, code: (error as AssetError).code }, { status });
    }
}
