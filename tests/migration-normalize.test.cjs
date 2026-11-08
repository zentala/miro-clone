// Migration normalization and dry run (E001-T16), on synthetic exports only.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const MiroExport = require('../tools/miro-export/export.js');

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/migration/synthetic-source.json'), 'utf8'));
const DRY_RUN = join(__dirname, '../scripts/migration/dry-run.mjs');
const EXPORTED_AT = '2026-11-08T12:00:00.000Z';
const ID = suffix => `34587645175178524${suffix}`;
let normalizeExport, InvalidPackageError, formatReport;

before(async () => {
    ({ normalizeExport, InvalidPackageError } = await import('../lib/migration/normalize.ts'));
    ({ formatReport } = await import('../lib/migration/report.ts'));
});

const exportOf = (items, info = fixture.boardInfo) => MiroExport.buildPackage(info, items, EXPORTED_AT);
const item = (pkg, id) => pkg.items.find(entry => entry.sourceId === id);
const lossKinds = (pkg, id) => pkg.losses.filter(entry => entry.itemId === id).map(entry => entry.kind);

test('retains raw records, string IDs, assets, relations and exact URLs', () => {
    const source = exportOf(fixture.items);
    const pkg = normalizeExport(source);
    assert.equal(pkg.items.length, fixture.items.length);
    pkg.items.forEach((entry, index) => {
        assert.equal(entry.sourceId, fixture.items[index].id);
        assert.equal(typeof entry.sourceId, 'string');
        assert.deepEqual(entry.raw, fixture.items[index], 'raw record must equal the SDK item');
        assert.deepEqual(entry.urls, source.records[index].urls, 'URLs stay exactly as exported');
    });
    assert.deepEqual(item(pkg, ID(21)).urls.map(entry => entry.url), ['https://shop.example.test/product/123?variant=blue&ref=board']);
    assert.equal(pkg.assets[0].url, fixture.items[3].url);
    assert.equal(pkg.assets[0].status, 'referenced');
    assert.equal(item(pkg, ID(19)).relations.groupId, ID(30));
    assert.deepEqual(item(pkg, ID(19)).relations.tagIds, [ID(40)]);
    assert.equal(item(pkg, ID(21)).relations.parentId, ID(18));
    assert.deepEqual(item(pkg, ID(30)).relations.itemsIds, [ID(19), ID(20)]);
    assert.deepEqual(Object.keys(pkg.coordinates.conversions), ['canvas_center', 'parent_top_left', 'parent_center', 'missing']);
    assert.match(pkg.coordinates.screen, /camera/);
    assert.match(pkg.coordinates.world, /top-left|left\/top/);
});

// Expected world boxes calculated by hand from the fixture, independent of the code under test.
const EXPECTED_WORLD = {
    [ID(17)]: { centerX: 0, centerY: 0, left: -1000, top: -600, width: 2000, height: 1200, rotation: 0 },
    [ID(18)]: { centerX: -500, centerY: -200, left: -800, top: -400, width: 600, height: 400, rotation: 0 },
    [ID(19)]: { centerX: -850, centerY: -440, left: -949.5, top: -554, width: 199, height: 228, rotation: 0 },
    [ID(20)]: { centerX: 200, centerY: -300, left: -200, top: -600, width: 800, height: 600, rotation: 15 },
    [ID(21)]: { centerX: -500, centerY: -200, left: -625, top: -350, width: 250, height: 300, rotation: 0 },
    [ID(23)]: { centerX: -1500, centerY: 800, left: -1650, top: null, width: 300, height: null, rotation: -30 },
};

test('synthetic geometry comparison: world boxes and frame containment', () => {
    const pkg = normalizeExport(exportOf(fixture.items));
    for (const [id, world] of Object.entries(EXPECTED_WORLD)) assert.deepEqual(item(pkg, id).world, world, id);
    const inside = (child, parent) => child.left >= parent.left && child.top >= parent.top
        && child.left + child.width <= parent.left + parent.width && child.top + child.height <= parent.top + parent.height;
    for (const entry of pkg.items.filter(candidate => candidate.relations?.parentId && candidate.world?.top !== null)) {
        if (entry.world.rotation !== 0) continue;
        assert.ok(inside(entry.world, item(pkg, entry.relations.parentId).world), `${entry.sourceId} must lie inside its frame`);
    }
    assert.equal(item(pkg, ID(27)).world, null, 'connectors have no position');
    assert.deepEqual(item(pkg, ID(18)).transforms, ['coordinates converted from parent_top_left to world']);
    assert.deepEqual(item(pkg, ID(29)).transforms, ['relativeTo missing; assumed canvas_center']);
    assert.equal(pkg.fidelity.realSource.status, 'NOT_CHECKED');
    assert.equal(pkg.fidelity.syntheticGeometry.status, 'NOT_PERFORMED_HERE');
    assert.match(pkg.coordinates.assumptions[0], /Axis direction.*NOT_CHECKED/);
});

test('accounts for every record and gives images, connectors and frames explicit losses', () => {
    const pkg = normalizeExport(exportOf(fixture.items));
    const { total, byStatus } = pkg.coverage;
    assert.equal(total, fixture.items.length);
    assert.deepEqual(byStatus, { supported: 9, transformed: 4, unknown: 2, failed: 0 });
    assert.equal(Object.values(byStatus).reduce((sum, count) => sum + count, 0), total);
    assert.deepEqual(pkg.items.map(entry => entry.status).filter(status => !['supported', 'transformed'].includes(status)), ['unknown', 'unknown']);
    assert.deepEqual(lossKinds(pkg, ID(20)), ['asset-not-retrieved', 'editor-support', 'rotation-unsupported']);
    assert.deepEqual(lossKinds(pkg, ID(27)), ['connector-route', 'editor-support']);
    for (const frame of [ID(17), ID(18)]) assert.deepEqual(lossKinds(pkg, frame), ['editor-support']);
    assert.ok(pkg.losses.some(entry => entry.kind === 'rest-coverage-unverified'));
    assert.ok(pkg.losses.some(entry => entry.kind === 'axis-direction-unverified'));
    assert.equal(item(pkg, ID(24)).editor.status, 'none', 'round_rectangle is not coerced into a rectangle');
    assert.equal(item(pkg, ID(24)).kind, 'shape');
    assert.equal(item(pkg, ID(28)).kind, null);
    assert.deepEqual(item(pkg, ID(28)).raw, fixture.items[11], 'opaque item stays recoverable');
});

test('flags markup for sanitization at import without rendering or sanitizing it', () => {
    const payload = '<img src=x onerror="globalThis.__t16=1"><script>globalThis.__t16=2</script>Hello';
    const items = [{ id: 'm1', type: 'sticky_note', x: 0, y: 0, width: 10, height: 10, content: payload, origin: 'center', relativeTo: 'canvas_center' },
        { id: 'm2', type: 'connector', captions: [{ content: '<b>bold</b>' }], start: { item: 'm1' }, end: { item: 'm1' } },
        { id: 'p1', type: 'card', x: 0, y: 0, title: 'Plain title', description: 'No markup here' }];
    const pkg = normalizeExport(exportOf(items));
    assert.deepEqual(item(pkg, 'm1').markup, { fields: ['content'], requiresSanitization: true });
    assert.deepEqual(item(pkg, 'm2').markup.fields, ['captions[0].content']);
    assert.equal(item(pkg, 'p1').markup, null);
    assert.equal(item(pkg, 'm1').raw.content, payload, 'content is kept verbatim for the importer to sanitize');
    assert.deepEqual(pkg.sanitization, { required: 2, performedHere: false, at: 'import (E001-T17) with the E001-T10 sanitizer' });
    assert.deepEqual(lossKinds(pkg, 'm1'), ['requires-sanitization']);
    const report = formatReport(pkg);
    assert.match(report, /Requires sanitization at import: 2 records/);
    assert.doesNotMatch(report, /onerror|<script|<b>/, 'the report never prints markup');
    assert.equal(globalThis.__t16, undefined, 'nothing executed');
});

test('parent cycles, duplicate IDs, missing parents and missing assets give actionable errors', () => {
    const frame = (id, parentId, relativeTo = 'parent_top_left') => ({ id, type: 'frame', x: 10, y: 10, width: 100, height: 100, origin: 'center', relativeTo, parentId });
    const items = [frame('a', 'b'), frame('b', 'a'), frame('c', 'a'), frame('d', 'gone'), frame('e', null, 'canvas_center'),
        { id: 'img', type: 'image', x: 0, y: 0, width: 5, height: 5, url: 'https://images.example.test/x.png' },
        { id: 'odd', type: 'future_widget', x: 1, y: 2, payload: [1] }, { id: 'nul' }];
    const source = exportOf(items);
    source.assets = [];
    source.records.push({ ...source.records[4] });
    const pkg = normalizeExport(source);
    const errors = Object.fromEntries(pkg.errors.map(error => [`${error.code}:${error.itemId}`, error]));
    assert.match(errors['parent-cycle:a'].message, /a -> b -> a/);
    assert.ok(errors['parent-cycle:b']);
    assert.match(errors['parent-unresolved:c'].message, /Parent a .*parent-cycle/);
    assert.match(errors['missing-parent:d'].message, /gone is not in the package/);
    assert.match(errors['missing-asset:img'].message, /no asset entry/);
    assert.equal(errors['duplicate-id:e'].sourceIndex, 8);
    assert.match(errors['export-failed:null'].message, /index 7|no type/);
    assert.ok(errors['coverage-mismatch:null'], 'a record added after export is detected');
    for (const error of pkg.errors) assert.ok(error.action.length > 20, `${error.code} needs an action`);
    assert.equal(pkg.valid, false);
    assert.equal(item(pkg, 'e').status, 'supported', 'the first record keeps a duplicate ID');
    assert.equal(item(pkg, 'odd').status, 'unknown');
    assert.equal(pkg.mapping.odd, 'miro-odd', 'unknown records stay mapped and recoverable');
    for (const entry of pkg.items.filter(candidate => candidate.status === 'failed')) {
        assert.equal(entry.targetId, null);
        assert.ok(entry.raw, 'failed records keep their raw data');
    }
    assert.match(formatReport(pkg), /\[parent-cycle\] item a \(source index 0\)[^\n]*\n    fix: Clear parentId/);
});

test('invalid packages are refused before any processing', () => {
    for (const input of [null, [], { format: 'other', formatVersion: 1 }, { ...exportOf([]), formatVersion: 2 }, { ...exportOf([]), records: {} }]) {
        assert.throws(() => normalizeExport(input), error => error instanceof InvalidPackageError && error.code === 'invalid-package');
    }
});

test('repeat normalization is stable and the mapping does not depend on record order', () => {
    const source = exportOf(fixture.items);
    const first = normalizeExport(source);
    assert.deepEqual(normalizeExport(JSON.parse(JSON.stringify(source))), first);
    assert.equal(JSON.stringify(normalizeExport(source)), JSON.stringify(first));
    const reversed = normalizeExport(exportOf([...fixture.items].reverse()));
    assert.deepEqual(reversed.mapping, first.mapping);
    for (const entry of first.items) {
        const other = item(reversed, entry.sourceId);
        assert.deepEqual({ ...other, sourceIndex: 0 }, { ...entry, sourceIndex: 0 }, entry.sourceId);
    }
    assert.equal(first.mapping[ID(17)], `miro-${ID(17)}`);
});

test('generated 2,000-record export: complete, deterministic and valid', () => {
    const types = ['sticky_note', 'image', 'preview', 'frame', 'connector', 'unsupported', 'shape', 'text', 'mystery'];
    const items = Array.from({ length: 2000 }, (_, index) => ({
        id: `9007199254740${String(993 + index).padStart(6, '0')}`, type: types[(index * 7) % types.length],
        x: (index * 37) % 5000, y: (index * 53) % 5000, width: 100, height: 80, url: `https://assets.example.test/${index}`,
    }));
    const pkg = normalizeExport(exportOf(items));
    assert.equal(pkg.coverage.total, 2000);
    assert.equal(pkg.valid, true);
    assert.equal(Object.keys(pkg.mapping).length, 2000);
    assert.deepEqual(normalizeExport(exportOf(items)), pkg);
    assert.match(formatReport(pkg), /\.\.\. and \d+ more in the package/);
});

function runDryRun(cwd, args) {
    const env = { ...process.env, MIRO_SQLITE_PATH: join(cwd, 'must-not-exist.sqlite') };
    return spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', DRY_RUN, ...args], { cwd, env, encoding: 'utf8', timeout: 30000 });
}

test('dry run validates and reports without opening or changing a board', () => {
    const dir = mkdtempSync(join(tmpdir(), 'miro-t16-'));
    try {
        const input = join(dir, 'export.json');
        const text = JSON.stringify(exportOf(fixture.items));
        writeFileSync(input, text);
        const run = runDryRun(dir, [input, '--out', join(dir, 'package.json')]);
        assert.equal(run.status, 0, run.stderr);
        assert.match(run.stdout, /Destination: none\. A dry run opens and changes no board\./);
        assert.match(run.stdout, /Package: VALID/);
        assert.match(run.stdout, /Real-source fidelity: NOT_CHECKED/);
        assert.equal(readFileSync(input, 'utf8'), text, 'the original export is unchanged');
        assert.deepEqual(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')), normalizeExport(JSON.parse(text)));
        assert.equal(runDryRun(dir, [input, '--out', join(dir, 'package.json')]).status, 2, 'never overwrites a file');
        assert.equal(runDryRun(dir, [input, '--out', input]).status, 2, 'never writes over the input');
        writeFileSync(join(dir, 'bad.json'), JSON.stringify({ format: 'nope' }));
        const bad = runDryRun(dir, [join(dir, 'bad.json')]);
        assert.equal(bad.status, 2);
        assert.match(bad.stderr, /Expected format miro-clone\.structural-export/);
        const broken = exportOf([{ id: 'x', type: 'frame', x: 0, y: 0, parentId: 'x', relativeTo: 'parent_top_left' }]);
        writeFileSync(join(dir, 'broken.json'), JSON.stringify(broken));
        const withErrors = runDryRun(dir, [join(dir, 'broken.json')]);
        assert.equal(withErrors.status, 1);
        assert.match(withErrors.stdout, /Package: INVALID \(1 error\)/);
        assert.deepEqual(readdirSync(dir).sort(), ['bad.json', 'broken.json', 'export.json', 'package.json'], 'no database or other file appeared');
        assert.equal(existsSync(join(dir, 'must-not-exist.sqlite')), false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('dry-run code has no database, board or network access', () => {
    for (const file of ['scripts/migration/dry-run.mjs', 'lib/migration/normalize.ts', 'lib/migration/geometry.ts', 'lib/migration/report.ts']) {
        const source = readFileSync(join(__dirname, '..', file), 'utf8');
        assert.doesNotMatch(source, /sqlite|lib\/boards|\bfetch\s*\(|node:https?|node:net|\/api\//, file);
    }
});
