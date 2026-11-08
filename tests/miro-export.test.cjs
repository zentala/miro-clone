// Read-only Miro structural exporter, exercised on synthetic SDK responses only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const MiroExport = require('../tools/miro-export/export.js');

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/migration/synthetic-source.json'), 'utf8'));
const EXPORTED_AT = '2026-11-08T12:00:00.000Z';
const READ_METHODS = new Set(['get', 'getInfo']);

/** A fake SDK board that records every property it is asked for. */
function recordingBoard(info, items) {
    const accessed = [];
    const target = { getInfo: async () => info, get: async () => items };
    const board = new Proxy(target, {
        get(object, key) {
            accessed.push(String(key));
            return object[key] ?? (() => { throw new Error(`Unexpected board call ${String(key)}`); });
        },
    });
    return { board, accessed };
}

const exportFixture = () => MiroExport.buildPackage(fixture.boardInfo, fixture.items, EXPORTED_AT);
const byId = (pkg, id) => pkg.records.find(record => record.id === id);

test('reads with boards:read methods only and never touches item methods', async () => {
    const { board, accessed } = recordingBoard(fixture.boardInfo, fixture.items);
    const pkg = await MiroExport.exportBoard(board, () => EXPORTED_AT);
    assert.deepEqual(pkg.source.scopes, ['boards:read']);
    assert.ok(accessed.length > 0 && accessed.every(name => READ_METHODS.has(name)), `accessed: ${accessed}`);
    // The recorder itself must see a write attempt (decoy), or the check above proves nothing.
    const decoy = recordingBoard({}, []);
    assert.throws(() => decoy.board.createStickyNote({}), /Unexpected board call createStickyNote/);
    assert.deepEqual(decoy.accessed, ['createStickyNote']);
});

test('exporter and app page reference no board write API', () => {
    const allowed = new Set(['get', 'getInfo']);
    for (const file of ['export.js', 'index.html']) {
        const source = readFileSync(join(__dirname, '../tools/miro-export', file), 'utf8');
        assert.ok(/\bboard\.get\s*\(/.test(source) || file === 'index.html', 'scan must see the read call');
        const used = [...source.matchAll(/\bboard\.(\w+)\s*\(/g)].map(match => match[1]);
        assert.deepEqual(used.filter(name => !allowed.has(name)), [], `${file} uses board methods outside the read set`);
        const ui = [...source.matchAll(/\bboard\.ui\.(\w+)\s*\(/g)].map(match => match[1]);
        assert.deepEqual(ui.filter(name => !['on', 'openPanel'].includes(name)), [], `${file} uses unexpected UI calls`);
    }
});

test('preserves exact string IDs, raw records and SDK order', () => {
    const pkg = exportFixture();
    assert.equal(pkg.records.length, fixture.items.length);
    pkg.records.forEach((record, index) => {
        assert.equal(record.sourceIndex, index);
        assert.equal(record.id, fixture.items[index].id);
        assert.equal(typeof record.id, 'string');
        assert.deepEqual(record.raw, fixture.items[index], `raw record ${record.id} must equal the source`);
    });
    assert.ok(Number(byId(pkg, '3458764517517852417').id) > Number.MAX_SAFE_INTEGER);
    assert.deepEqual(pkg.source.board, fixture.boardInfo);
});

test('keeps geometry as read with its coordinate convention', () => {
    const pkg = exportFixture();
    assert.match(pkg.coordinateConvention.canvas_center, /board center/);
    assert.match(pkg.coordinateConvention.parent_top_left, /parent frame top-left/);
    assert.match(pkg.coordinateConvention.conversion, /none/);
    assert.deepEqual(byId(pkg, '3458764517517852420').geometry,
        { x: 1200, y: 300, width: 800, height: 600, rotation: 15, origin: 'center', relativeTo: 'parent_top_left' });
    assert.deepEqual(byId(pkg, '3458764517517852423').geometry,
        { x: -1500, y: 800, width: 300, height: null, rotation: -30, origin: 'center', relativeTo: 'canvas_center' });
    assert.equal(byId(pkg, '3458764517517852427').geometry, null, 'connectors have no x/y');
});

test('records parent, group, tag and connector relations', () => {
    const pkg = exportFixture();
    assert.equal(byId(pkg, '3458764517517852421').relations.parentId, '3458764517517852418');
    assert.equal(byId(pkg, '3458764517517852418').relations.parentId, '3458764517517852417');
    assert.deepEqual(byId(pkg, '3458764517517852417').relations.childrenIds.length, 3);
    const sticky = byId(pkg, '3458764517517852419').relations;
    assert.equal(sticky.groupId, '3458764517517852430');
    assert.deepEqual(sticky.tagIds, ['3458764517517852440']);
    assert.deepEqual(byId(pkg, '3458764517517852430').relations.itemsIds, ['3458764517517852419', '3458764517517852420']);
    const connector = byId(pkg, '3458764517517852427').relations;
    assert.deepEqual([connector.connectorStart, connector.connectorEnd], ['3458764517517852419', '3458764517517852424']);
    assert.equal(pkg.losses.filter(entry => entry.kind === 'dangling-reference').length, 0);
});

test('keeps exact URLs and maps image assets', () => {
    const pkg = exportFixture();
    const urls = id => byId(pkg, id).urls.map(entry => entry.url);
    assert.deepEqual(urls('3458764517517852421'), ['https://shop.example.test/product/123?variant=blue&ref=board']);
    assert.deepEqual(urls('3458764517517852422'), ['https://video.example.test/watch?v=SYNTHETIC', 'https://video.example.test/thumb/SYNTHETIC.jpg']);
    assert.deepEqual(urls('3458764517517852419'), ['https://example.com/docs?a=1&b=2#part', 'https://example.org/path_(x)']);
    assert.match(byId(pkg, '3458764517517852419').raw.content, /docs\?a=1&amp;b=2#part/, 'raw HTML stays verbatim');
    assert.deepEqual(urls('3458764517517852423'), ['https://example.net/linked-object']);
    assert.deepEqual(urls('3458764517517852425'), ['https://tracker.example.test/issue/7']);
    assert.deepEqual(pkg.assets, [{
        assetId: 'miro-image-3458764517517852420', itemId: '3458764517517852420', kind: 'image',
        url: fixture.items[3].url, title: 'Synthetic product photo', alt: 'A gray placeholder rectangle',
        retrieval: 'Image.getFile("original") under boards:read', retrieved: false,
    }]);
    assert.deepEqual(byId(pkg, '3458764517517852420').assetIds, ['miro-image-3458764517517852420']);
});

test('decodes HTML entities in links and trims sentence punctuation from bare URLs', () => {
    const content = '<p><a href="https://a.test/p?x=1&amp;y=2&#38;z=3&#x26;w=4">link</a> See https://x.test/a. '
        + 'Also (https://x.test/b), https://x.test/c; https://x.test/d!? and https://w.test/wiki/Foo_(bar). '
        + '&quot;https://x.test/e&quot; https://x.test/f?a=1&amp;b=2. [https://x.test/g] https://x.test/h&lt;b&gt;</p>';
    const item = { id: 'u1', type: 'sticky_note', x: 0, y: 0, content, description: "Plain 'https://x.test/i'!" };
    const [record] = MiroExport.buildPackage({}, [item], EXPORTED_AT).records;
    assert.deepEqual(record.urls.filter(entry => entry.field === 'content').map(entry => entry.url), [
        'https://a.test/p?x=1&y=2&z=3&w=4', 'https://x.test/a', 'https://x.test/b', 'https://x.test/c', 'https://x.test/d',
        'https://w.test/wiki/Foo_(bar)', 'https://x.test/e', 'https://x.test/f?a=1&b=2', 'https://x.test/g', 'https://x.test/h',
    ]);
    assert.deepEqual(record.urls.filter(entry => entry.field === 'description').map(entry => entry.url), ['https://x.test/i']);
    assert.equal(record.raw.content, content, 'raw content stays verbatim');
});

test('accounts for every record and reports opaque, unknown and type losses', () => {
    const pkg = exportFixture();
    const { total, byStatus, byType } = pkg.coverage;
    assert.equal(total, fixture.items.length);
    assert.equal(Object.values(byStatus).reduce((sum, count) => sum + count, 0), total);
    assert.deepEqual(byStatus, { supported: 13, opaque: 1, unknown: 1, failed: 0 });
    const kinds = id => pkg.losses.filter(entry => entry.itemId === id).map(entry => entry.kind);
    assert.deepEqual(kinds('3458764517517852428'), ['opaque-content']);
    assert.deepEqual(kinds('3458764517517852429'), ['unknown-type']);
    assert.deepEqual(byId(pkg, '3458764517517852429').raw.payload, { opaque: [1, 2, 3] });
    assert.deepEqual(kinds('3458764517517852420'), ['asset-not-retrieved']);
    assert.deepEqual(kinds('3458764517517852427'), ['connector-route']);
    assert.deepEqual(kinds('3458764517517852421'), ['preview-metadata']);
    assert.ok(pkg.losses.some(entry => entry.kind === 'paint-order-unverified'));
    assert.equal(byType.future_widget.webSdk, 'unknown');
    assert.equal(byType.frame.count, 2);
});

test('compares Web SDK and REST support and marks other formats non-structural', () => {
    const { capabilities, otherFormats } = exportFixture().context;
    assert.deepEqual([capabilities.preview.webSdk, capabilities.preview.rest], ['read', 'none']);
    assert.equal(capabilities.unsupported.status, 'opaque');
    for (const type of ['connector', 'frame', 'image']) assert.equal(capabilities[type].rest, 'read');
    assert.deepEqual(otherFormats.map(entry => entry.structural), [false, false, false]);
    assert.match(otherFormats.map(entry => entry.format).join(' '), /PDF\/SVG.*CSV.*rtb/);
});

test('empty board still lists image, preview, connector, frame and unsupported coverage', () => {
    const pkg = MiroExport.buildPackage({ id: 'empty' }, [], EXPORTED_AT);
    assert.equal(pkg.coverage.total, 0);
    for (const type of ['image', 'preview', 'connector', 'frame', 'unsupported']) assert.equal(pkg.coverage.byType[type].count, 0);
    assert.deepEqual(pkg.records, []); assert.deepEqual(pkg.assets, []);
});

test('nil inputs: missing item list refuses, missing board info still exports', () => {
    assert.throws(() => MiroExport.buildPackage({}, null, EXPORTED_AT), /must return an array/);
    assert.deepEqual(MiroExport.buildPackage(null, [], EXPORTED_AT).source.board, {});
});

test('SDK read failure propagates instead of producing a partial export', async () => {
    const board = { getInfo: async () => ({ id: 'x' }), get: async () => { throw new Error('rate limited'); } };
    await assert.rejects(() => MiroExport.exportBoard(board, () => EXPORTED_AT), /rate limited/);
});

test('malformed records are retained as failed with actionable reasons', () => {
    const items = [
        { id: 3458764517517852000, type: 'shape', x: 0, y: 0 },
        { id: 'a', type: 'shape', x: 0, y: 0, parentId: 'missing-frame' },
        { id: 'a', type: 'text', x: 1, y: 1 },
        { id: 'b' },
        null,
        { id: '__proto__', type: '__proto__', x: 0, y: 0 },
    ];
    const pkg = MiroExport.buildPackage({}, items, EXPORTED_AT);
    assert.deepEqual(pkg.records.map(record => record.status), ['failed', 'supported', 'failed', 'failed', 'failed', 'unknown']);
    const failures = pkg.losses.filter(entry => entry.kind === 'failed-record').map(entry => entry.detail);
    assert.match(failures[0], /index 0: ID is not a nonempty string/);
    assert.match(failures[1], /index 2: Duplicate ID a/);
    assert.match(failures[2], /index 3: Record b has no type/);
    assert.match(failures[3], /index 4: Record is not an object/);
    assert.deepEqual(pkg.records[2].raw, { id: 'a', type: 'text', x: 1, y: 1 });
    assert.ok(pkg.losses.some(entry => entry.itemId === 'a' && /missing-frame/.test(entry.detail)));
    assert.equal(pkg.coverage.byType.__proto__.count, 1);
    assert.equal(Object.prototype.count, undefined);
});

/** SDK-like item: data behind prototype getters, write methods that must never run. */
class SdkItem {
    #data;
    constructor(data) { this.#data = data; }
    get id() { return this.#data.id; }
    get type() { return this.#data.type; }
    get x() { return this.#data.x; }
    get y() { return this.#data.y; }
    get width() { return this.#data.width; }
    get parentId() { return this.#data.parentId; }
    get url() { return this.#data.url; }
    sync() { throw new Error('sync must not be called'); }
    setMetadata() { throw new Error('setMetadata must not be called'); }
}

function generatedBoard(count, seed) {
    const types = ['sticky_note', 'image', 'preview', 'frame', 'connector', 'unsupported', 'shape', 'text'];
    let state = seed;
    const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
    return Array.from({ length: count }, (_, index) => {
        const type = types[Math.floor(next() * types.length)];
        const id = `9007199254740${String(993 + index).padStart(6, '0')}`;
        const url = type === 'image' || type === 'preview' ? `https://assets.example.test/${index}?q=${Math.floor(next() * 1e6)}` : undefined;
        return new SdkItem({ id, type, x: Math.round(next() * 2e5) - 1e5, y: Math.round(next() * 2e5) - 1e5, width: 100, parentId: null, url });
    });
}

test('generated 2,000-item board: complete, deterministic, getter-backed SDK objects', async () => {
    const items = generatedBoard(2000, 42);
    const first = await MiroExport.exportBoard(recordingBoard({ id: 'generated' }, items).board, () => EXPORTED_AT);
    const second = MiroExport.buildPackage({ id: 'generated' }, generatedBoard(2000, 42), EXPORTED_AT);
    assert.deepEqual(first, second);
    assert.equal(first.coverage.total, 2000);
    assert.equal(first.coverage.byStatus.failed, 0);
    assert.equal(new Set(first.records.map(record => record.id)).size, 2000);
    assert.equal(first.assets.length, first.coverage.byType.image.count);
    first.records.forEach((record, index) => {
        assert.equal(record.id, items[index].id);
        assert.equal(record.geometry.x, items[index].x);
    });
    assert.ok(!JSON.stringify(first).includes('must not be called'));
    assert.equal(MiroExport.fileNameFor(first), 'miro-export-generated-2026-11-08T12-00-00-000Z.json');
});
