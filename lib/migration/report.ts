/**
 * Human-readable dry-run loss report for a normalized migration package.
 *
 * Plain text only. It never prints record content (markup stays inside the
 * package), and it escapes control characters so a crafted ID cannot drive the
 * terminal. Node loads it directly through type stripping.
 */
import type { MigrationError, MigrationLoss, MigrationPackage } from "../../types/migration.ts";

/** Entries listed per loss kind before the rest is summarized. */
export const REPORT_LIMIT = 20;

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/** Escapes control characters from untrusted source text. */
function safe(value: unknown): string {
    return String(value).replace(CONTROL, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function header(pkg: MigrationPackage): string[] {
    const board = (pkg.source.board as { id?: unknown } | null)?.id ?? "(unknown board)";
    const { byStatus, total } = pkg.coverage;
    return [
        `Migration dry run: board ${safe(board)}`,
        `Source: ${safe(pkg.source.format)} v${safe(pkg.source.formatVersion)}, exported ${safe(pkg.source.exportedAt)}`,
        "Destination: none. A dry run opens and changes no board.",
        `Package: ${pkg.valid ? "VALID" : `INVALID (${pkg.errors.length} error${pkg.errors.length === 1 ? "" : "s"})`}`,
        "",
        `Records: ${total} = ${byStatus.supported} supported + ${byStatus.transformed} transformed + ${byStatus.unknown} unknown + ${byStatus.failed} failed`,
        `By kind: ${Object.entries(pkg.coverage.byKind).map(([kind, count]) => `${safe(kind)} ${count}`).join(", ") || "none"}`,
        `Mapped to target IDs: ${Object.keys(pkg.mapping).length}`,
    ];
}

function where(entry: { itemId: string | null }, index?: number | null): string {
    const at = index === null || index === undefined ? "" : ` (source index ${index})`;
    return entry.itemId === null ? `board${at}` : `item ${safe(entry.itemId)}${at}`;
}

function errorLines(errors: MigrationError[]): string[] {
    if (!errors.length) return ["", "Errors: none"];
    const lines = ["", `Errors (${errors.length}), fix before import:`];
    for (const error of errors) {
        lines.push(`  [${error.code}] ${where(error, error.sourceIndex)}: ${safe(error.message)}`);
        lines.push(`    fix: ${safe(error.action)}`);
    }
    return lines;
}

function sanitizationLines(pkg: MigrationPackage): string[] {
    const flagged = pkg.items.filter(item => item.markup);
    const lines = ["", `Requires sanitization at import: ${flagged.length} record${flagged.length === 1 ? "" : "s"} carry markup.`,
        `  Sanitized here: no. Sanitize at ${safe(pkg.sanitization.at)}.`];
    for (const item of flagged.slice(0, REPORT_LIMIT)) {
        lines.push(`  ${safe(item.sourceId ?? `index ${item.sourceIndex}`)} (${safe(item.sourceType)}): ${item.markup?.fields.map(safe).join(", ")}`);
    }
    if (flagged.length > REPORT_LIMIT) lines.push(`  ... and ${flagged.length - REPORT_LIMIT} more in the package`);
    return lines;
}

function lossLines(losses: MigrationLoss[]): string[] {
    const groups = new Map<string, MigrationLoss[]>();
    for (const entry of losses) groups.set(entry.kind, [...(groups.get(entry.kind) ?? []), entry]);
    const lines = ["", `Losses (${losses.length}):`];
    groups.forEach((entries, kind) => {
        lines.push(`  ${safe(kind)} (${entries.length})`);
        for (const entry of entries.slice(0, REPORT_LIMIT)) {
            lines.push(`    ${where(entry)}${entry.type ? ` [${safe(entry.type)}]` : ""}: ${safe(entry.detail)}`);
        }
        if (entries.length > REPORT_LIMIT) lines.push(`    ... and ${entries.length - REPORT_LIMIT} more in the package`);
    });
    return lines;
}

function fidelityLines(pkg: MigrationPackage): string[] {
    const { realSource, syntheticGeometry } = pkg.fidelity;
    return [
        "", "Assumptions and unknowns:", ...pkg.coordinates.assumptions.map(text => `  - ${safe(text)}`),
        "", "Fidelity:",
        `  Real-source fidelity: ${realSource.status}. ${safe(realSource.detail)}`,
        `  Synthetic geometry comparison: ${syntheticGeometry.status}. ${safe(syntheticGeometry.detail)}`,
    ];
}

/** Formats the dry-run report. Pure. */
export function formatReport(pkg: MigrationPackage): string {
    return [
        ...header(pkg), ...errorLines(pkg.errors), ...sanitizationLines(pkg), ...lossLines(pkg.losses), ...fidelityLines(pkg),
    ].join("\n") + "\n";
}
