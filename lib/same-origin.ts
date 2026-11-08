/**
 * Same-origin guard for mutating browser requests, as in the board routes.
 * Compares Origin with the validated request protocol and the incoming Host;
 * Forwarded and X-Forwarded-Host are never trusted. Not authentication.
 */
export function isForeignOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    try {
        const protocol = new URL(request.url).protocol;
        const host = request.headers.get("host");
        if ((protocol !== "http:" && protocol !== "https:") ||
            !host || /[\s/\\@?#,]/.test(host)) return true;
        return origin !== new URL(`${protocol}//${host}`).origin;
    } catch {
        return true;
    }
}
