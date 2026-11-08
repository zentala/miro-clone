// Board store checks on the real TypeScript source: copy-on-write history, saves per gesture, re-render signals.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-board-store-'));
after(() => rmSync(owned, { recursive: true, force: true }));
for (const file of ['types/canvas.ts', 'types/board.ts', 'lib/document-version.ts', 'store/use-board-store.ts']) {
    const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const target = join(owned, file.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, outputText);
}
const { BoardStore } = require(join(owned, 'store/use-board-store.js'));

const fill = { r: 1, g: 2, b: 3 };
const layer = (x, extra = {}) => ({ type: 0, x, y: 0, width: 10, height: 10, fill, ...extra });
function setup() {
    const saves = [];
    globalThis.fetch = async (_url, init) => { saves.push(JSON.parse(init.body).document); return { ok: true }; };
    const document = { schemaVersion: 2, layerIds: ['a', 'b', 'c'], layers: { a: layer(0), b: layer(20), c: layer(40) } };
    const store = new BoardStore({ id: 'board', title: 'Store', createdAt: 1, updatedAt: 1, document });
    let renders = 0;
    store.changed = () => { renders++; };
    const move = (id, dx) => store.mutate(({ storage }) => { const l = storage.get('layers').get(id); l.update({ x: l.get('x') + dx }); });
    return { store, saves, move, renders: () => renders };
}
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; });

test('history snapshots stay intact while later edits change the same and other layers', async () => {
    const { store, move } = setup();
    const states = [structuredClone(store.document)];
    move('a', 5); states.push(structuredClone(store.document));
    move('a', 7); states.push(structuredClone(store.document));
    store.mutate(({ storage }) => { storage.get('layers').get('b').set('fill', { r: 9, g: 9, b: 9 }); });
    states.push(structuredClone(store.document));
    store.mutate(({ storage }) => { storage.get('layers').delete('c'); const ids = storage.get('layerIds'); ids.delete(ids.indexOf('c')); });
    states.push(structuredClone(store.document));
    for (let i = states.length - 2; i >= 0; i--) { store.history.undo(); assert.deepEqual(store.document, states[i], `undo to state ${i}`); }
    for (let i = 1; i < states.length; i++) { store.history.redo(); assert.deepEqual(store.document, states[i], `redo to state ${i}`); }
    store.history.undo(); store.history.undo();
    move('b', 1);
    assert.equal(store.future.length, 0, 'A new edit clears redo');
    assert.equal(store.document.layers.a.x, 12);
    store.history.undo();
    assert.deepEqual(store.document, states[2]);
    await store.queue;
});

test('unchanged writes add no history and no save; a refused relation rolls back without touching history', async () => {
    const { store, saves, move } = setup();
    store.mutate(({ storage }) => { storage.get('layers').get('a').set('x', 0); });
    move('b', 0);
    store.mutate(({ storage }) => { storage.get('layerIds').move(1, 1); });
    assert.equal(store.past.length, 0);
    await store.queue;
    assert.equal(saves.length, 0);
    move('a', 3);
    const snapshot = structuredClone(store.document);
    assert.throws(() => store.mutate(({ storage }) => { storage.get('layers').get('a').set('parentId', 'missing'); }));
    assert.deepEqual(store.document, snapshot);
    store.history.undo();
    assert.equal(store.document.layers.a.x, 0, 'Earlier snapshot was not changed by the refused edit');
    await store.queue;
});

test('a paused gesture is one history entry and one save, sent when the gesture ends', async () => {
    const { store, saves, move } = setup();
    store.history.pause();
    for (let i = 0; i < 5; i++) move('a', 2);
    assert.equal(store.past.length, 1);
    assert.equal(store.pending, 1, 'Deferred save counts as pending');
    assert.equal(store.status, 'Saving…');
    await store.queue;
    assert.equal(saves.length, 0, 'Nothing is sent during the gesture');
    store.history.resume();
    await store.queue;
    assert.equal(saves.length, 1);
    assert.equal(saves[0].layers.a.x, 10);
    assert.equal(store.pending, 0); assert.equal(store.status, 'Saved');
    store.history.pause(); move('a', 1); store.history.undo();
    await store.queue;
    assert.equal(store.pending, 0, 'Undo during a gesture drops the deferred save');
    assert.equal(saves.at(-1).layers.a.x, 10);
});

test('cursor-only presence updates do not re-render; selection and content changes do', () => {
    const { store, renders } = setup();
    store.mutate(({ setMyPresence }) => setMyPresence({ cursor: { x: 1, y: 2 } }));
    assert.equal(renders(), 0);
    store.mutate(({ setMyPresence }) => setMyPresence({ selection: ['a'] }));
    assert.equal(renders(), 1);
    store.refuse('Board is full');
    assert.equal(store.notice, 'Board is full');
    store.mutate(({ storage }) => { storage.get('layers').get('a').set('x', 4); });
    assert.equal(store.notice, null, 'The next change clears the notice');
});
