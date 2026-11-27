// Synthetic v1 package import against a disposable SQLite file and asset tree.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { register } = require('node:module');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const MiroExport = require('../tools/miro-export/export.js');

const owned = mkdtempSync(join(tmpdir(), 'miro-migration-import-'));
const databasePath = join(owned, 'data', 'miro.sqlite');
const assetsDirectory = join(owned, 'source-assets');
mkdirSync(assetsDirectory, { recursive: true });
process.env.MIRO_SQLITE_PATH = databasePath;
const TS_EXTENSION_RESOLVER = `export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\\.[a-z]+$/i.test(specifier)) {
        try { return await nextResolve(specifier, context); }
        catch { return nextResolve(specifier + ".ts", context); }
    }
    return nextResolve(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(TS_EXTENSION_RESOLVER)}`, require('node:url').pathToFileURL(__filename).href);
const source = JSON.parse(readFileSync(join(__dirname, 'fixtures/migration/synthetic-source.json'), 'utf8'));
const gif = Buffer.from('47494638396101000100800000ffffff00000021ff0b4e45545343415045322e30030100000021f90400010000002c000000000100010000020244010021f90400010000002c00000000010001000002024401003b', 'hex');
let normalizeExport, importMigrationPackage, resumeInterruptedImport, listInterruptedImports, getBoard, updateBoard, isEffectivelyLocked;

before(async () => {
    ({ normalizeExport } = await import('../lib/migration/normalize.ts'));
    ({ importMigrationPackage, resumeInterruptedImport, listInterruptedImports } = await import('../lib/migration/import.ts'));
    ({ getBoard, updateBoard } = await import('../lib/boards.ts'));
    ({ isEffectivelyLocked } = await import('../lib/document-version.ts'));
});
after(() => rmSync(owned, { recursive: true, force: true }));

const packageFor = (exportedAt = '2026-11-27T12:00:00.000Z') => {
    const records = source.items.map(item => item.id === '3458764517517852419' ? { ...item, locked: true } : item);
    records.push(
        { id: 'synthetic-rectangle-1', type: 'shape', shape: 'rectangle', x: 2400, y: 100, width: 120, height: 60, origin: 'center', relativeTo: 'canvas_center' },
        { id: 'synthetic-ellipse-1', type: 'shape', shape: 'ellipse', x: 2600, y: 100, width: 90, height: 90, origin: 'center', relativeTo: 'canvas_center' },
        { id: 'synthetic-locked-frame', type: 'frame', title: 'Locked frame', locked: true, x: 3000, y: 100, width: 300, height: 200, origin: 'center', relativeTo: 'canvas_center' },
        { id: 'synthetic-unlocked-child', type: 'sticky_note', content: 'Inherited lock child', x: 40, y: 40, width: 100, height: 60,
            origin: 'center', relativeTo: 'parent_top_left', parentId: 'synthetic-locked-frame' },
    );
    const pkg = normalizeExport(MiroExport.buildPackage(source.boardInfo, records, exportedAt));
    const missingParentId = 'synthetic-child-with-missing-parent-mapping';
    const missingParentTargetId = 'custom-target-for-missing-parent-child';
    pkg.mapping[missingParentId] = missingParentTargetId;
    pkg.items.push({ sourceId: missingParentId, targetId: missingParentTargetId, sourceIndex: pkg.items.length,
        sourceType: 'sticky_note', status: 'supported', kind: 'note', editor: { status: 'current', task: null, detail: 'note' },
        sourceGeometry: { x: 80, y: 60, width: 80, height: 40, rotation: 0, origin: 'center', relativeTo: 'parent_top_left' },
        world: { centerX: 80, centerY: 60, left: 40, top: 40, width: 80, height: 40, rotation: 0 },
        relations: { parentId: 'parent-without-package-mapping', groupId: null, childrenIds: [], itemsIds: [], tagIds: [], connectorStart: null, connectorEnd: null },
        urls: [], assetIds: [], markup: null, transforms: [], raw: { id: missingParentId, type: 'sticky_note', content: 'Unmapped parent child' } });
    pkg.coverage.total += 1;
    pkg.coverage.byStatus.supported += 1;
    pkg.coverage.byKind.note += 1;
    pkg.items.push({ sourceId: null, targetId: null, sourceIndex: pkg.items.length, sourceType: null, status: 'unknown',
        kind: null, editor: null, sourceGeometry: null, world: null, relations: null, urls: [], assetIds: [],
        markup: null, transforms: [], raw: { type: 'synthetic-unmapped-record', payload: 'retained' } });
    pkg.coverage.total += 1;
    pkg.coverage.byStatus.unknown += 1;
    pkg.coverage.byKind['(none)'] = (pkg.coverage.byKind['(none)'] || 0) + 1;
    return pkg;
};
const assetSourceId = 'miro-image-3458764517517852420';
const putGif = () => writeFileSync(join(assetsDirectory, assetSourceId), gif);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('imports mapped layers, sanitizes markup, preserves GIF bytes and keeps unsupported raw records', async () => {
    putGif();
    const pkg = packageFor();
    const sourceFrameId = '3458764517517852417';
    pkg.mapping[sourceFrameId] = 'custom-frame-target-id';
    pkg.items.find(item => item.sourceId === sourceFrameId).targetId = 'custom-frame-target-id';
    const result = await importMigrationPackage(pkg, { title: 'Synthetic rehearsal', assetsDirectory });
    assert.equal(result.sourceCount, pkg.items.length);
    assert.ok(result.unsupportedCount > 0);
    assert.ok(result.packageLosses.length > 0);
    assert.equal(result.unsupportedCount, result.unsupported.length);
    assert.equal(result.unsupportedCount + result.imported.length, result.sourceCount);
    for (const item of pkg.items.filter(item => !result.imported.includes(item.targetId))) {
        const entry = result.unsupported.find(candidate => candidate.sourceIndex === item.sourceIndex);
        assert.ok(entry, `source index ${item.sourceIndex} must be accounted for`);
        assert.equal(entry.status, item.status);
        assert.equal(entry.sourceId, item.sourceId);
        assert.equal(entry.targetId, item.targetId);
        assert.ok(entry.reason);
    }
    assert.ok(result.unsupported.some(item => item.targetId === null && item.sourceId === null));
    const board = getBoard(result.boardId);
    const noteId = pkg.mapping['3458764517517852419'];
    const frameId = pkg.mapping['3458764517517852417'];
    assert.equal(noteId, pkg.mapping['3458764517517852419']);
    assert.ok(board.document.layerIds.includes(frameId));
    assert.equal(frameId, 'custom-frame-target-id');
    assert.equal(board.document.layers[noteId].parentId, frameId);
    assert.equal(board.document.layers[noteId].locked, true);
    assert.doesNotMatch(board.document.layers[noteId].value, /script|onerror|<p>|<a /i);
    assert.match(board.document.layers[noteId].value, /the docs/);
    const card = Object.values(board.document.layers).find(layer => layer.type === 6);
    assert.equal(card.sourceUrl, 'https://shop.example.test/product/123?variant=blue&ref=board');
    assert.equal(board.document.layers[pkg.mapping['synthetic-rectangle-1']].type, 0);
    assert.equal(board.document.layers[pkg.mapping['synthetic-ellipse-1']].type, 1);
    const lockedFrameId = pkg.mapping['synthetic-locked-frame'];
    const unlockedChildId = pkg.mapping['synthetic-unlocked-child'];
    assert.equal(board.document.layers[lockedFrameId].locked, true);
    assert.equal(board.document.layers[unlockedChildId].locked, undefined);
    assert.equal(board.document.layers[unlockedChildId].parentId, lockedFrameId);
    assert.equal(isEffectivelyLocked(board.document, unlockedChildId), true);
    const missingParentId = 'synthetic-child-with-missing-parent-mapping';
    const missingParentTargetId = pkg.mapping[missingParentId];
    assert.equal(board.document.layers[missingParentTargetId].parentId, undefined);
    assert.ok(result.importLosses.some(loss => loss.itemId === missingParentId && loss.kind === 'parent-not-imported'));
    const image = Object.values(board.document.layers).find(layer => layer.type === 5);
    assert.ok(image.assetId);
    assert.equal(readFileSync(join(owned, 'data', 'assets', image.assetId.slice(0, 2), image.assetId)).compare(gif), 0);
    const rotationLoss = result.importLosses.find(loss => loss.itemId === '3458764517517852420');
    assert.equal(rotationLoss.kind, 'rotation-unsupported');
    assert.match(rotationLoss.detail, /15°/);

    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
        const row = db.prepare('SELECT package_json, manifest FROM migration_imports WHERE board_id=?').get(result.boardId);
        const retained = JSON.parse(row.package_json);
        const originalUnknown = pkg.items.find(item => !result.imported.includes(item.targetId));
        assert.deepEqual(retained.items.find(item => item.sourceId === originalUnknown.sourceId).raw, originalUnknown.raw);
        const manifest = JSON.parse(row.manifest);
        assert.equal(manifest.unsupportedCount, result.unsupportedCount);
        assert.equal(digest(readFileSync(join(owned, 'data', 'assets', image.assetId.slice(0, 2), image.assetId))), digest(gif));
    } finally { db.close(); }

    const edited = structuredClone(board.document);
    edited.layers[noteId].value = 'Local edit';
    updateBoard(result.boardId, { document: edited });
    const retried = await importMigrationPackage(pkg, { title: 'Replacement title', assetsDirectory });
    assert.equal(retried.retry, true);
    assert.equal(retried.boardId, result.boardId);
    assert.equal(getBoard(result.boardId).document.layers[noteId].value, 'Local edit');
    assert.equal(getBoard(result.boardId).title, 'Synthetic rehearsal');
});

test('records interrupted work and resumes from its durable package without creating another board', async () => {
    const pkg = packageFor('2026-11-27T12:01:00.000Z');
    rmSync(join(assetsDirectory, assetSourceId), { force: true });
    await assert.rejects(() => importMigrationPackage(pkg, { assetsDirectory }), /ENOENT/);
    const pending = listInterruptedImports();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].state, 'interrupted');
    const boardCount = new DatabaseSync(databasePath, { readOnly: true });
    let beforeCount;
    try { beforeCount = boardCount.prepare('SELECT COUNT(*) AS count FROM boards').get().count; }
    finally { boardCount.close(); }
    putGif();
    const resumed = await resumeInterruptedImport(pending[0].packageHash, { assetsDirectory });
    assert.equal(resumed.resumed, true);
    assert.equal(listInterruptedImports().length, 0);

    const editedPackage = packageFor('2026-11-27T12:02:00.000Z');
    rmSync(join(assetsDirectory, assetSourceId), { force: true });
    await assert.rejects(() => importMigrationPackage(editedPackage, { assetsDirectory }), /ENOENT/);
    const interrupted = listInterruptedImports();
    assert.equal(interrupted.length, 1);
    const expectedBoardCount = beforeCount + 1;
    const destination = getBoard(interrupted[0].boardId);
    const localEdit = structuredClone(destination.document);
    localEdit.layerIds.push('local-edit-after-interruption');
    localEdit.layers['local-edit-after-interruption'] = {
        type: 0, x: 12, y: 34, width: 56, height: 78, fill: { r: 1, g: 2, b: 3 }, value: 'Keep this edit',
    };
    updateBoard(destination.id, { document: localEdit });
    const savedLocalEdit = getBoard(destination.id).document;
    putGif();
    await assert.rejects(() => resumeInterruptedImport(interrupted[0].packageHash, { assetsDirectory }), /destination board has local edits/);
    assert.deepEqual(getBoard(destination.id).document, savedLocalEdit);
    assert.equal(listInterruptedImports().length, 1);
    assert.equal(listInterruptedImports()[0].state, 'interrupted');
    const boardCountAfter = new DatabaseSync(databasePath, { readOnly: true });
    try { assert.equal(boardCountAfter.prepare('SELECT COUNT(*) AS count FROM boards').get().count, expectedBoardCount); }
    finally { boardCountAfter.close(); }
});

test('CLI exposes import recovery status from the selected SQLite file', () => {
    const script = join(__dirname, '../scripts/migration/import.mjs');
    const result = spawnSync(process.execPath, ['--experimental-transform-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--recovery-status'], {
        cwd: join(__dirname, '..'), env: { MIRO_SQLITE_PATH: databasePath }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const recoveryStatus = JSON.parse(result.stdout);
    assert.equal(recoveryStatus.length, 1);
    assert.equal(recoveryStatus[0].state, 'interrupted');
    assert.match(recoveryStatus[0].error, /destination board has local edits/);
});

test('CLI imports a generated package and persists its mapped layer in a separate SQLite file', () => {
    const cliOwned = mkdtempSync(join(tmpdir(), 'miro-migration-import-cli-'));
    const cliDatabasePath = join(cliOwned, 'data', 'miro.sqlite');
    const cliAssetsDirectory = join(cliOwned, 'source-assets');
    const packagePath = join(cliOwned, 'package.json');
    mkdirSync(cliAssetsDirectory, { recursive: true });
    writeFileSync(join(cliAssetsDirectory, assetSourceId), gif);
    const pkg = packageFor('2026-11-27T12:03:00.000Z');
    const mappedNoteSourceId = '3458764517517852419';
    const mappedNoteTargetId = pkg.mapping[mappedNoteSourceId];
    writeFileSync(packagePath, JSON.stringify(pkg));

    try {
        const script = join(__dirname, '../scripts/migration/import.mjs');
        const result = spawnSync(process.execPath, [
            '--experimental-transform-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
            script, '--package', packagePath, '--assets-dir', cliAssetsDirectory,
        ], {
            cwd: join(__dirname, '..'),
            env: { MIRO_SQLITE_PATH: cliDatabasePath },
            encoding: 'utf8',
        });
        assert.equal(result.status, 0, result.stderr);
        const imported = JSON.parse(result.stdout);
        assert.ok(imported.boardId);
        assert.ok(imported.imported.includes(mappedNoteTargetId));

        const db = new DatabaseSync(cliDatabasePath, { readOnly: true });
        try {
            const row = db.prepare('SELECT document FROM boards WHERE id=?').get(imported.boardId);
            assert.ok(row, 'CLI-created board must exist in its isolated SQLite file');
            const document = JSON.parse(row.document);
            assert.ok(document.layerIds.includes(mappedNoteTargetId));
            assert.equal(document.layers[mappedNoteTargetId].value, 'Read the docs and https://example.org/path_(x)');
        } finally { db.close(); }
    } finally {
        rmSync(cliOwned, { recursive: true, force: true });
    }
});
