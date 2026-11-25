#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, open, realpath, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readBackupHeader, verifyBackup } from "./backup.mjs";

function parse(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[++i];
    if (!value || !["--backup", "--directory", "--database", "--target-root"].includes(flag)) throw new Error("Usage: restore-test.mjs (--backup <file> | --directory <directory>) [--database <live-file>] [--target-root <existing-directory>]");
    args[flag.slice(2)] = value;
  }
  if (!!args.backup === !!args.directory) throw new Error("Pass exactly one of --backup or --directory");
  return args;
}

function liveDatabase(value) {
  const path = value ?? process.env.MIRO_SQLITE_PATH ?? join(process.cwd(), "data", "miro.sqlite");
  if (!isAbsolute(path)) throw new Error("Database path must be absolute");
  return resolve(path);
}

async function chooseBackup(args) {
  if (args.backup) return resolve(args.backup);
  if (!isAbsolute(args.directory)) throw new Error("Backup directory must be absolute");
  const candidates = (await readdir(args.directory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && /^miro-clone-\d{8}T\d{6}Z\.mcb$/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  if (!candidates.length) throw new Error("No backup artifacts found");
  return join(args.directory, candidates[0]);
}

function within(path, parent) {
  const rel = relative(parent, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

async function assetReferences(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const boards = db.prepare("SELECT title, document FROM boards ORDER BY id").all();
    const hasAssetsTable = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assets'").get());
    const assets = new Set(hasAssetsTable ? db.prepare("SELECT id FROM assets").all().map(row => row.id) : []);
    if (!boards.length) throw new Error("Restored database has no board rows");
    const references = new Set();
    for (const { document } of boards) {
      const parsed = JSON.parse(document);
      for (const layer of Object.values(parsed?.layers ?? {})) if (typeof layer?.assetId === "string") references.add(layer.assetId);
    }
    for (const id of references) if (!assets.has(id)) throw new Error(`Restored database references an unknown asset: ${id}`);
    return { boards: boards.length, titles: boards.map(row => row.title), assets: assets.size, references };
  } finally { db.close(); }
}

async function extractArchive(archive, target) {
  const { header, dataOffset } = await readBackupHeader(archive);
  const source = await open(archive, "r");
  try {
    let offset = dataOffset;
    for (const file of header.files) {
      const outputPath = join(target, ...file.name.split("/"));
      if (!within(resolve(outputPath), resolve(target))) throw new Error(`Unsafe backup path: ${file.name}`);
      await mkdir(dirname(outputPath), { recursive: true });
      const output = await open(outputPath, "wx", 0o600);
      const hash = createHash("sha256");
      try {
        let remaining = file.size;
        while (remaining > 0) {
          const buffer = Buffer.alloc(Math.min(1024 * 1024, remaining));
          const { bytesRead } = await source.read(buffer, 0, buffer.length, offset);
          if (!bytesRead) throw new Error(`Truncated backup entry: ${file.name}`);
          const bytes = buffer.subarray(0, bytesRead);
          await output.write(bytes);
          hash.update(bytes);
          offset += bytesRead;
          remaining -= bytesRead;
        }
        await output.sync();
      } finally { await output.close(); }
      if (hash.digest("hex") !== file.sha256) throw new Error(`Backup content failed verification: ${file.name}`);
    }
  } finally { await source.close(); }
}

export async function restoreTest({ backup, database, targetRoot }) {
  const sourceDatabase = liveDatabase(database);
  const dataRoot = await realpath(dirname(sourceDatabase)).catch(() => resolve(dirname(sourceDatabase)));
  const root = targetRoot ? resolve(targetRoot) : tmpdir();
  if (!isAbsolute(root)) throw new Error("Restore target root must be absolute");
  const actualRoot = await realpath(root);
  if (within(actualRoot, dataRoot)) throw new Error("Refusing a restore test target inside the live application data directory");
  if (!backup) throw new Error("A backup file is required");
  const backupPath = await chooseBackup({ backup });
  // Validate the complete artifact before creating any target.
  await verifyBackup(backupPath);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ownedTarget = await mkdtemp(join(actualRoot, `miro-restore-test-${stamp}-`));
  try {
    await extractArchive(backupPath, ownedTarget);
    const restoredDatabase = join(ownedTarget, "miro.sqlite");
    const restored = await assetReferences(restoredDatabase);
    for (const id of restored.references) {
      const assetPath = join(ownedTarget, "assets", id.slice(0, 2), id);
      const content = await stat(assetPath).then(info => info.isFile() ? createReadStream(assetPath) : null, () => null);
      if (!content) throw new Error(`Referenced asset file is missing: ${id}`);
      const hash = createHash("sha256");
      for await (const chunk of content) hash.update(chunk);
      if (hash.digest("hex") !== id) throw new Error(`Referenced asset bytes failed verification: ${id}`);
    }
    return { boards: restored.boards, boardTitles: restored.titles, registeredAssets: restored.assets, referencedAssets: restored.references.size };
  } finally {
    await rm(ownedTarget, { recursive: true, force: true });
  }
}

async function main(argv) {
  try {
    const args = parse(argv);
    const archive = await chooseBackup(args);
    const result = await restoreTest({ backup: archive, database: args.database, targetRoot: args["target-root"] });
    process.stdout.write(`verified ${basename(archive)}: ${result.boards} boards, ${result.registeredAssets} assets, ${result.referencedAssets} referenced asset(s); disposable target removed\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`restore-test: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) process.exitCode = await main(process.argv.slice(2));
