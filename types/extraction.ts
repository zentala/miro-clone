import type { ProductCardLayer } from "./canvas";

/** Extraction is an optional local capability; a card remains usable without it. */
export type ExtractionStatus = "pending" | "offline" | "unsupported" | "ready" | "error";
export type ProductFieldSource = "extracted" | "manual";

/** Normalized result shape used by synthetic fixtures and a future local provider. */
export type ExtractedProductMetadata = {
    title?: string;
    variantUrl?: string;
    assetId?: string;
};

export type ProductExtractionRequest = {
    cardId: string;
    sourceUrl: string;
    complete: (metadata: ExtractedProductMetadata) => void;
    fail: (status: Exclude<ExtractionStatus, "pending" | "ready">, message: string) => void;
};

/** A provider may cancel this event to claim the request; no network call is made here. */
export const PRODUCT_EXTRACTION_REQUEST_EVENT = "miro:product-extraction-request";

/** Validate a web URL without normalizing the exact source string saved on the card. */
export function isHttpSourceUrl(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/** Refresh captured fields while preserving each field the owner has edited manually. */
export function mergeProductMetadata(
    current: ProductCardLayer,
    metadata: ExtractedProductMetadata
): ProductCardLayer {
    return {
        ...current,
        title: current.titleSource === "manual" ? current.title : metadata.title ?? current.title,
        assetId: current.imageSource === "manual" ? current.assetId : metadata.assetId ?? current.assetId,
        variantUrl: metadata.variantUrl ?? current.variantUrl,
        extractionStatus: "ready",
        extractionMessage: undefined,
    };
}
