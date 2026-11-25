#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, mkdir, mkdtemp, open, readdir, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const MAGIC = Buffer.from("MIROCLONEBACKUP\n1\n");
const MAX_HEADER_BYTES = 16 * 1024 * 1024;
const APP = "miro-clone";

function argumentsFor(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[++i];
    if (!value || !["--database", "--destination"].includes(flag)) throw new Error(`Usage: backup.mjs --destination <absolute-directory> [--database <absolute-file>]`);
    args[flag.slice(2)] = value;
  }
  if (!args.destination) throw new Error("--destination is required");
  return args;
}

function databasePath(value) {
  const path = value ?? process.env.MIRO_SQLITE_PATH ?? join(process.cwd(), "data", "miro.sqlite");
  if (!isAbsolute(path)) throw new Error("Database path must be absolute");
  return resolve(path);
}

function quoteSqlString(value) { return `'${value.replaceAll("'", "''")}'`; }
async function digestFile(path) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(path)) { size += chunk.length; hash.update(chunk); }
  return { size, sha256: hash.digest("hex") };
}

async function walkAssets(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => error.code === "ENOENT" ? [] : Promise.reject(error))) {
      if (directory === root && entry.name === ".incoming") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && /^[0-9a-f]{2}\/[0-9a-f]{64}$/.test(relative(root, path).split(sep).join("/"))) {
        const id = basename(path);
        const info = await digestFile(path);
        if (info.sha256 !== id) throw new Error(`Asset bytes do not match their content ID: ${id}`);
        const fileStat = await stat(path);
        files.push({ name: `assets/${relative(root, path).split(sep).join("/")}`, path, mtimeMs: fileStat.mtimeMs, ...info });
      }
    }
  }
  await visit(root);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

function databaseReferences(snapshotPath) {
  const db = new DatabaseSync(snapshotPath, { readOnly: true });
  try {
    const boards = db.prepare("SELECT document FROM boards").all();
    const assetRows = db.prepare("SELECT id FROM assets ORDER BY id").all();
    const references = new Set();
    for (const { document } of boards) {
      let parsed;
      try { parsed = JSON.parse(document); } catch { throw new Error("A board document is not valid JSON"); }
      if (!parsed || typeof parsed !== "object" || !parsed.layers || typeof parsed.layers !== "object") continue;
      for (const layer of Object.values(parsed.layers)) if (typeof layer?.assetId === "string") references.add(layer.assetId);
    }
    const registered = new Set(assetRows.map(row => row.id));
    for (const id of references) if (!registered.has(id)) throw new Error(`Database references an unregistered asset: ${id}`);
    if (boards.length === 0) throw new Error("Database has no board rows; refusing an empty backup");
    return { boards: boards.length, assets: assetRows.length, references };
  } finally { db.close(); }
}

async function writeArchive(path, header, files) {
  const json = Buffer.from(JSON.stringify(header));
  if (json.length > MAX_HEADER_BYTES) throw new Error("Backup manifest is too large");
  const prefix = Buffer.alloc(MAGIC.length + 4);
  MAGIC.copy(prefix);
  prefix.writeUInt32BE(json.length, MAGIC.length);
  const output = createWriteStream(path, { flags: "wx", mode: 0o600 });
  await pipeline((async function* () {
    yield prefix;
    yield json;
    for (const file of files) yield* createReadStream(file.path);
  })(), output);
  const handle = await open(path, "r+");
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function readBackupHeader(path) {
  const handle = await open(path, "r");
  try {
    const prefix = Buffer.alloc(MAGIC.length + 4);
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    if (bytesRead !== prefix.length || !prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Not a supported Miro Clone backup");
    const length = prefix.readUInt32BE(MAGIC.length);
    if (length < 2 || length > MAX_HEADER_BYTES) throw new Error("Invalid backup manifest length");
    const bytes = Buffer.alloc(length);
    const result = await handle.read(bytes, 0, length, prefix.length);
    if (result.bytesRead !== length) throw new Error("Truncated backup manifest");
    const header = JSON.parse(bytes.toString("utf8"));
    const info = await handle.stat();
    const names = new Set();
    let expectedSize = prefix.length + length;
    if (header.format !== 1 || !Array.isArray(header.files) || header.files.length === 0) throw new Error("Invalid backup manifest");
    for (const file of header.files) {
      if (typeof file.name !== "string" || file.name.startsWith("/") || file.name.split("/").includes("..") || names.has(file.name)
        || !Number.isSafeInteger(file.size) || file.size <= 0 || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error("Invalid backup entry");
      if (file.name !== "miro.sqlite" && !/^assets\/[0-9a-f]{2}\/[0-9a-f]{64}$/.test(file.name)) throw new Error("Unexpected path in backup");
      names.add(file.name);
      expectedSize += file.size;
    }
    if (!names.has("miro.sqlite") || info.size !== expectedSize) throw new Error("Backup size does not match its manifest");
    return { header, dataOffset: prefix.length + length };
  } finally { await handle.close(); }
}

async function currentFingerprint(databasePath, assetFiles) {
  const [info, ...walState] = await Promise.all([stat(databasePath, { bigint: true }),
    stat(`${databasePath}-wal`, { bigint: true }).catch(() => null),
    stat(`${databasePath}-shm`, { bigint: true }).catch(() => null)]);
  return JSON.stringify({ database: { size: String(info.size), mtimeNs: String(info.mtimeNs) },
    wal: walState.map(state => state ? { size: String(state.size), mtimeNs: String(state.mtimeNs) } : null),
    assets: assetFiles.map(({ name, size, mtimeMs }) => ({ name, size, mtimeMs })) });
}

async function newestUnchanged(destination, fingerprint) {
  const entries = await readdir(destination, { withFileTypes: true });
  const candidates = entries.filter(entry => entry.isFile() && /^miro-clone-\d{8}T\d{6}Z\.mcb$/.test(entry.name)).sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of candidates) {
    try {
      const { header } = await readBackupHeader(join(destination, entry.name));
      if (header.sourceFingerprint === fingerprint) return entry.name;
      return null;
    } catch { return null; }
  }
  return null;
}

export async function createBackup({ database, destination, now = new Date() }) {
  const sourceDb = databasePath(database);
  if (!isAbsolute(destination)) throw new Error("Backup destination must be absolute");
  const targetDir = resolve(destination);
  const sourceRoot = dirname(sourceDb);
  await mkdir(targetDir, { recursive: true });
  const temporaryRoot = await mkdtemp(join(tmpdir(), "miro-backup-"));
  const stagedDatabase = join(temporaryRoot, "miro.sqlite");
  try {
    const sourceInfo = await stat(sourceDb);
    if (!sourceInfo.isFile() || sourceInfo.size === 0) throw new Error("Database is missing or empty");
    const db = new DatabaseSync(sourceDb);
    try { db.exec(`VACUUM INTO ${quoteSqlString(stagedDatabase)}`); } finally { db.close(); }
    const tableCounts = databaseReferences(stagedDatabase);
    if (tableCounts.assets === 0) throw new Error("Database has no registered asset rows; refusing an unrestorable backup");
    const assetFiles = await walkAssets(join(sourceRoot, "assets"));
    const present = new Set(assetFiles.map(file => basename(file.path)));
    for (const id of tableCounts.references) if (!present.has(id)) throw new Error(`Referenced asset file is missing: ${id}`);
    const fingerprint = await currentFingerprint(sourceDb, assetFiles);
    const unchanged = await newestUnchanged(targetDir, fingerprint);
    if (unchanged) return { status: "unchanged, skipped", file: unchanged };

    const files = [{ name: "miro.sqlite", path: stagedDatabase, ...(await digestFile(stagedDatabase)) }, ...assetFiles];
    const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const name = `${APP}-${timestamp}.mcb`;
    const destinationPath = join(targetDir, name);
    const temporaryPath = `${destinationPath}.tmp`;
    const header = { format: 1, createdAt: now.toISOString(), sourceFingerprint: fingerprint,
      database: basename(sourceDb), boards: tableCounts.boards, registeredAssets: tableCounts.assets,
      referencedAssets: [...tableCounts.references].sort(), files: files.map(({ name, size, sha256 }) => ({ name, size, sha256 })) };
    try {
      await writeArchive(temporaryPath, header, files);
      await verifyBackup(temporaryPath);
      await link(temporaryPath, destinationPath);
      await unlink(temporaryPath);
      const directory = await open(targetDir, "r");
      try { await directory.sync(); } finally { await directory.close(); }
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
    return { status: "created", file: name, path: destinationPath, bytes: (await stat(destinationPath)).size };
  } finally { await rm(temporaryRoot, { recursive: true, force: true }); }
}

export async function verifyBackup(path) {
  const { header, dataOffset } = await readBackupHeader(path);
  const handle = await open(path, "r");
  try {
    let offset = dataOffset;
    for (const file of header.files) {
      const hash = createHash("sha256");
      let remaining = file.size;
      while (remaining > 0) {
        const buffer = Buffer.alloc(Math.min(1024 * 1024, remaining));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        if (!bytesRead) throw new Error(`Truncated backup entry: ${file.name}`);
        hash.update(buffer.subarray(0, bytesRead));
        offset += bytesRead;
        remaining -= bytesRead;
      }
      if (hash.digest("hex") !== file.sha256) throw new Error(`Backup content failed verification: ${file.name}`);
    }
  } finally { await handle.close(); }
  return header;
}

async function main(argv) {
  try {
    const args = argumentsFor(argv);
    const result = await createBackup({ database: args.database, destination: args.destination });
    process.stdout.write(`${result.status}: ${result.file}${result.path ? ` (${result.bytes} bytes)` : ""}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`backup: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) process.exitCode = await main(process.argv.slice(2));
