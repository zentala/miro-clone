// Coordinated backup and disposable restore checks; all databases and assets are generated here.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = fs;
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const { Transformer } = require('@napi-rs/image');
const backupTools = import('../scripts/backup.mjs');
const restoreTools = import('../scripts/restore-test.mjs');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-backup-restore-'));
mkdirSync(join(root, 'node_modules', '.cache'), { recursive: true });
const compiled = mkdtempSync(join(root, 'node_modules', '.cache', 'miro-backup-assets-'));
after(() => { rmSync(owned, { recursive: true, force: true }); rmSync(compiled, { recursive: true, force: true }); });

function source(name) { const dir = join(owned, name); mkdirSync(dir, { recursive: true }); return dir; }
function databaseAt(directory, includeData = true) {
  const path = join(directory, 'miro.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, document TEXT NOT NULL);
    CREATE TABLE assets (id TEXT PRIMARY KEY CHECK(length(id) = 64), media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, created_at INTEGER NOT NULL);`);
  if (includeData) {
    const bytes = Buffer.from('generated synthetic image fixture');
    const id = createHash('sha256').update(bytes).digest('hex');
    const document = JSON.stringify({ schemaVersion: 2, layerIds: ['image'], layers: { image: { assetId: id } } });
    db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run('board-one', 'Synthetic board', 1, 2, document);
    db.prepare('INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?)').run(id, 'image/png', bytes.length, 1, 1, 3);
    const assets = join(directory, 'assets', id.slice(0, 2));
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, id), bytes);
  }
  db.close();
  return path;
}

function addBoard(databasePath, title, assetId) {
  const db = new DatabaseSync(databasePath);
  const layer = assetId ? { image: { assetId } } : {};
  const document = JSON.stringify({ schemaVersion: 2, layerIds: Object.keys(layer), layers: layer });
  db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run('board-one', title, 1, 2, document);
  db.close();
}

function databaseWithoutAssetsTable(directory) {
  const path = join(directory, 'miro.sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, document TEXT NOT NULL);`);
  const document = JSON.stringify({ schemaVersion: 1, layerIds: [], layers: {} });
  db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run('board-one', 'Legacy board', 1, 2, document);
  db.close();
  return path;
}

test('backup is atomic, includes a consistent database and assets, skips unchanged input, and restores to an owned disposable target', async () => {
  const { createBackup, readBackupHeader, verifyBackup } = await backupTools;
  const { restoreTest } = await restoreTools;
  const data = source('roundtrip');
  const database = databaseAt(data);
  const destination = join(data, 'backups');
  const fixedTime = new Date('2026-11-25T12:00:00.000Z');
  const backup = await createBackup({ database, destination, now: fixedTime });
  assert.equal(backup.status, 'created');
  assert.equal(readdirSync(destination).filter(name => name.endsWith('.tmp')).length, 0);
  const { header } = await readBackupHeader(backup.path);
  assert.equal(header.boards, 1);
  assert.equal(header.registeredAssets, 1);
  assert.equal(header.referencedAssets.length, 1);
  assert.equal((await verifyBackup(backup.path)).format, 1);
  assert.deepEqual(await createBackup({ database, destination, now: fixedTime }), { status: 'unchanged, skipped', file: backup.file });
  assert.deepEqual(JSON.parse(readFileSync(join(destination, 'miro-clone.last-check'), 'utf8')),
    { checkedAt: fixedTime.getTime(), unchangedSince: '20261125T120000Z' });

  const restoreRoot = source('restore-target-root');
  assert.deepEqual(await restoreTest({ backup: backup.path, database, targetRoot: restoreRoot }), {
    boards: 1, boardTitles: ['Synthetic board'], registeredAssets: 1, referencedAssets: 1,
  });
  assert.deepEqual(readdirSync(restoreRoot), [], 'Only the owned temporary restore target is removed');

  const sentinel = join(data, 'keep.txt');
  writeFileSync(sentinel, 'must survive');
  await assert.rejects(() => restoreTest({ backup: backup.path, database, targetRoot: data }), /live application data directory/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'must survive', 'A live data target is refused before cleanup');
});

test('committed WAL updates create a new backup and restore the changed board title', async () => {
  const { createBackup } = await backupTools;
  const { restoreTest } = await restoreTools;
  const data = source('wal-keeper');
  const database = databaseAt(data);
  const keeper = new DatabaseSync(database);
  try {
    keeper.exec('PRAGMA journal_mode=WAL');
    const destination = join(data, 'backups');
    const first = await createBackup({ database, destination, now: new Date('2026-11-25T12:00:00Z') });
    keeper.prepare('UPDATE boards SET title = ? WHERE id = ?').run('Changed while WAL connection remains open', 'board-one');
    assert.equal(keeper.prepare('SELECT title FROM boards WHERE id = ?').get('board-one').title, 'Changed while WAL connection remains open');

    const second = await createBackup({ database, destination, now: new Date('2026-11-25T12:00:01Z') });
    assert.equal(second.status, 'created', 'A committed WAL update changes the staged snapshot fingerprint');
    assert.notEqual(second.file, first.file);
    const restoreRoot = source('wal-restore-target');
    const restored = await restoreTest({ backup: second.path, database, targetRoot: restoreRoot });
    assert.deepEqual(restored.boardTitles, ['Changed while WAL connection remains open']);
    assert.deepEqual(readdirSync(restoreRoot), []);
  } finally { keeper.close(); }
});

test('a corrupt newest artifact is verified before unchanged data can be skipped', async () => {
  const { createBackup, verifyBackup } = await backupTools;
  const data = source('corrupt-newest');
  const database = databaseAt(data);
  const destination = join(data, 'backups');
  const first = await createBackup({ database, destination, now: new Date('2026-11-25T12:00:00Z') });
  const corrupt = readFileSync(first.path);
  corrupt[corrupt.length - 1] ^= 0xff;
  writeFileSync(first.path, corrupt);

  const second = await createBackup({ database, destination, now: new Date('2026-11-25T12:00:01Z') });
  assert.equal(second.status, 'created', 'An invalid artifact cannot certify unchanged input');
  assert.notEqual(second.file, first.file);
  assert.equal((await verifyBackup(second.path)).format, 1);
});

test('zero assets are valid without references; missing referenced rows or bytes fail; legacy schemas stay unchanged', async () => {
  const { createBackup, readBackupHeader } = await backupTools;
  const { restoreTest } = await restoreTools;
  const bytes = Buffer.from('generated referenced asset fixture');
  const id = createHash('sha256').update(bytes).digest('hex');

  const zeroAssetRoot = source('zero-assets');
  const zeroAssetDb = databaseAt(zeroAssetRoot, false);
  addBoard(zeroAssetDb, 'No asset references', null);
  const zeroBackup = await createBackup({ database: zeroAssetDb, destination: join(zeroAssetRoot, 'backups') });
  const zeroHeader = await readBackupHeader(zeroBackup.path);
  assert.equal(zeroHeader.header.registeredAssets, 0);
  assert.deepEqual(zeroHeader.header.referencedAssets, []);
  const zeroRestore = await restoreTest({ backup: zeroBackup.path, database: zeroAssetDb, targetRoot: source('zero-assets-restore') });
  assert.equal(zeroRestore.registeredAssets, 0);
  assert.deepEqual(zeroRestore.boardTitles, ['No asset references']);

  const missingRowRoot = source('missing-asset-row');
  const missingRowDb = databaseAt(missingRowRoot, false);
  addBoard(missingRowDb, 'Missing asset row', id);
  const shard = join(missingRowRoot, 'assets', id.slice(0, 2));
  mkdirSync(shard, { recursive: true });
  writeFileSync(join(shard, id), bytes);
  await assert.rejects(() => createBackup({ database: missingRowDb, destination: join(missingRowRoot, 'backups') }), /unregistered asset/);

  const missingFileRoot = source('missing-asset-file');
  const missingFileDb = databaseAt(missingFileRoot, false);
  addBoard(missingFileDb, 'Missing asset bytes', id);
  const db = new DatabaseSync(missingFileDb);
  db.prepare('INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?)').run(id, 'image/png', bytes.length, 1, 1, 3);
  db.close();
  await assert.rejects(() => createBackup({ database: missingFileDb, destination: join(missingFileRoot, 'backups') }), /Referenced asset file is missing/);

  const legacyRoot = source('legacy-without-assets-table');
  const legacyDb = databaseWithoutAssetsTable(legacyRoot);
  const tableExists = () => {
    const connection = new DatabaseSync(legacyDb, { readOnly: true });
    try { return Boolean(connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'assets'").get()); }
    finally { connection.close(); }
  };
  assert.equal(tableExists(), false);
  const legacyBackup = await createBackup({ database: legacyDb, destination: join(legacyRoot, 'backups') });
  assert.equal((await readBackupHeader(legacyBackup.path)).header.registeredAssets, 0);
  const legacyRestore = await restoreTest({ backup: legacyBackup.path, database: legacyDb, targetRoot: source('legacy-restore') });
  assert.equal(legacyRestore.registeredAssets, 0);
  assert.deepEqual(legacyRestore.boardTitles, ['Legacy board']);
  assert.equal(tableExists(), false, 'Reading a pre-T04 database does not create an assets table');
});

test('empty databases and corrupted backup bytes never produce a successful restore', async () => {
  const { createBackup, verifyBackup } = await backupTools;
  const { restoreTest } = await restoreTools;
  const data = source('invalid');
  const database = databaseAt(data, false);
  const destination = join(data, 'backups');
  await assert.rejects(() => createBackup({ database, destination }), /no board rows/);
  assert.deepEqual(readdirSync(destination), [], 'Failed backup leaves no artifact or temporary file');

  const validData = source('corrupt-source');
  const validDatabase = databaseAt(validData);
  const validDestination = join(validData, 'backups');
  const valid = await createBackup({ database: validDatabase, destination: validDestination, now: new Date('2026-11-25T12:00:00Z') });
  const knownGood = readFileSync(valid.path);
  const db = new DatabaseSync(validDatabase);
  db.prepare('UPDATE boards SET title = ? WHERE id = ?').run('Changed synthetic board', 'board-one');
  db.close();
  await assert.rejects(() => createBackup({ database: validDatabase, destination: validDestination, now: new Date('2026-11-25T12:00:00Z') }), /EEXIST/);
  assert.deepEqual(readFileSync(valid.path), knownGood, 'A timestamp collision cannot replace a known-good backup');
  assert.deepEqual(readdirSync(validDestination), [valid.file], 'A collision leaves no partial artifact');
  const changedDb = new DatabaseSync(validDatabase);
  changedDb.prepare('DELETE FROM boards').run();
  changedDb.close();
  await assert.rejects(() => createBackup({ database: validDatabase, destination: validDestination, now: new Date('2026-11-26T12:00:00Z') }), /no board rows/);
  assert.deepEqual(readFileSync(valid.path), knownGood, 'A failed backup leaves the known-good artifact byte-identical');
  assert.deepEqual(readdirSync(validDestination), [valid.file], 'A failed backup leaves no new or partial artifact');

  const bytes = readFileSync(valid.path);
  bytes[bytes.length - 1] ^= 0xff;
  writeFileSync(valid.path, bytes);
  await assert.rejects(() => verifyBackup(valid.path), /failed verification/);
  const restoreRoot = source('corrupt-target');
  await assert.rejects(() => restoreTest({ backup: valid.path, database: validDatabase, targetRoot: restoreRoot }), /failed verification/);
  assert.deepEqual(readdirSync(restoreRoot), [], 'Invalid backup is rejected before creating a target');
});

test('asset publication fsyncs the renamed shard and assets directory before returning', async t => {
  const data = source('asset-fsync');
  const database = join(data, 'miro.sqlite');
  const originalDatabase = process.env.MIRO_SQLITE_PATH;
  const files = ['types/canvas.ts', 'types/board.ts', 'types/asset.ts', 'types/extraction.ts', 'lib/sqlite.ts', 'lib/document-version.ts',
    'lib/document-migrations.ts', 'lib/boards.ts', 'lib/assets.ts'];
  const outDir = join(compiled, 'build');
  for (const file of files) {
    const transpiled = ts.transpileModule(readFileSync(join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    mkdirSync(dirname(join(outDir, file)), { recursive: true });
    writeFileSync(join(outDir, file.replace(/\.ts$/, '.js')), transpiled.outputText);
  }
  process.env.MIRO_SQLITE_PATH = database;
  t.after(() => { if (originalDatabase === undefined) delete process.env.MIRO_SQLITE_PATH; else process.env.MIRO_SQLITE_PATH = originalDatabase; });
  const { ingestAsset } = require(join(outDir, 'lib/assets.js'));
  const events = [];
  const realRename = fsPromises.rename;
  const realOpen = fsPromises.open;
  t.mock.method(fsPromises, 'rename', async (from, to) => { events.push(['rename', to]); return realRename(from, to); });
  t.mock.method(fsPromises, 'open', async (path, ...args) => {
    const handle = await realOpen(path, ...args);
    if (typeof path === 'string' && path.startsWith(join(data, 'assets')) && args[0] === 'r') {
      const sync = handle.sync.bind(handle);
      Object.defineProperty(handle, 'sync', { configurable: true, value: async () => { events.push(['sync', path]); return sync(); } });
    }
    return handle;
  });
  const pixels = Buffer.alloc(4 * 4 * 4, 255);
  const bytes = await Transformer.fromRgbaPixels(pixels, 4, 4).png();
  const { asset } = await ingestAsset(bytes, 'image/png');
  events.push(['published', asset.id]);
  const renameIndex = events.findIndex(event => event[0] === 'rename');
  const shardSync = events.findIndex((event, index) => index > renameIndex && event[0] === 'sync' && event[1].endsWith(asset.id.slice(0, 2)));
  const rootSync = events.findIndex((event, index) => index > shardSync && event[0] === 'sync' && event[1] === join(data, 'assets'));
  const published = events.findIndex(event => event[0] === 'published');
  assert.ok(renameIndex >= 0 && shardSync > renameIndex && rootSync > shardSync && published > rootSync, JSON.stringify(events));
});
