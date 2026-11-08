import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { AssetError, openAsset } from "@/lib/assets";
import type { AssetErrorCode } from "@/types/asset";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { assetId: string } };

const SERVE_STATUS: Partial<Record<AssetErrorCode, number>> = { "invalid-id": 400, "not-found": 404, "data-missing": 500 };

/** Original bytes, unchanged. IDs are content hashes, so a response never changes and may be cached forever. */
export async function GET(_request: Request, { params }: Context) {
    try {
        const { asset, path } = await openAsset(params.assetId);
        return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
            headers: {
                "Content-Type": asset.mediaType,
                "Content-Length": String(asset.byteSize),
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": `"${asset.id}"`,
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
            },
        });
    } catch (error) {
        const status = error instanceof AssetError ? SERVE_STATUS[error.code] : undefined;
        if (!status) throw error;
        return NextResponse.json({ error: (error as AssetError).message, code: (error as AssetError).code },
            { status, headers: { "Cache-Control": "no-store" } });
    }
}
