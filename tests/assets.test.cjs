// Durable asset storage on disposable data roots: real modules, real SQLite, real files.
// Compiles the TypeScript sources with the installed compiler; no extra framework.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const { Transformer } = require('@napi-rs/image');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-assets-'));
// Compiled modules live under node_modules/.cache so `@napi-rs/image` resolves from them.
mkdirSync(join(root, 'node_modules', '.cache'), { recursive: true });
const compiled = mkdtempSync(join(root, 'node_modules', '.cache', 'miro-assets-test-'));
after(() => { rmSync(owned, { recursive: true, force: true }); rmSync(compiled, { recursive: true, force: true }); });
const SOURCES = ['types/canvas.ts', 'types/board.ts', 'types/asset.ts', 'lib/sqlite.ts', 'lib/document-version.ts',
    'lib/document-migrations.ts', 'lib/boards.ts', 'lib/assets.ts'];

let builds = 0;
/** Fresh module instances (a new "process") bound to one SQLite file and its data root. */
function loadApp(databasePath) {
    const outDir = join(compiled, `build-${++builds}`);
    for (const file of SOURCES) {
        const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'),
            { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
        mkdirSync(dirname(join(outDir, file)), { recursive: true });
        writeFileSync(join(outDir, file.replace(/\.ts$/, '.js')), outputText);
    }
    process.env.MIRO_SQLITE_PATH = databasePath;
    return { assets: require(join(outDir, 'lib/assets.js')), boards: require(join(outDir, 'lib/boards.js')) };
}
function dataRoot(name) {
    const directory = join(owned, name);
    mkdirSync(directory);
    return join(directory, 'miro.sqlite');
}
/** Generated image with a seed-dependent gradient, so different seeds give different bytes. */
async function image(format, seed = 1, width = 48, height = 32) {
    const pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([(i / 4 * seed) % 256, (i / 7) % 256, seed * 40 % 256, 255], i);
    const transformer = Transformer.fromRgbaPixels(pixels, width, height);
    return format === 'png' ? transformer.png() : format === 'jpeg' ? transformer.jpeg(85) : transformer.webp(85);
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fill = { r: 1, g: 2, b: 3 };
const withAsset = assetId => ({ schemaVersion: 2, layerIds: ['picture'], layers: { picture: { type: 0, x: 10, y: 20, width: 48, height: 32, fill, assetId } } });
const rows = databasePath => {
    if (!existsSync(databasePath)) return [];
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try { return db.prepare('SELECT id FROM assets ORDER BY id').all().map(row => row.id); } finally { db.close(); }
};
const files = directory => existsSync(directory) ? readdirSync(directory, { recursive: true }).sort() : [];
const assetError = code => error => error.name === 'AssetError' && error.code === code;

test('originals are stored unchanged under the data root, content-addressed and idempotent', async () => {
    const databasePath = dataRoot('happy');
    const { assets } = loadApp(databasePath);
    for (const [format, mediaType] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
        const bytes = await image(format, 3, 64, 40);
        const { asset, created } = await assets.ingestAsset(bytes, `${mediaType}; charset=binary`);
        assert.equal(created, true);
        assert.deepEqual({ ...asset, createdAt: 0 }, { id: sha256(bytes), mediaType, byteSize: bytes.length, width: 64, height: 40, createdAt: 0 });
        const path = join(dirname(databasePath), 'assets', asset.id.slice(0, 2), asset.id);
        assert.equal(assets.assetPath(asset.id), path, 'Assets live beside the SQLite file');
        assert.deepEqual(readFileSync(path), bytes, 'Original bytes stay unchanged');
        const again = await assets.ingestAsset(Buffer.from(bytes), mediaType);
        assert.equal(again.created, false);
        assert.deepEqual(again.asset, asset);
    }
    assert.equal(rows(databasePath).length, 3, 'Repeated uploads add no rows');
    assert.deepEqual(files(join(dirname(databasePath), 'assets', '.incoming')), [], 'No temporary files remain');
});

test('media type, size, content and IDs are validated before anything is written', async () => {
    const databasePath = dataRoot('validation');
    const { assets } = loadApp(databasePath);
    const png = await image('png');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    const pngHeaderOnWebp = Buffer.concat([png.subarray(0, 8), (await image('webp')).subarray(8)]);
    const oversized = Buffer.alloc(assets.MAX_ASSET_BYTES + 1);
    png.copy(oversized);
    const cases = [
        ['empty', new Uint8Array(), 'image/png'],
        ['media-type-mismatch', png, null],
        ['media-type-mismatch', png, 'image/jpeg'],
        ['unsupported-media-type', svg, 'image/svg+xml'],
        ['unsupported-media-type', Buffer.from('474946383961', 'hex'), 'image/gif'],
        ['undecodable', png.subarray(0, png.length - 20), 'image/png'],
        ['undecodable', pngHeaderOnWebp, 'image/png'],
        ['too-large', oversized, 'image/png'],
    ];
    for (const [code, bytes, type] of cases) {
        await assert.rejects(() => assets.ingestAsset(bytes, type), assetError(code), `${code} for ${type}`);
    }
    assert.deepEqual(rows(databasePath), []);
    assert.deepEqual(files(join(dirname(databasePath), 'assets')).filter(name => !name.startsWith('.incoming')), [], 'Refused uploads write no asset files');
    for (const id of ['../../miro.sqlite', '..', sha256(png).toUpperCase(), sha256(png).slice(1), `${sha256(png)}/x`, '']) {
        assert.throws(() => assets.assetPath(id), assetError('invalid-id'), id);
        await assert.rejects(() => assets.openAsset(id), assetError('invalid-id'));
    }
    await assert.rejects(() => assets.openAsset(sha256(png)), assetError('not-found'));
});

test('documents keep asset IDs only; saves refuse references without published metadata', async () => {
    const databasePath = dataRoot('references');
    const { assets, boards } = loadApp(databasePath);
    const bytes = await image('jpeg', 5, 320, 200);
    const { asset } = await assets.ingestAsset(bytes, 'image/jpeg');
    const board = boards.createBoard('References');
    const before = boards.getBoard(board.id);
    const unknown = sha256(Buffer.from('never stored'));
    assert.throws(() => boards.updateBoard(board.id, { document: withAsset(unknown) }), error => error.code === 'missing-reference');
    assert.throws(() => boards.updateBoard(board.id, { document: withAsset(42) }), error => error.code === 'invalid-schema');
    assert.deepEqual(boards.getBoard(board.id), before, 'Refused saves leave the board unchanged');
    boards.updateBoard(board.id, { document: withAsset(asset.id) });
    const db = new DatabaseSync(databasePath, { readOnly: true });
    const stored = db.prepare('SELECT document FROM boards WHERE id = ?').get(board.id).document;
    db.close();
    assert.equal(JSON.parse(stored).layers.picture.assetId, asset.id);
    assert.ok(stored.length < 300 && !stored.includes(bytes.toString('base64').slice(0, 40)), 'No image bytes in the document');
    const report = await assets.inspectAssets();
    assert.deepEqual(report.referenced, [{ id: asset.id, boards: [board.id] }]);
});

test('interrupted ingestion never publishes a reference to missing data; recovery is explicit', async () => {
    const databasePath = dataRoot('interrupted');
    const { assets, boards } = loadApp(databasePath);
    const bytes = await image('png', 7);
    const id = sha256(bytes);
    const target = join(dirname(databasePath), 'assets', id.slice(0, 2), id);
    const incoming = join(dirname(databasePath), 'assets', '.incoming');
    // Decoy 1: the rename into place fails (a directory occupies the canonical path).
    mkdirSync(target, { recursive: true });
    await assert.rejects(() => assets.ingestAsset(bytes, 'image/png'), error => error.code === 'EISDIR' || error.code === 'ENOTEMPTY' || error.code === 'EEXIST');
    assert.deepEqual(rows(databasePath), [], 'No metadata without a stored file');
    assert.deepEqual(files(incoming), [], 'The failed call removed its own temporary file');
    rmSync(target, { recursive: true });
    // Decoy 2: metadata publication fails after the file is in place.
    const db = new DatabaseSync(databasePath);
    db.exec("CREATE TRIGGER refuse_assets BEFORE INSERT ON assets BEGIN SELECT RAISE(ABORT, 'injected publication failure'); END");
    await assert.rejects(() => assets.ingestAsset(bytes, 'image/png'), /injected publication failure/);
    assert.deepEqual(rows(databasePath), []);
    assert.deepEqual(readFileSync(target), bytes);
    const board = boards.createBoard('Interrupted');
    assert.throws(() => boards.updateBoard(board.id, { document: withAsset(id) }), error => error.code === 'missing-reference');
    // A process killed before rename leaves only a temp file.
    writeFileSync(join(incoming, 'killed-writer.part'), bytes.subarray(0, 10));
    let report = await assets.inspectAssets();
    assert.deepEqual(report.unregistered, [{ id, intact: true }]);
    assert.deepEqual(report.deletable, ['.incoming/killed-writer.part']);
    assert.deepEqual([report.referenced, report.unused, report.missing, report.danglingReferences], [[], [], [], []]);
    // Recovery: once publication works, re-ingesting the original registers the existing file.
    db.exec('DROP TRIGGER refuse_assets');
    db.close();
    assert.equal((await assets.ingestAsset(bytes, 'image/png')).created, true);
    boards.updateBoard(board.id, { document: withAsset(id) });
    report = await assets.inspectAssets();
    assert.deepEqual(report.referenced, [{ id, boards: [board.id] }]);
    assert.deepEqual(report.unregistered, []);
    assert.ok(existsSync(join(incoming, 'killed-writer.part')), 'Reports and ingestion never delete anything');
});

test('a new process on the same data root serves the asset; lost or damaged files are reported and repaired by re-ingest', async () => {
    const databasePath = dataRoot('restart');
    const first = loadApp(databasePath);
    const kept = await image('webp', 9), lost = await image('png', 11), damaged = await image('jpeg', 13), spare = await image('png', 15);
    const ids = {};
    for (const [name, bytes, type] of [['kept', kept, 'image/webp'], ['lost', lost, 'image/png'], ['damaged', damaged, 'image/jpeg'], ['spare', spare, 'image/png']]) {
        ids[name] = (await first.assets.ingestAsset(bytes, type)).asset.id;
    }
    const board = first.boards.createBoard('Restart');
    const document = { schemaVersion: 2, layerIds: ['a', 'b', 'c'], layers: {
        a: { ...withAsset(ids.kept).layers.picture }, b: { ...withAsset(ids.lost).layers.picture }, c: { ...withAsset(ids.damaged).layers.picture } } };
    first.boards.updateBoard(board.id, { document });
    const second = loadApp(databasePath);
    const { asset, path } = await second.assets.openAsset(ids.kept);
    assert.equal(asset.mediaType, 'image/webp');
    assert.deepEqual(readFileSync(path), kept, 'Same bytes after restart');
    assert.deepEqual(second.boards.getBoard(board.id).document, document);
    rmSync(second.assets.assetPath(ids.lost));
    const corrupted = Buffer.from(damaged); corrupted[corrupted.length - 3] ^= 0xff;
    writeFileSync(second.assets.assetPath(ids.damaged), corrupted);
    await assert.rejects(() => second.assets.openAsset(ids.lost), assetError('data-missing'));
    const report = await second.assets.inspectAssets();
    assert.deepEqual(report.missing, [
        { id: ids.lost, problem: 'absent', boards: [board.id] }, { id: ids.damaged, problem: 'hash-mismatch', boards: [board.id] },
    ].sort((a, b) => a.id.localeCompare(b.id)));
    assert.deepEqual(report.referenced, [{ id: ids.kept, boards: [board.id] }]);
    assert.deepEqual(report.unused, [ids.spare], 'Unreferenced assets are reported as unused and kept');
    assert.deepEqual(report.deletable, []);
    for (const [bytes, type] of [[lost, 'image/png'], [damaged, 'image/jpeg']]) assert.equal((await second.assets.ingestAsset(bytes, type)).created, false);
    assert.deepEqual(readFileSync(second.assets.assetPath(ids.damaged)), damaged, 'Re-ingest replaces the damaged copy');
    assert.deepEqual((await second.assets.inspectAssets()).missing, []);
    assert.ok(existsSync(second.assets.assetPath(ids.spare)), 'Unused asset file is not cleaned up');
});
