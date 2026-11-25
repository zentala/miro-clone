import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { Transformer } from "@napi-rs/image";
import { assetVariantCachePath, openAsset } from "./assets";
import { ASSET_VARIANT_WIDTHS, type AssetVariantWidth } from "../types/asset";
import { orientedImageDimensions } from "../types/asset";

export { ASSET_VARIANT_WIDTHS };

/** Return original bytes for GIF and already-small assets; otherwise encode one bounded WebP variant. */
export async function createImageVariant(input: Uint8Array, asset: { mediaType: string; width: number; height: number; orientation?: number }, width: number) {
    if (!ASSET_VARIANT_WIDTHS.includes(width as AssetVariantWidth)) throw new RangeError("Unsupported image variant width");
    if (asset.mediaType === "image/gif") {
        return { bytes: Buffer.from(input), mediaType: asset.mediaType, width: asset.width, height: asset.height, original: true };
    }
    const oriented = orientedImageDimensions(asset.width, asset.height, asset.orientation);
    const orientedWidth = Math.min(oriented.width, width);
    const orientedHeight = Math.max(1, Math.round(oriented.height * orientedWidth / oriented.width));
    const bytes = await new Transformer(Buffer.from(input)).rotate().resize(orientedWidth, orientedHeight).webp(82);
    return { bytes, mediaType: "image/webp" as const, width: orientedWidth, height: orientedHeight, original: false };
}

export async function readImageVariant(id: string, width: number) {
    if (!ASSET_VARIANT_WIDTHS.includes(width as AssetVariantWidth)) throw new RangeError("Unsupported image variant width");
    const { asset, path } = await openAsset(id);
    if (width === 48 && asset.mediaType !== "image/gif") {
        try {
            const bytes = await readFile(assetVariantCachePath(id, width));
            return { asset, bytes, mediaType: "image/webp" as const, width: Math.min(asset.width, width),
                height: Math.max(1, Math.round(asset.height * Math.min(asset.width, width) / asset.width)), original: false };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }
    return { asset, ...(await createImageVariant(await readFile(path), asset, width)) };
}

/** Store the first-fit preview as a rebuildable cache before a new asset is returned to the editor. */
export async function cacheImageVariant(input: Uint8Array, asset: { id: string; mediaType: string; width: number; height: number }, width: 48) {
    if (asset.mediaType === "image/gif") return;
    const path = assetVariantCachePath(asset.id, width);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    const variant = await createImageVariant(input, asset, width);
    try {
        await writeFile(temporary, variant.bytes, { flag: "wx" });
        await rename(temporary, path);
    } finally {
        await rm(temporary, { force: true });
    }
}

