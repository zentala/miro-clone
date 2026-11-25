// Coordinated backup and disposable restore checks; all databases and assets are generated here.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = fs;
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const backupTools = import('../scripts/backup.mjs');
const restoreTools = import('../scripts/restore-test.mjs');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-backup-restore-'));
after(() => { rmSync(owned, { recursive: true, force: true }); });

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

  const restoreRoot = source('restore-target-root');
  assert.deepEqual(await restoreTest({ backup: backup.path, database, targetRoot: restoreRoot }), { boards: 1, registeredAssets: 1, referencedAssets: 1 });
  assert.deepEqual(readdirSync(restoreRoot), [], 'Only the owned temporary restore target is removed');

  const sentinel = join(data, 'keep.txt');
  writeFileSync(sentinel, 'must survive');
  await assert.rejects(() => restoreTest({ backup: backup.path, database, targetRoot: data }), /live application data directory/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'must survive', 'A live data target is refused before cleanup');
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

test('asset publication orders rename, shard fsync and assets fsync before metadata publication', () => {
  const source = readFileSync(join(root, 'lib/assets.ts'), 'utf8');
  const rename = source.indexOf('await rename(temporary, target);');
  const shardSync = source.indexOf('await syncDirectory(dirname(target));', rename);
  const assetsSync = source.indexOf('await syncDirectory(assetsRoot());', shardSync);
  const metadataInsert = source.indexOf('getDatabase().prepare("INSERT OR IGNORE INTO assets', assetsSync);
  assert.ok(rename >= 0 && shardSync > rename && assetsSync > shardSync && metadataInsert > assetsSync,
    'The rename must be followed by both directory fsyncs before its SQLite row is published');
});
