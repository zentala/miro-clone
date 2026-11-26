// Frame containment, movement history, persistence validation and paint ordering.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-frames-'));
after(() => rmSync(owned, { recursive: true, force: true }));
const sources = ['types/extraction.ts', 'types/canvas.ts', 'types/board.ts', 'lib/document-version.ts', 'store/use-board-store.ts'];
for (const file of sources) {
    const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const target = join(owned, file.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, outputText);
}
const version = require(join(owned, 'lib/document-version.js'));
const { BoardStore, moveLayerSubtrees } = require(join(owned, 'store/use-board-store.js'));
const fill = { r: 20, g: 30, b: 40 };
const frame = (x, y, extra = {}) => ({ type: 7, x, y, width: 200, height: 120, name: 'Frame', ...extra });
const shape = (x, y, extra = {}) => ({ type: 0, x, y, width: 40, height: 30, fill, ...extra });

test('frame paint order is a stable topological order after assigning a later ancestor', () => {
    const layerIds = ['inner', 'unrelated', 'outer'];
    const layers = new Map([
        ['inner', frame(0, 0)],
        ['unrelated', frame(10, 10)],
        ['outer', frame(20, 20)],
    ]);
    assert.deepEqual(version.framesBehindLayers(layerIds, layers), ['inner', 'unrelated', 'outer']);
    layers.set('inner', { ...layers.get('inner'), parentId: 'outer' });
    assert.deepEqual(version.framesBehindLayers(layerIds, layers), ['unrelated', 'outer', 'inner'],
        'The eligible unrelated frame retains its position ahead of the newly required ancestor');
});

test('only a frame can be the persistent parent of a layer', () => {
    const valid = { schemaVersion: 5, layerIds: ['frame', 'child'], layers: {
        frame: frame(0, 0),
        child: shape(500, 600, { parentId: 'frame' }),
    } };
    assert.deepEqual(version.validateDocument(valid), valid);

    const invalid = { schemaVersion: 5, layerIds: ['shape-parent', 'child'], layers: {
        'shape-parent': shape(0, 0),
        child: shape(50, 50, { parentId: 'shape-parent' }),
    } };
    assert.throws(() => version.validateDocument(invalid), error => error.code === 'invalid-schema');
});

test('nested frame assignment orders ancestors first; shrink, move, undo and redo preserve descendants once', async () => {
    const document = { schemaVersion: 5, layerIds: ['inner', 'outer', 'shape'], layers: {
        shape: shape(500, 600, { parentId: 'inner' }),
        outer: frame(10, 20),
        inner: frame(40, 50, { name: 'Inner' }),
    } };
    const board = new BoardStore({ id: 'frames', title: 'Synthetic', createdAt: 1, updatedAt: 1, document });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true });
    try {
        const originalShape = { x: board.document.layers.shape.x, y: board.document.layers.shape.y };
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['inner', 'outer', 'shape']);
        board.mutate(({ storage }) => storage.get('layers').get('inner').set('parentId', 'outer'));
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['outer', 'inner', 'shape'],
            'A later-assigned ancestor paints before the inner frame');
        board.mutate(({ storage }) => storage.get('layers').get('inner').set('parentId', undefined));
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['inner', 'outer', 'shape'],
            'Detaching restores the stable unrelated frame order');
        board.mutate(({ storage }) => storage.get('layers').get('inner').set('parentId', 'outer'));
        board.history.undo();
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['inner', 'outer', 'shape']);
        board.history.redo();
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['outer', 'inner', 'shape']);
        board.mutate(({ storage }) => {
            storage.get('layers').get('outer').update({ width: 80, height: 60 });
        });
        assert.deepEqual({ x: board.document.layers.shape.x, y: board.document.layers.shape.y }, originalShape,
            'Shrinking changes only frame bounds and does not detach outside descendants');
        assert.equal(board.document.layers.shape.parentId, 'inner');
        board.mutate(({ storage }) => storage.get('layers').get('shape').set('parentId', 'outer'));
        assert.deepEqual({ x: board.document.layers.shape.x, y: board.document.layers.shape.y }, originalShape,
            'Reparenting changes containment only, never absolute geometry');
        board.mutate(({ storage }) => storage.get('layers').get('shape').set('parentId', 'inner'));

        board.mutate(({ storage }) => moveLayerSubtrees(storage.get('layers'), storage.get('layerIds').toImmutable(), ['outer', 'shape'], { x: 12, y: -8 }));
        assert.deepEqual({ x: board.document.layers.outer.x, y: board.document.layers.outer.y }, { x: 22, y: 12 });
        assert.deepEqual({ x: board.document.layers.inner.x, y: board.document.layers.inner.y }, { x: 52, y: 42 });
        assert.deepEqual({ x: board.document.layers.shape.x, y: board.document.layers.shape.y }, { x: 512, y: 592 },
            'A selected descendant overlapping the frame selection moves once');
        assert.deepEqual(version.framesBehindLayers(board.document.layerIds, new Map(Object.entries(board.document.layers))), ['outer', 'inner', 'shape']);

        board.history.undo();
        assert.deepEqual({ x: board.document.layers.shape.x, y: board.document.layers.shape.y }, originalShape);
        board.history.redo();
        assert.equal(board.document.layers.shape.x, 512);
        const reloaded = version.validateDocument(JSON.parse(JSON.stringify(board.document)));
        assert.deepEqual(reloaded, board.document,
            'Nested frame names, relations, bounds and geometry survive a serialized reload');
        assert.deepEqual(version.framesBehindLayers(reloaded.layerIds, new Map(Object.entries(reloaded.layers))), ['outer', 'inner', 'shape'],
            'Reload keeps the ancestor before its descendant in paint order');
        assert.throws(() => board.mutate(({ storage }) => storage.get('layers').get('outer').set('parentId', 'inner')),
            error => error.code === 'cycle');
        await board.queue;
    } finally {
        globalThis.fetch = previousFetch;
    }
});
