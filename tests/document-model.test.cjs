// Document schema, relations and migration checks on synthetic SQLite copies.
// Compiles the real TypeScript sources with the installed compiler; no extra framework.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-document-model-'));
after(() => rmSync(owned, { recursive: true, force: true }));
// Last commit before explicit document versions; used to prove an app rollback still reads v2.
const PRE_VERSION_COMMIT = '81211c9';
const SOURCES = ['types/canvas.ts', 'types/board.ts', 'lib/sqlite.ts', 'lib/document-version.ts',
    'lib/document-migrations.ts', 'lib/boards.ts', 'store/use-board-store.ts'];

function compile(outDir, file, source) {
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const target = join(outDir, file.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, outputText);
    return target;
}
let builds = 0;
/** Fresh module instances bound to one disposable database file. */
function loadApp(databasePath) {
    const outDir = join(owned, `build-${++builds}`);
    for (const file of SOURCES) compile(outDir, file, readFileSync(join(root, file), 'utf8'));
    process.env.MIRO_SQLITE_PATH = databasePath;
    const load = file => require(join(outDir, file));
    return { boards: load('lib/boards.js'), version: load('lib/document-version.js'), migrations: load('lib/document-migrations.js'), store: load('store/use-board-store.js') };
}
const fill = { r: 10, g: 20, b: 30 };
/** Unversioned document with all five current layer types; record order differs from paint order. */
function legacyDocument() {
    return { layerIds: ['note-5', 'rect-1', 'path-3', 'ellipse-2', 'text-4'], layers: {
        'rect-1': { type: 0, x: 400, y: 260, width: 120, height: 80, fill },
        'ellipse-2': { type: 1, x: 640.5, y: 300.25, width: 90, height: 60, fill: { r: 255, g: 0, b: 0 }, value: '' },
        'path-3': { type: 2, x: 700, y: 420, width: 50, height: 25, fill, points: [[0, 0, 0.5], [25, 10, 0.5], [50, 25, 0.5]] },
        'text-4': { type: 3, x: 420, y: 420, width: 160, height: 50, fill, value: 'Synthetic text' },
        'note-5': { type: 4, x: 820, y: 240, width: 140, height: 140, fill: { r: 255, g: 249, b: 177 }, value: 'Synthetic note' },
    } };
}
function seed(databasePath, rows) {
    const db = new DatabaseSync(databasePath);
    db.exec('CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, document TEXT NOT NULL)');
    for (const [id, title, text] of rows) db.prepare('INSERT INTO boards VALUES (?, ?, 1000, 1000, ?)').run(id, title, text);
    db.close();
}
function row(databasePath, id) {
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try { return { ...db.prepare('SELECT * FROM boards WHERE id = ?').get(id) }; } finally { db.close(); }
}
const node = (type, extra = {}) => ({ type, x: 0, y: 0, width: 10, height: 10, fill, ...extra });
const current = (layers, layerIds = Object.keys(layers)) => ({ schemaVersion: 2, layerIds, layers });

test('pre-version documents open unchanged and save as v2 without losing IDs, order, title, geometry or content', () => {
    const databasePath = join(owned, 'upgrade.sqlite');
    const storedText = JSON.stringify(legacyDocument());
    seed(databasePath, [['legacy', 'Legacy board', storedText]]);
    const { boards } = loadApp(databasePath);
    const opened = boards.getBoard('legacy');
    assert.equal(opened.title, 'Legacy board');
    assert.deepEqual(opened.document, { schemaVersion: 2, ...legacyDocument() });
    assert.equal(row(databasePath, 'legacy').document, storedText, 'Opening must not rewrite the stored payload');
    boards.updateBoard('legacy', { document: opened.document });
    const saved = row(databasePath, 'legacy');
    assert.equal(saved.title, 'Legacy board');
    assert.deepEqual(JSON.parse(saved.document), { schemaVersion: 2, ...legacyDocument() });
    // An unversioned submission (for example from a client loaded before the upgrade) is upgraded, not refused.
    assert.equal(boards.updateBoard('legacy', { document: legacyDocument() }).document.schemaVersion, 2);
    assert.deepEqual(boards.createBoard('Fresh').document, { schemaVersion: 2, layerIds: [], layers: {} });
});

test('future schema versions are refused without rewriting the stored payload', () => {
    const databasePath = join(owned, 'future.sqlite');
    const futureText = '{"schemaVersion": 3, "layerIds": ["a"], "layers": {"a": {"type": 42, "shape": "unknown"}}}';
    seed(databasePath, [['future', 'Future board', futureText], ['ok', 'Readable', JSON.stringify(legacyDocument())]]);
    const { boards } = loadApp(databasePath);
    const before = row(databasePath, 'future');
    const refused = error => error instanceof boards.UnreadableBoardError && error.reason.code === 'unsupported-version' &&
        /version 3 is newer than supported version 2/.test(error.message);
    assert.throws(() => boards.getBoard('future'), refused);
    assert.throws(() => boards.updateBoard('future', { document: current({}) }), refused);
    assert.throws(() => boards.updateBoard('future', { title: 'Renamed' }), refused);
    assert.throws(() => boards.updateBoard('ok', { document: { schemaVersion: 3, layerIds: [], layers: {} } }),
        error => error.code === 'unsupported-version');
    assert.deepEqual(row(databasePath, 'future'), before, 'Title, payload text and timestamp stay byte-identical');
    const listed = Object.fromEntries(boards.listBoards().map(entry => [entry.id, entry]));
    assert.equal(listed.future.document, null);
    assert.equal(listed.future.documentError.code, 'unsupported-version');
    assert.equal(listed.ok.document.schemaVersion, 2);
});

test('validation separates duplicate IDs, missing references, cycles and unsupported records from accepted schema', () => {
    const databasePath = join(owned, 'validation.sqlite');
    const accepted = current({ frame: node(0, { locked: true }), inner: node(0, { parentId: 'frame' }), leaf: node(3, { parentId: 'inner', locked: false, value: 'x' }) });
    seed(databasePath, [['board', 'Validation', JSON.stringify(accepted)]]);
    const { boards, migrations } = loadApp(databasePath);
    assert.deepEqual(migrations.upgradeDocument(accepted), accepted);
    const cases = [
        ['duplicate-id', current({ a: node(0) }, ['a', 'a'])],
        ['missing-reference', current({ a: node(0) }, ['a', 'ghost'])],
        ['missing-reference', current({ a: node(0), b: node(0) }, ['a'])],
        ['missing-reference', current({ a: node(0, { parentId: 'ghost' }) })],
        ['cycle', current({ a: node(0, { parentId: 'a' }) })],
        ['cycle', current({ a: node(0, { parentId: 'c' }), b: node(0, { parentId: 'a' }), c: node(0, { parentId: 'b' }), d: node(0, { parentId: 'b' }) })],
        ['unsupported-record', current({ a: node(9) })],
        ['invalid-schema', current({ a: node(0, { locked: 'yes' }) })],
        ['invalid-schema', current({ a: node(0, { parentId: '' }) })],
        ['invalid-schema', current({ a: node(2, { points: [[0, 0, 0]] }) })],
        ['invalid-schema', { schemaVersion: 0, layerIds: [], layers: {} }],
    ];
    const before = row(databasePath, 'board');
    for (const [code, document] of cases) {
        assert.throws(() => migrations.upgradeDocument(document), error => error.code === code, `${code}: ${JSON.stringify(document)}`);
        assert.throws(() => boards.updateBoard('board', { document }), error => error.code === code);
    }
    assert.deepEqual(row(databasePath, 'board'), before, 'Refused saves leave the last accepted document in place');
    assert.equal(boards.getBoard('board').document.layers.leaf.parentId, 'inner');
});

test('effective lock inherits from every ancestor without copying own lock bits', () => {
    const { version, boards } = loadApp(join(owned, 'locks.sqlite'));
    const doc = current({ outer: node(0, { locked: true }), inner: node(0, { parentId: 'outer' }),
        ownLocked: node(3, { parentId: 'inner', locked: true }), free: node(3, { parentId: 'inner' }), root: node(1) });
    const effective = () => Object.fromEntries(doc.layerIds.map(id => [id, version.isEffectivelyLocked(doc, id)]));
    assert.deepEqual(effective(), { outer: true, inner: true, ownLocked: true, free: true, root: false });
    doc.layers.outer.locked = false;
    assert.deepEqual(effective(), { outer: false, inner: false, ownLocked: true, free: false, root: false });
    doc.layers.inner.locked = true;
    assert.deepEqual(effective(), { outer: false, inner: true, ownLocked: true, free: true, root: false });
    const board = boards.createBoard('Locks');
    const saved = boards.updateBoard(board.id, { document: doc }).document;
    assert.deepEqual(Object.fromEntries(doc.layerIds.map(id => [id, saved.layers[id].locked])),
        { outer: false, inner: true, ownLocked: true, free: undefined, root: undefined }, 'Only own lock bits persist');
});

test('store deletes a parent without dangling references and rolls back relation violations', async () => {
    const { store, version } = loadApp(join(owned, 'store.sqlite'));
    const saves = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => { saves.push(JSON.parse(init.body).document); return { ok: true }; };
    try {
        const document = current({ outer: node(0, { locked: true }), inner: node(0, { parentId: 'outer', x: 50 }), leaf: node(4, { parentId: 'inner', y: 70 }) });
        const board = new store.BoardStore({ id: 'b', title: 'Store', createdAt: 1, updatedAt: 1, document });
        board.mutate(({ storage }) => { storage.get('layers').delete('inner'); const ids = storage.get('layerIds'); ids.delete(ids.indexOf('inner')); });
        assert.deepEqual(board.document.layers.leaf, node(4, { parentId: 'outer', y: 70 }), 'Child moves up a level with unchanged geometry');
        assert.equal(version.isEffectivelyLocked(board.document, 'leaf'), true);
        const snapshot = structuredClone(board.document);
        assert.throws(() => board.mutate(({ storage }) => { storage.get('layers').get('outer').set('parentId', 'leaf'); }),
            error => error instanceof version.DocumentError && error.code === 'cycle');
        assert.deepEqual(board.document, snapshot, 'Rejected mutation is rolled back');
        assert.equal(board.past.length, 1, 'Rejected mutation adds no history entry');
        await board.queue;
        assert.equal(saves.length, 1, 'Rejected mutation enqueues no save');
        assert.deepEqual(saves[0], snapshot);
    } finally { globalThis.fetch = realFetch; }
});

test('upgrade, app rollback and backup recovery on synthetic database copies', () => {
    const original = join(owned, 'rollback-original.sqlite');
    seed(original, [['one', 'First', JSON.stringify(legacyDocument())], ['two', 'Second', JSON.stringify({ layerIds: [], layers: {} })]]);
    const backup = join(owned, 'rollback-backup.sqlite');
    copyFileSync(original, backup);
    const working = join(owned, 'rollback-working.sqlite');
    copyFileSync(original, working);
    // Upgrade every board on the working copy and add v2-only relation fields.
    const upgraded = loadApp(working).boards;
    for (const id of ['one', 'two']) upgraded.updateBoard(id, { document: upgraded.getBoard(id).document });
    const withRelations = upgraded.getBoard('one').document;
    withRelations.layers['text-4'].parentId = 'rect-1';
    withRelations.layers['rect-1'].locked = true;
    upgraded.updateBoard('one', { document: withRelations });
    // Rollback: the pre-version validator still accepts v2 payloads and keeps the unknown fields it saves back.
    const legacySource = execFileSync('git', ['show', `${PRE_VERSION_COMMIT}:types/board.ts`], { cwd: root, encoding: 'utf8' });
    const legacy = require(compile(join(owned, 'pre-version'), 'types/board.ts', legacySource));
    const resaved = JSON.stringify(legacy.validateDocument(JSON.parse(row(working, 'one').document)));
    assert.deepEqual(JSON.parse(resaved), withRelations);
    assert.deepEqual(loadApp(working).boards.getBoard('one').document, withRelations, 'Upgraded app reopens the rolled-back save');
    // Recovery: the pre-upgrade copy is untouched and opens with the same content.
    assert.equal(row(backup, 'one').document, JSON.stringify(legacyDocument()));
    const restored = loadApp(backup).boards;
    assert.deepEqual(restored.getBoard('one').document, { schemaVersion: 2, ...legacyDocument() });
    assert.equal(restored.getBoard('two').title, 'Second');
});
