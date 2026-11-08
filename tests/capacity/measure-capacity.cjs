#!/usr/bin/env node
// Browser capacity measurement for the T01 workload matrix (E001-T07). Not part of `just check`.
// Usage: node tests/capacity/measure-capacity.cjs [--workloads=100,2000,10000] [--viewports=1280x900,...]
//        [--dprs=1,1.25,2] [--zooms=0.05,...,4] [--out=results.json] [--label=name]
// Needs a production build (`npm run build`). Uses a disposable SQLite file, Chromium profile and
// loopback server under the OS temp directory; never the user's database or browser profile.
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { startApp, startChromium, openPage, stop, unusedPort } = require('../lib/browser-harness.cjs');
const { ANCHOR, generateDocument, insertBoard } = require('../lib/synthetic-board.cjs');
const probes = require('./probes.cjs');

const DEFAULTS = {
    workloads: '100,2000,10000', viewports: '1280x900,1920x1080,2560x1440',
    dprs: '1,1.25,2', zooms: '0.05,0.1,0.25,0.5,1,2,4', out: '', label: 'measurement',
};
const LONG_TIMEOUT = 300000;

function options() {
    const values = { ...DEFAULTS };
    for (const arg of process.argv.slice(2)) {
        const [key, value] = arg.replace(/^--/, '').split('=');
        if (!(key in DEFAULTS)) throw new Error(`Unknown option ${arg}`);
        values[key] = value;
    }
    const list = text => text.split(',').filter(Boolean);
    return {
        workloads: list(values.workloads).map(Number),
        viewports: list(values.viewports).map(text => text.split('x').map(Number)),
        dprs: list(values.dprs).map(Number), zooms: list(values.zooms).map(Number),
        out: values.out, label: values.label,
    };
}

async function heap(session) {
    const { metrics } = await session.page('Performance.getMetrics');
    const value = name => metrics.find(metric => metric.name === name)?.value;
    return { heapMiB: probes.round(value('JSHeapUsedSize') / 1048576), domNodes: value('Nodes') };
}

/** Editing probes at zoom 1: keyboard move, one drag gesture and one undo on the anchor rectangle. */
async function editingProbes(session) {
    const center = { x: ANCHOR.x + ANCHOR.width / 2, y: ANCHOR.y + ANCHOR.height / 2 };
    await session.clickAt(center);
    await probes.waitSaved(session);
    const keyMove = await probes.timedKey(session, { key: 'ArrowRight' });
    await probes.waitSaved(session);
    await session.evaluate('window.__patches.length = 0');
    const dragFrames = await probes.drag(session, { x: center.x + 5, y: center.y });
    await probes.waitSaved(session);
    const patches = await session.evaluate('window.__patches.slice()');
    const undo = await probes.timedKey(session, { key: 'z', ctrlKey: true });
    await probes.waitSaved(session);
    // Undo the keyboard move too, so every case starts from the same stored board.
    await probes.timedKey(session, { key: 'z', ctrlKey: true });
    await probes.waitSaved(session);
    return {
        keyMoveSyncMs: probes.round(keyMove.sync), keyMoveFrameMs: probes.round(keyMove.frame),
        dragPatches: patches.length, dragPatchKiB: probes.round(patches.reduce((a, b) => a + b, 0) / 1024),
        dragFrameP95Ms: probes.round(dragFrames.p95), dragFrameMaxMs: probes.round(dragFrames.max),
        undoFrameMs: probes.round(undo.frame),
    };
}

async function navigationProbes(session, viewport, zooms) {
    const point = { x: Math.round(viewport[0] / 2), y: Math.round(viewport[1] / 2) };
    const hasZoom = await session.evaluate('!!document.querySelector("[data-zoom-level]")');
    const result = {};
    for (const zoom of hasZoom ? zooms : [1]) {
        const zoomStepMs = hasZoom ? probes.round(await probes.zoomTo(session, zoom)) : null;
        const frames = await probes.pan(session, point);
        result[zoom] = { zoomStepMs, panP95Ms: probes.round(frames.p95), panMaxMs: probes.round(frames.max) };
    }
    return { zoomSupported: hasZoom, zoom: result };
}

async function measureCase(session, origin, count, viewport, dpr, zooms) {
    const [width, height] = viewport;
    await session.page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
    await session.page('Page.navigate', { url: `${origin}/board/capacity-${count}` });
    const firstRenderMs = probes.round(await probes.waitRendered(session, count));
    await probes.waitSaved(session);
    const loaded = await heap(session);
    const editing = await editingProbes(session);
    const navigation = await navigationProbes(session, viewport, zooms);
    return { workload: count, viewport: `${width}x${height}`, dpr, firstRenderMs, ...loaded, ...editing, ...navigation };
}

async function prepareBoards(origin, databasePath, workloads) {
    const status = {};
    // The first API request creates the database schema.
    await fetch(`${origin}/api/boards`);
    for (const count of workloads) {
        const document = generateDocument(count);
        insertBoard(databasePath, `capacity-${count}`, `Capacity ${count}`, document);
        const response = await fetch(`${origin}/api/boards/capacity-${count}`);
        const body = await response.json();
        status[count] = { httpStatus: response.status, code: body.code ?? null, documentKiB: probes.round(JSON.stringify(document).length / 1024) };
    }
    return status;
}

async function main() {
    const config = options();
    const owned = await mkdtemp(join(tmpdir(), 'miro-capacity-'));
    const profile = join(owned, 'chromium-profile');
    await mkdir(profile);
    const processes = [];
    let cdp;
    // An interrupted run still stops its own server and browser and removes its temporary files.
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
        if (cdp) cdp.close();
        for (const record of [...processes].reverse()) await stop(record);
        await rm(owned, { recursive: true, force: true });
        process.exit(130);
    });
    try {
        const port = await unusedPort();
        const origin = `http://127.0.0.1:${port}`;
        const databasePath = join(owned, 'capacity.sqlite');
        processes.push(await startApp({ port, databasePath, timeout: 60000 }));
        const chromium = await startChromium({ owned, profile, windowSize: '2560,1440', timeout: LONG_TIMEOUT });
        processes.push(chromium.record); cdp = chromium.cdp;
        const boards = await prepareBoards(origin, databasePath, config.workloads);
        const session = await openPage(cdp);
        cdp.on('Page.javascriptDialogOpening', () => session.page('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}));
        await session.page('Page.enable'); await session.page('Runtime.enable'); await session.page('Performance.enable');
        await session.page('Page.addScriptToEvaluateOnNewDocument', { source: probes.PATCH_RECORDER });
        const cases = [];
        for (const count of config.workloads) {
            if (boards[count].httpStatus !== 200) continue;
            for (const viewport of config.viewports) for (const dpr of config.dprs) {
                const result = await measureCase(session, origin, count, viewport, dpr, config.zooms);
                cases.push(result);
                process.stderr.write(`${JSON.stringify(result)}\n`);
            }
        }
        const report = { label: config.label, measuredAt: new Date().toISOString(), node: process.version, boards, cases };
        if (config.out) await writeFile(config.out, JSON.stringify(report, null, 2));
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } finally {
        if (cdp) cdp.close();
        for (const record of processes.reverse()) await stop(record);
        await rm(owned, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
