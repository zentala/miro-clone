// Navigation steps for tests/navigation-capacity.test.cjs: one fixture board, real pointer/keyboard/wheel input.
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { ANCHOR } = require('./lib/synthetic-board.cjs');

const CTRL = 2;
const VIEWPORT = { width: 1280, height: 900 };
const CENTER = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

function helpers({ session, until, origin }) {
    const evaluate = session.evaluate;
    const anchorRect = () => evaluate(`(() => {
        const r = document.querySelector('[data-board-layers]').children[0].getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`);
    const zoom = () => evaluate('Number(document.querySelector("[data-zoom-level]").dataset.zoomLevel)');
    const resetVisible = () => evaluate('!!document.querySelector("button[aria-label=\'Reset camera\']")');
    const saved = () => until('visible Saved status', () => evaluate('document.querySelector("[role=status]")?.textContent === "Saved"'));
    const frames = () => evaluate('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))');
    const wheel = async (point, deltaX, deltaY, modifiers = 0) => { await session.mouse('mouseWheel', point, { deltaX, deltaY, modifiers }); await frames(); };
    const patches = () => evaluate('window.__patches.length');
    async function open(id, count) {
        await session.page('Page.navigate', { url: `${origin}/board/${id}` });
        await until(`board ${id} rendered`, () => evaluate(`document.querySelector('[data-board-layers]')?.childElementCount === ${count}`), 60000);
        await saved();
    }
    async function drag(from, to, steps = 8) {
        await session.mouse('mouseMoved', from);
        await session.mouse('mousePressed', from, { button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= steps; i++) {
            const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
            await session.mouse('mouseMoved', point, { button: 'left', buttons: 1 });
        }
        await session.mouse('mouseReleased', to, { button: 'left', buttons: 0, clickCount: 1 });
    }
    async function zoomTo(target) {
        for (let i = 0; i < 12 && (await zoom()) !== target; i++) {
            await session.click(`button[aria-label="${(await zoom()) < target ? 'Zoom in' : 'Zoom out'}"]`);
            await frames();
        }
        assert.equal(await zoom(), target);
    }
    async function resetCamera() {
        if (await resetVisible()) await session.click('button[aria-label="Reset camera"]');
        await until('default camera', async () => !(await resetVisible()));
    }
    return { evaluate, anchorRect, zoom, resetVisible, saved, frames, wheel, patches, open, drag, zoomTo, resetCamera };
}

const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

async function navigationSteps(context) {
    const { step, read, session, until, downloads, cdp } = context;
    const h = helpers(context);
    const anchor = () => read('navigation').layers[ANCHOR.id];

    await step('plain z leaves the selection in place; arrows move it and Ctrl+Z undoes', async () => {
        await h.open('navigation', 2);
        await session.clickAt({ x: 250, y: 250 });
        await h.saved();
        await h.evaluate('window.__patches.length = 0');
        await session.key('z');
        await h.frames(); await delay(300);
        assert.equal(await h.patches(), 0, 'Plain z must not save anything');
        assert.deepEqual([anchor().x, anchor().y], [ANCHOR.x, ANCHOR.y]);
        await session.key('ArrowRight');
        await until('arrow move saved', () => anchor().x === ANCHOR.x + 5);
        await session.key('z', CTRL);
        await until('Ctrl+Z undo saved', () => anchor().x === ANCHOR.x);
        await h.saved();
    });

    await step('camera reset appears when either coordinate or the zoom differs from the default', async () => {
        assert.equal(await h.resetVisible(), false);
        await h.wheel(CENTER, 30, 0);
        await until('reset after horizontal pan only', h.resetVisible);
        near((await h.anchorRect()).left, ANCHOR.x - 30, 0.01, 'Horizontal pan moves the board by the wheel delta');
        await h.resetCamera();
        near((await h.anchorRect()).left, ANCHOR.x, 0.01, 'Reset restores the default camera');
        await h.wheel(CENTER, 0, 40);
        await until('reset after vertical pan only', h.resetVisible);
        await h.resetCamera();
        await h.zoomTo(1.5);
        assert.equal(await h.resetVisible(), true, 'Zoom alone also shows the reset control');
        await h.resetCamera();
        assert.equal(await h.zoom(), 1);
    });

    await step('zoom keeps the world point under the pointer or viewport centre', async () => {
        const pointer = { x: 250, y: 250 };
        await h.wheel(pointer, 0, -100, CTRL);
        const zoomed = await h.zoom();
        assert.ok(zoomed > 1.2 && zoomed < 1.4, `Ctrl+wheel zooms in: ${zoomed}`);
        const rect = await h.anchorRect();
        near(center(rect).x, pointer.x, 0.5, 'Anchor stays under the pointer (x)');
        near(center(rect).y, pointer.y, 0.5, 'Anchor stays under the pointer (y)');
        near(rect.width, ANCHOR.width * zoomed, 0.5, 'Width scales with zoom');
        const worldAtCenter = (r, z) => ({ x: ANCHOR.x + (CENTER.x - r.left) / z, y: ANCHOR.y + (CENTER.y - r.top) / z });
        const before = worldAtCenter(rect, zoomed);
        await session.click('button[aria-label="Zoom in"]');
        await h.frames();
        assert.equal(await h.zoom(), 1.5);
        assert.ok(await h.evaluate('document.querySelector("[data-zoom-level]").textContent === "150%"'));
        const after = worldAtCenter(await h.anchorRect(), 1.5);
        near(after.x, before.x, 0.01, 'Button zoom keeps the centre world point (x)');
        near(after.y, before.y, 0.01, 'Button zoom keeps the centre world point (y)');
        await h.resetCamera();
    });

    await step('drag, resize and selection net map to world coordinates at zoom 2, DPR 1.25, after pan', async () => {
        await session.page('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1.25, mobile: false });
        // Pan the anchor close to the viewport centre (odd offsets), then zoom about the centre.
        await h.wheel(CENTER, -383, -197);
        await h.zoomTo(2);
        let rect = await h.anchorRect();
        near(rect.width, 200, 0.5, 'Zoom 2 doubles the on-screen size');
        await h.evaluate('window.__patches.length = 0');
        const start = { x: Math.round(center(rect).x), y: Math.round(center(rect).y) };
        await h.drag(start, { x: start.x + 40, y: start.y + 20 });
        await until('drag saved in world units', () => Math.abs(anchor().x - ANCHOR.x - 20) < 0.05 && Math.abs(anchor().y - ANCHOR.y - 10) < 0.05);
        await h.saved();
        assert.equal(await h.patches(), 1, 'One save per drag gesture');
        rect = await h.anchorRect();
        const corner = { x: Math.round(rect.left + rect.width), y: Math.round(rect.top + rect.height) };
        await h.drag(corner, { x: corner.x + 30, y: corner.y + 30 });
        await until('resize saved in world units', () => Math.abs(anchor().width - ANCHOR.width - 15) < 1 && Math.abs(anchor().height - ANCHOR.height - 15) < 1);
        await h.saved();
        assert.equal(await h.patches(), 2, 'One save per resize gesture');
        await session.key('z', CTRL); await session.key('z', CTRL);
        await until('undo restores geometry', () => anchor().x === ANCHOR.x && anchor().width === ANCHOR.width);
        await h.saved();
        rect = await h.anchorRect();
        await session.clickAt({ x: 1100, y: 120 });
        await h.drag({ x: rect.left - 20, y: rect.top - 20 }, { x: rect.left + rect.width + 20, y: rect.top + rect.height + 20 });
        await session.key('ArrowDown');
        await until('net-selected anchor moved', () => anchor().y === ANCHOR.y + 5);
        assert.equal(read('navigation').layers.note.y, 300, 'The note outside the net stays unselected');
        await session.key('z', CTRL);
        await until('net move undone', () => anchor().y === ANCHOR.y);
        await h.saved();
        await session.page('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
        await h.resetCamera();
    });

    await step('grid is a view overlay: scales with zoom, hidden below 25 %, never saved', async () => {
        // The grid is the workspace background behind the SVG scene, so it can never be hit or exported.
        const grid = () => h.evaluate(`(() => {
            const style = getComputedStyle(document.querySelector('[data-board-layers]').closest('svg').parentElement);
            return { image: style.backgroundImage, size: style.backgroundSize, position: style.backgroundPosition };
        })()`);
        let current = await grid();
        assert.match(current.image, /radial-gradient/);
        assert.equal(current.size, '24px 24px');
        await h.wheel(CENTER, 10, 7);
        assert.equal((await grid()).position, '-10px -7px', 'Grid moves with the camera');
        await h.zoomTo(2);
        assert.equal((await grid()).size, '48px 48px');
        await h.zoomTo(0.25);
        current = await grid();
        assert.equal(current.size, '6px 6px');
        assert.match(current.image, /0\.333/, 'Faded at 25 %');
        await h.zoomTo(0.1);
        assert.equal((await grid()).image, 'none', 'No grid at 10 %');
        assert.equal(await h.evaluate('document.querySelector("[data-board-layers]").closest("svg").querySelectorAll("pattern, [data-board-grid]").length'), 0);
        assert.deepEqual(Object.keys(read('navigation').layers).sort(), [ANCHOR.id, 'note']);
        await h.resetCamera();
    });

    await step('PNG export is identical at any zoom and pan', async () => {
        const exported = [];
        const exportPng = async () => {
            const done = new Promise(resolve => {
                const onProgress = event => { if (event.state === 'completed') { cdp.off('Browser.downloadProgress', onProgress); resolve(event.guid); } };
                cdp.on('Browser.downloadProgress', onProgress);
            });
            await session.click('button:has(svg.lucide-image-down)');
            exported.push(await readFile(join(downloads, await done)));
        };
        await exportPng();
        await h.wheel(CENTER, 120, -80);
        await h.zoomTo(2);
        await exportPng();
        assert.equal(exported[0].subarray(1, 4).toString(), 'PNG');
        assert.ok(exported[0].equals(exported[1]), 'Camera and zoom must not change the exported image');
        await h.resetCamera();
    });
}

module.exports = { navigationSteps, helpers };
