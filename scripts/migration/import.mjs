#!/usr/bin/env node
/** Import one reviewed v1 package. Asset bytes must already be present locally; this command never fetches URLs. */
import { readFileSync } from "node:fs";
import { register } from "node:module";

const TS_EXTENSION_RESOLVER = `export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\\.[a-z]+$/i.test(specifier)) {
        try { return await nextResolve(specifier, context); }
        catch { return nextResolve(specifier + ".ts", context); }
    }
    return nextResolve(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(TS_EXTENSION_RESOLVER)}`, import.meta.url);
const { listInterruptedImports, importMigrationPackage, resumeInterruptedImport } = await import("../../lib/migration/import.ts");

function options(argv) {
    const result = { packagePath: null, packageHash: null, title: undefined, assetsDirectory: undefined, recovery: false };
    for (let i = 0; i < argv.length; i += 1) {
        const value = argv[i];
        if (value === "--package") result.packagePath = argv[++i];
        else if (value === "--resume") result.packageHash = argv[++i];
        else if (value === "--title") result.title = argv[++i];
        else if (value === "--assets-dir") result.assetsDirectory = argv[++i];
        else if (value === "--recovery-status") result.recovery = true;
        else throw new Error(`Unknown option ${value}`);
    }
    if (!result.recovery && !result.packagePath && !result.packageHash) throw new Error("--package or --resume is required");
    if (result.packagePath && result.packageHash) throw new Error("Use either --package or --resume");
    return result;
}

try {
    const args = options(process.argv.slice(2));
    if (args.recovery) process.stdout.write(`${JSON.stringify(listInterruptedImports(), null, 2)}\n`);
    else if (args.packageHash) process.stdout.write(`${JSON.stringify(await resumeInterruptedImport(args.packageHash, args), null, 2)}\n`);
    else {
        const pkg = JSON.parse(readFileSync(args.packagePath, "utf8"));
        const result = await importMigrationPackage(pkg, args);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
} catch (error) {
    process.stderr.write(`migration import: ${error.message}\n`);
    process.exitCode = 1;
}
