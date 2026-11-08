#!/usr/bin/env node
/**
 * Migration dry run: validates a structural export, normalizes it and prints
 * the loss report. It reads one file and opens no database, board or network
 * connection. With --out it writes the normalized package to a NEW file; it
 * never overwrites a file and never touches the original export.
 *
 * Usage: node scripts/migration/dry-run.mjs <export.json> [--out <package.json>]
 * Exit codes: 0 valid package, 1 package has errors (report printed),
 * 2 usage error, unreadable file or not a structural export.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeExport } from "../../lib/migration/normalize.ts";
import { formatReport } from "../../lib/migration/report.ts";

const USAGE = "Usage: node scripts/migration/dry-run.mjs <export.json> [--out <new-package.json>]";

function parseArgs(argv) {
    const args = { input: null, out: null };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === "--out") args.out = argv[(index += 1)] ?? "";
        else if (args.input === null) args.input = argv[index];
        else throw new Error(`Unexpected argument ${argv[index]}`);
    }
    if (!args.input || args.out === "") throw new Error("Missing file path.");
    if (args.out !== null && resolve(args.out) === resolve(args.input)) throw new Error("--out must differ from the input export.");
    return args;
}

function main(argv) {
    let args;
    let pkg;
    try {
        args = parseArgs(argv);
        pkg = normalizeExport(JSON.parse(readFileSync(args.input, "utf8")));
    } catch (error) {
        process.stderr.write(`dry-run: ${error.message}\n${USAGE}\n`);
        return 2;
    }
    process.stdout.write(formatReport(pkg));
    if (args.out !== null) {
        try {
            writeFileSync(args.out, `${JSON.stringify(pkg, null, 2)}\n`, { flag: "wx" });
        } catch (error) {
            process.stderr.write(`dry-run: cannot write ${args.out}: ${error.message}\n`);
            return 2;
        }
        process.stdout.write(`\nNormalized package written to ${args.out}\n`);
    }
    return pkg.valid ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
