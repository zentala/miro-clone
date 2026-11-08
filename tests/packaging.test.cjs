// Packaging acceptance using only Node builtins, system Chromium and an optional
// container runtime: hosted SDKs stay removed, and the traced standalone bundle
// serves the app with a disposable SQLite database, both directly and in a container.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { cp, mkdir, mkdtemp, readdir, readFile, rm, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { createServer } = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { DatabaseSync } = require('node:sqlite');

const root = resolve(__dirname, '..');
const deadline = 15000;
const HOSTED_PACKAGE = /^(@clerk\/|@liveblocks\/|convex$|convex-helpers$)/;
const HOSTED_IMPORT = /(\bfrom\s+|\bimport\s*\(?\s*|\brequire\(\s*)["'](@clerk\/|@liveblocks\/|convex(\/|["'])|convex-helpers|@\/convex\/|@\/liveblocks\.config)/;
const TITLE = 'Packaging synthetic board';

async function until(description, predicate, timeout = deadline) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        last = await predicate();
        if (last) return last;
        await delay(100);
    }
    throw new Error(`Timed out waiting for ${description}; last result: ${JSON.stringify(last)}`);
}
async function unusedPort() {
    const server = createServer();
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    const port = server.address().port;
    await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
    return port;
}
function child(command, args, options = {}) {
    const process = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const record = { process, out: '', log: '', error: null, closed: false, code: null };
    process.once('error', error => { record.error = error; record.closed = true; });
    process.once('close', code => { record.closed = true; record.code = code; });
    process.stdout.on('data', data => { record.out += data; });
    for (const stream of [process.stdout, process.stderr]) stream.on('data', data => { record.log = (record.log + data).slice(-12000); });
    return record;
}
async function stop(record) {
    if (!record || record.closed) return;
    record.process.kill('SIGTERM');
    const end = Date.now() + 4000;
    while (!record.closed && Date.now() < end) await delay(50);
    if (!record.closed) {
        record.process.kill('SIGKILL');
        await until('owned process exit', () => record.closed, 4000);
    }
}
// Runs a short-lived command to completion; a timeout kills it and fails.
async function run(command, args, timeout = deadline) {
    const record = child(command, args);
    try { await until(`${command} ${args[0]}`, () => record.closed, timeout); }
    finally { await stop(record); }
    if (record.error || record.code !== 0) throw new Error(`${command} ${args.join(' ')} failed (${record.code}): ${record.error || record.log}`);
    return record.out.trim();
}
async function files(directory) {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    return entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name));
}
async function fetchOk(url, init) {
    const response = await fetch(url, { signal: AbortSignal.timeout(deadline), ...init });
    assert.equal(response.status, 200, `${url} must respond 200`);
    return response;
}

// Pages, JS, fonts, public PNG and the retired collaboration endpoint, over HTTP.
async function checkServedApp(origin) {
    const html = await (await fetchOk(origin)).text();
    assert.match(html, />Boards</, 'Dashboard HTML must render');
    const script = html.match(/\/_next\/static\/[^"]+\.js/)?.[0];
    assert.ok(script, 'Dashboard must reference a static JS chunk');
    assert.match((await fetchOk(origin + script)).headers.get('content-type'), /javascript/);
    const css = html.match(/\/_next\/static\/css\/[^"]+\.css/)?.[0];
    const font = (await (await fetchOk(origin + css)).text()).match(/\/_next\/static\/media\/[^)]+\.woff2/)?.[0];
    assert.ok(font, 'Stylesheet must reference a self-hosted woff2 font');
    const fontBytes = Buffer.from(await (await fetchOk(origin + font)).arrayBuffer());
    assert.equal(fontBytes.subarray(0, 4).toString('latin1'), 'wOF2');
    const png = Buffer.from(await (await fetchOk(`${origin}/color-picker.png`)).arrayBuffer());
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    // Exercise the next/image route: without native sharp an enabled optimizer logs an
    // error per image (callers assert clean server logs). Disabled, it answers 404.
    const optimized = await fetch(`${origin}/_next/image?url=%2Fcolor-picker.png&w=48&q=75`, { signal: AbortSignal.timeout(deadline) });
    assert.ok([200, 404].includes(optimized.status), `Unexpected image route status ${optimized.status}`);
    const retired = `${origin}/api/liveblocks-auth`;
    assert.equal((await fetch(retired, { method: 'POST', signal: AbortSignal.timeout(deadline) })).status, 410);
    assert.equal((await fetch(retired, { signal: AbortSignal.timeout(deadline) })).status, 405);
}
// Same-origin API writes of a synthetic stroke, as the editor performs them.
async function createSyntheticBoard(origin) {
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    const created = await fetch(`${origin}/api/boards`, { method: 'POST', headers, body: JSON.stringify({ title: TITLE }), signal: AbortSignal.timeout(deadline) });
    assert.equal(created.status, 201);
    const { id } = await created.json();
    const points = [[0, 0, 0.5], [40, 20, 0.5], [80, 10, 0.5], [120, 40, 0.5]];
    const document = { schemaVersion: 2, layerIds: ['stroke'], layers: { stroke: { type: 2, x: 300, y: 250, width: 120, height: 40, fill: { r: 0, g: 0, b: 0 }, points } } };
    await fetchOk(`${origin}/api/boards/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ document }) });
    return { id, document };
}
function storedBoards(databasePath) {
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try { return db.prepare('SELECT id, title, document FROM boards').all().map(row => ({ ...row, document: JSON.parse(row.document) })); }
    finally { db.close(); }
}
// Real Chromium executes the client bundle, loads the board API and renders the stroke.
async function renderedBoard(origin, id, owned) {
    const profile = await mkdtemp(join(owned, 'chromium-'));
    const dom = await run('/usr/bin/chromium-browser', [
        '--headless=new', '--dump-dom', '--virtual-time-budget=10000', `--user-data-dir=${profile}`,
        '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
        '--disable-component-update', '--disable-sync', '--window-size=1280,900', `${origin}/board/${id}`,
    ], 60000);
    assert.ok(dom.includes(TITLE), 'Rendered board must show its saved title');
    assert.match(dom, /<svg[^>]*h-\[100vh\][\s\S]*?<path[^>]* d="M[^"]+Z"/, 'Rendered board must draw the saved stroke');
}
async function ownedDirectory(t, prefix) {
    const owned = await mkdtemp(join(tmpdir(), prefix));
    t.after(async () => {
        await rm(owned, { recursive: true, force: true });
        await assert.rejects(() => stat(owned), { code: 'ENOENT' });
    });
    return owned;
}

test('hosted SDKs are absent from manifest, lockfile, source and build output', async () => {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    assert.deepEqual(declared.filter(name => HOSTED_PACKAGE.test(name)), []);
    const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
    const locked = Object.keys(lock.packages).map(path => path.split('node_modules/').pop());
    assert.deepEqual(locked.filter(name => HOSTED_PACKAGE.test(name)), []);
    const sources = [];
    for (const directory of ['app', 'components', 'hooks', 'lib', 'providers', 'store', 'types']) sources.push(...await files(join(root, directory)));
    const importing = [];
    for (const file of sources) if (HOSTED_IMPORT.test(await readFile(file, 'utf8'))) importing.push(file);
    assert.deepEqual(importing, [], 'No source file may import a hosted SDK');
    const traced = (await files(join(root, '.next/standalone/node_modules'))).map(file => file.split('node_modules/').pop());
    assert.deepEqual(traced.filter(path => /^(@clerk|@liveblocks|convex)/.test(path)), [], 'Standalone trace must not ship hosted SDKs');
    for (const file of await files(join(root, '.next/static'))) {
        assert.doesNotMatch(await readFile(file, 'latin1'), /@clerk\/|@liveblocks\/|convex\/(react|server|values)/, file);
    }
});

test('standalone bundle, copied as the container copies it, serves the app and persists SQLite', { timeout: 120000 }, async t => {
    const owned = await ownedDirectory(t, 'miro-standalone-');
    const app = join(owned, 'app');
    await cp(join(root, '.next/standalone'), app, { recursive: true });
    await cp(join(root, '.next/static'), join(app, '.next/static'), { recursive: true });
    await cp(join(root, 'public'), join(app, 'public'), { recursive: true });
    const databasePath = join(owned, 'data', 'synthetic.sqlite');
    const port = await unusedPort();
    const origin = `http://127.0.0.1:${port}`;
    const server = child(process.execPath, ['server.js'], {
        cwd: app,
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port), MIRO_SQLITE_PATH: databasePath },
    });
    t.after(() => stop(server));
    await until('standalone server readiness', async () => {
        if (server.closed) throw new Error(`Standalone server failed: ${server.error || server.log}`);
        try { return (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
    });
    await checkServedApp(origin);
    const board = await createSyntheticBoard(origin);
    assert.deepEqual(storedBoards(databasePath), [{ id: board.id, title: TITLE, document: board.document }]);
    await renderedBoard(origin, board.id, owned);
    assert.doesNotMatch(server.log, /sharp|Error/i, 'Standalone server must not log runtime errors');
});

const containerSkip = process.env.MIRO_CONTAINER_TEST === '1' ? false : 'Set MIRO_CONTAINER_TEST=1 (just container-check) to build and run a disposable image';
test('container runs non-root, persists SQLite on its data mount and survives replacement', { skip: containerSkip, timeout: 900000 }, async t => {
    const runtime = process.env.MIRO_CONTAINER_RUNTIME || 'podman';
    const owned = await ownedDirectory(t, 'miro-container-');
    const data = join(owned, 'data');
    await mkdir(data);
    const tag = `localhost/miro-clone-packaging:${Date.now()}`;
    const names = [`miro-packaging-${Date.now()}-a`, `miro-packaging-${Date.now()}-b`];
    t.after(async () => {
        for (const name of names) await run(runtime, ['rm', '--force', '--ignore', name], 60000).catch(() => {});
        await run(runtime, ['rmi', '--force', tag], 60000).catch(() => {});
    });
    await run(runtime, ['build', '--quiet', '--tag', tag, root], 600000);
    t.diagnostic(`Image ${tag}: ${await run(runtime, ['image', 'inspect', '--format', '{{.Size}}', tag])} bytes`);
    // The image's own default user, checked without the keep-id option used below.
    assert.match(await run(runtime, ['run', '--rm', tag, 'id'], 60000), /^uid=[1-9]\d*\(node\)/, 'Image must default to the non-root node user');
    const port = await unusedPort();
    const origin = `http://127.0.0.1:${port}`;
    // keep-id maps the image's node user (uid 1000) to the invoking host user so the mount stays readable.
    const userns = runtime === 'podman' ? ['--userns=keep-id:uid=1000,gid=1000'] : [];
    async function start(name) {
        await run(runtime, ['run', '--detach', '--name', name, ...userns, '--publish', `127.0.0.1:${port}:3000`, '--volume', `${data}:/app/data:Z`, tag], 60000);
        await until(`container ${name} readiness`, async () => {
            try { return (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
        }, 60000);
        assert.equal(await run(runtime, ['exec', name, 'id', '-un']), 'node');
        assert.notEqual(await run(runtime, ['exec', name, 'id', '-u']), '0', 'Container process must not run as root');
    }
    await start(names[0]);
    await checkServedApp(origin);
    const board = await createSyntheticBoard(origin);
    const databasePath = join(data, 'miro.sqlite');
    assert.deepEqual(storedBoards(databasePath), [{ id: board.id, title: TITLE, document: board.document }], 'SQLite must be written to the data mount');
    await renderedBoard(origin, board.id, owned);
    await run(runtime, ['stop', '--time', '10', names[0]], 60000);
    await run(runtime, ['rm', names[0]], 60000);
    await start(names[1]);
    const restored = await (await fetchOk(`${origin}/api/boards/${board.id}`)).json();
    assert.deepEqual(restored.document, board.document, 'Replacement container must serve the same synthetic data');
    await renderedBoard(origin, board.id, owned);
    const logs = child(runtime, ['logs', names[1]]);
    await until('container logs', () => logs.closed);
    assert.doesNotMatch(logs.log, /sharp|Error/i, 'Container must not log runtime errors');
});
