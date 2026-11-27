// Shared object-lock rules exercised through the real store and lock helper.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-locks-'));
after(() => rmSync(owned, { recursive: true, force: true }));
for (const file of ['types/canvas.ts', 'types/board.ts', 'types/extraction.ts', 'lib/document-version.ts', 'lib/object-locks.ts', 'store/use-board-store.ts']) {
    const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const target = join(owned, file.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, outputText);
}
const { BoardStore } = require(join(owned, 'store/use-board-store.js'));
const { isEffectivelyLocked, toggleObjectLocks, MIXED_LOCK_NOTICE, LOCKED_FRAME_NOTICE } = require(join(owned, 'lib/object-locks.js'));

const fill = { r: 1, g: 2, b: 3 };
const frame = (parentId, locked = false) => ({ type: 7, x: 0, y: 0, width: 100, height: 100, name: 'Frame', ...(parentId && { parentId }), ...(locked && { locked }) });
const rectangle = (parentId, locked = false) => ({ type: 0, x: 10, y: 10, width: 10, height: 10, fill, ...(parentId && { parentId }), ...(locked && { locked }) });

function setup(layers = { outer: frame(), inner: frame('outer'), child: rectangle('inner'), own: rectangle('inner', true), free: rectangle() }) {
    const ids = Object.keys(layers);
    globalThis.fetch = async () => ({ ok: true });
    const store = new BoardStore({ id: 'board', title: 'Locks', createdAt: 1, updatedAt: 1,
        document: { schemaVersion: 5, layerIds: ids, layers } });
    return store;
}

test('frame locks inherit through nested frames and unlocking preserves child locks', () => {
    const store = setup();
    toggleObjectLocks(store, ['outer']);
    assert.equal(isEffectivelyLocked(store.document, 'inner'), true);
    assert.equal(isEffectivelyLocked(store.document, 'child'), true);
    assert.equal(store.document.layers.child.locked, undefined, 'Inherited protection is not copied onto a child');
    assert.equal(store.document.layers.own.locked, true, 'The child own-lock bit is preserved');
    toggleObjectLocks(store, ['outer']);
    assert.equal(isEffectivelyLocked(store.document, 'child'), false);
    assert.equal(isEffectivelyLocked(store.document, 'own'), true);
    assert.equal(Object.hasOwn(store.document.layers.outer, 'locked'), false, 'Unlock removes the optional lock field');
});

test('lock changes are undoable and redoable', () => {
    const store = setup();
    toggleObjectLocks(store, ['child']);
    assert.equal(store.document.layers.child.locked, true);
    assert.equal(store.past.length, 1);
    store.history.undo();
    assert.equal(store.document.layers.child.locked, undefined);
    assert.equal(Object.hasOwn(store.document.layers.child, 'locked'), false);
    store.history.redo();
    assert.equal(store.document.layers.child.locked, true);
});

test('a mixed locked and unlocked geometry edit refuses atomically with a visible reason', () => {
    const store = setup({ locked: rectangle(undefined, true), free: rectangle() });
    store.mutate(({ storage }) => {
        storage.get('layers').get('free').set('x', 20);
        storage.get('layers').get('locked').set('x', 20);
    });
    assert.equal(store.document.layers.free.x, 10);
    assert.equal(store.document.layers.locked.x, 10);
    assert.equal(store.notice, MIXED_LOCK_NOTICE);
    assert.equal(store.past.length, 0);
});

test('effective locks block fill, text, deletion, z-order and reparenting', () => {
    const store = setup();
    toggleObjectLocks(store, ['outer']);
    const before = structuredClone(store.document);
    for (const edit of [
        ({ storage }) => storage.get('layers').get('child').set('fill', { r: 9, g: 8, b: 7 }),
        ({ storage }) => storage.get('layers').get('child').set('value', 'changed'),
        ({ storage }) => { storage.get('layers').delete('child'); storage.get('layerIds').delete(storage.get('layerIds').indexOf('child')); },
        ({ storage }) => storage.get('layerIds').move(2, 0),
        ({ storage }) => storage.get('layers').get('child').set('parentId', undefined),
    ]) {
        store.mutate(edit);
        assert.deepEqual(store.document, before);
        assert.match(store.notice, /locked/);
    }
});

test('reordering unlocked objects succeeds while a locked object keeps its relative order', () => {
    const store = setup({ locked: rectangle(undefined, true), first: rectangle(), second: rectangle() });
    const lockedLayer = store.document.layers.locked;
    store.mutate(({ storage }) => storage.get('layerIds').move(2, 1));
    assert.deepEqual(store.document.layerIds, ['locked', 'second', 'first']);
    assert.equal(store.document.layers.locked, lockedLayer, 'The locked object remains unchanged');
    assert.equal(store.notice, null);
    assert.equal(store.past.length, 1);
});

test('reparenting into a locked frame is refused and duplicates lose their own lock', () => {
    const store = setup({ target: frame(undefined, true), free: rectangle() });
    store.mutate(({ storage }) => storage.get('layers').get('free').set('parentId', 'target'));
    assert.equal(store.document.layers.free.parentId, undefined);
    assert.equal(store.notice, LOCKED_FRAME_NOTICE);
    store.mutate(({ storage }) => {
        const copy = storage.get('layers').get('target').clone();
        storage.get('layers').set('copy', copy);
        storage.get('layerIds').push('copy');
    });
    assert.equal(store.document.layers.copy.locked, undefined);
});
