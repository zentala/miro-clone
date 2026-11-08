// E001-T07 browser acceptance: zoom/pan mapping, grid, z key, camera reset, PNG export and board capacity.
// Disposable SQLite file, Chromium profile, downloads and loopback server; synthetic boards only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, rm, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startApp, startChromium, openPage, stop, unusedPort, until } = require('./lib/browser-harness.cjs');
const { ANCHOR, generateDocument, insertBoard } = require('./lib/synthetic-board.cjs');
const { navigationSteps } = require('./navigation-steps.cjs');
const { capacitySteps } = require('./capacity-steps.cjs');

test('navigation and capacity: zoom, pan, grid, z key, camera reset, export, measured limit', { timeout: 300000 }, async t => {
    const owned = await mkdtemp(join(tmpdir(), 'miro-navigation-'));
    const profile = join(owned, 'chromium-profile');
    const downloads = join(owned, 'downloads');
    await mkdir(profile); await mkdir(downloads);
    const processes = [];
    let cdp;
    t.after(async () => {
        if (cdp) cdp.close();
        for (const record of [...processes].reverse()) await stop(record);
        await rm(owned, { recursive: true, force: true });
        assert.ok(processes.every(record => record.closed), 'All owned child processes must exit');
        await assert.rejects(() => stat(owned), { code: 'ENOENT' });
    });
    const port = await unusedPort();
    const origin = `http://127.0.0.1:${port}`;
    const databasePath = join(owned, 'synthetic.sqlite');
    const app = await startApp({ port, databasePath });
    processes.push(app);
    const chromium = await startChromium({ owned, profile, timeout: 60000 });
    processes.push(chromium.record); cdp = chromium.cdp;
    const session = await openPage(cdp);
    const exceptions = [];
    cdp.on('Runtime.exceptionThrown', (event, id) => { if (id === session.sessionId) exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text); });
    await session.page('Page.enable'); await session.page('Runtime.enable');
    await session.page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true });
    await session.page('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
        const original = window.fetch; window.__patches = [];
        window.fetch = (input, init) => { if (init && init.method === 'PATCH') window.__patches.push(init.body.length); return original(input, init); };
    })()` });
    await fetch(`${origin}/api/boards`);

    const fill = { r: 10, g: 20, b: 30 };
    const small = { schemaVersion: 2, layerIds: [ANCHOR.id, 'note'], layers: {
        [ANCHOR.id]: { type: 0, x: ANCHOR.x, y: ANCHOR.y, width: ANCHOR.width, height: ANCHOR.height, fill },
        note: { type: 4, x: 600, y: 300, width: 140, height: 140, fill, value: 'Synthetic note' },
    } };
    insertBoard(databasePath, 'navigation', 'Navigation fixture', small);
    const read = id => {
        const db = new DatabaseSync(databasePath, { readOnly: true });
        try { return JSON.parse(db.prepare('SELECT document FROM boards WHERE id = ?').get(id).document); } finally { db.close(); }
    };
    let flowFailed = false;
    const context = {
        session, cdp, origin, databasePath, downloads, read, generateDocument, insertBoard, until,
        step: (name, run) => t.test(name, { skip: flowFailed ? 'Earlier prerequisite failed' : false }, async () => {
            try { await run(); } catch (error) {
                flowFailed = true;
                const page = await session.evaluate('document.body.innerText.slice(0, 1500)').catch(() => 'Page unavailable');
                throw new Error(`${error.message}\nPage: ${page}\nBrowser exceptions: ${JSON.stringify(exceptions)}\nServer: ${app.log}`, { cause: error });
            }
        }),
    };
    await navigationSteps(context);
    await capacitySteps(context);
    assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
});
