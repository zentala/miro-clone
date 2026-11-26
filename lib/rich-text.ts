import type { JSONContent } from "@tiptap/core";

const RICH_TEXT_PREFIX = "\u001eMiroRichText:1:";
const FONT_FAMILIES = new Set(["Inter", "Kalam", "Source Serif 4", "JetBrains Mono", "var(--font-inter)", "var(--font-kalam)", "var(--font-source-serif)", "var(--font-jetbrains)"]);
const SAFE_COLOR = /^(#[\da-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\))$/i;

export type RichTextDocument = JSONContent;

export function isRichText(value: string | undefined): boolean {
    return !!value?.startsWith(RICH_TEXT_PREFIX);
}

export function encodeRichText(document: RichTextDocument): string {
    return RICH_TEXT_PREFIX + JSON.stringify(sanitizeRichText(document));
}

export function decodeRichText(value: string | undefined): RichTextDocument | null {
    if (!value || !isRichText(value)) return null;
    try {
        return sanitizeRichText(JSON.parse(value.slice(RICH_TEXT_PREFIX.length)) as JSONContent);
    } catch {
        return null;
    }
}

/** Keep only the small formatting vocabulary supported by this editor. */
export function sanitizeRichText(input: JSONContent): RichTextDocument {
    const allowedMarks = new Set(["bold", "italic", "textStyle"]);
    const allowedNodes = new Set(["doc", "paragraph", "text", "hardBreak"]);
    const clean = (node: JSONContent): JSONContent | null => {
        if (!allowedNodes.has(node.type ?? "")) {
            const children = node.content?.map(clean).filter((child): child is JSONContent => child !== null) ?? [];
            return children.length ? { type: "paragraph", content: children } : null;
        }
        const result: JSONContent = { type: node.type };
        if (node.type === "text" && typeof node.text === "string") result.text = node.text;
        if (node.type === "text" && Array.isArray(node.marks)) {
            result.marks = node.marks.filter(mark => allowedMarks.has(mark.type)).map(mark => {
                if (mark.type !== "textStyle") return { type: mark.type };
                const attrs: Record<string, string> = {};
                const inputAttrs = mark.attrs ?? {};
                if (typeof inputAttrs.color === "string" && SAFE_COLOR.test(inputAttrs.color)) attrs.color = inputAttrs.color;
                if (typeof inputAttrs.fontFamily === "string" && FONT_FAMILIES.has(inputAttrs.fontFamily)) attrs.fontFamily = inputAttrs.fontFamily;
                if (typeof inputAttrs.fontSize === "string" && /^\d{1,3}px$/.test(inputAttrs.fontSize)) attrs.fontSize = inputAttrs.fontSize;
                return Object.keys(attrs).length ? { type: "textStyle", attrs } : null;
            }).filter((mark): mark is NonNullable<typeof mark> => mark !== null);
            if (!result.marks.length) delete result.marks;
        }
        if (node.type !== "text" && node.content) {
            result.content = node.content.map(clean).filter((child): child is JSONContent => child !== null);
        }
        return result;
    };
    const safe = clean(input);
    if (safe?.type === "doc") return safe;
    return { type: "doc", content: safe ? [safe] : [{ type: "paragraph" }] };
}

/** Legacy HTML is deliberately reduced to visible text; markup and executable attributes never reach the DOM. */
export function legacyText(value: string | undefined): string {
    if (!value) return "";
    return value
        .replace(/<(script|style|iframe|object|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
        .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/\n+$/, "");
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Render sanitized JSON using a fixed set of tags and validated inline attributes. */
export function richTextHtml(document: RichTextDocument): string {
    const render = (node: JSONContent): string => {
        if (node.type === "text") {
            let html = escapeHtml(node.text ?? "");
            for (const mark of node.marks ?? []) {
                if (mark.type === "bold") html = `<strong>${html}</strong>`;
                else if (mark.type === "italic") html = `<em>${html}</em>`;
                else if (mark.type === "textStyle") {
                    const attrs = mark.attrs ?? {};
                    const styles: string[] = [];
                    if (typeof attrs.color === "string" && SAFE_COLOR.test(attrs.color)) styles.push(`color:${attrs.color}`);
                    if (typeof attrs.fontFamily === "string" && FONT_FAMILIES.has(attrs.fontFamily)) styles.push(`font-family:${fontFamilyCss(attrs.fontFamily)}`);
                    if (typeof attrs.fontSize === "string" && /^\d{1,3}px$/.test(attrs.fontSize)) styles.push(`font-size:${attrs.fontSize}`);
                    if (styles.length) html = `<span style="${escapeHtml(styles.join(";"))}">${html}</span>`;
                }
            }
            return html;
        }
        if (node.type === "hardBreak") return "<br>";
        const children = (node.content ?? []).map(render).join("");
        return node.type === "paragraph" ? `<p>${children || "<br>"}</p>` : children;
    };
    return sanitizeRichText(document).content?.map(render).join("") ?? "";
}

function fontFamilyCss(fontFamily: string): string {
    const variables: Record<string, string> = {
        "Inter": "var(--font-inter)", "Kalam": "var(--font-kalam)", "Source Serif 4": "var(--font-source-serif)", "JetBrains Mono": "var(--font-jetbrains)",
    };
    return variables[fontFamily] ?? fontFamily;
}

export function displayRichText(value: string | undefined): { html: string; document: RichTextDocument | null } {
    const document = decodeRichText(value);
    if (isRichText(value) && !document) return { html: "", document: null };
    return document
        ? { html: richTextHtml(document), document }
        : { html: escapeHtml(legacyText(value)).replace(/\n/g, "<br>"), document: null };
}
