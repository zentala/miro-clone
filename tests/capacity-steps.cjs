// Capacity steps for tests/navigation-capacity.test.cjs: generated boards at and above the measured limit.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { root } = require('./lib/browser-harness.cjs');
const { ANCHOR } = require('./lib/synthetic-board.cjs');
const { helpers } = require('./navigation-steps.cjs');

/** The limit the app enforces, read from the single source both editor and server use. */
const MAX_LAYERS = Number(/export const MAX_LAYERS = (\d+);/.exec(readFileSync(join(root, 'lib/document-version.ts'), 'utf8'))[1]);
/** Representative workload W2 from ARCH.md; it must fit under the limit. */
const REPRESENTATIVE = 2000;

async function capacitySteps(context) {
    const { step, read, session, until, origin, databasePath, generateDocument, insertBoard } = context;
    const h = helpers(context);
    const alert = () => h.evaluate('document.querySelector("[role=alert]")?.textContent ?? ""');

    await step(`a generated ${REPRESENTATIVE}-object board opens, drags with one save, undoes and reloads`, async () => {
        assert.ok(REPRESENTATIVE <= MAX_LAYERS);
        const document = generateDocument(REPRESENTATIVE);
        insertBoard(databasePath, 'large', 'Large generated board', document);
        await h.open('large', REPRESENTATIVE);
        await h.evaluate('window.__patches.length = 0');
        const start = { x: ANCHOR.x + 50, y: ANCHOR.y + 50 };
        await h.drag(start, { x: start.x + 30, y: start.y });
        await until('large-board drag saved', () => read('large').layers[ANCHOR.id].x === ANCHOR.x + 30, 30000);
        await h.saved();
        assert.equal(await h.patches(), 1, 'One save per drag gesture on a large board');
        await session.key('z', 2);
        await until('large-board undo saved', () => read('large').layers[ANCHOR.id].x === ANCHOR.x, 30000);
        await h.saved();
        await h.open('large', REPRESENTATIVE);
        assert.deepEqual(read('large'), document, 'Reload keeps the generated content unchanged');
    });

    await step(`a board at the ${MAX_LAYERS}-object limit refuses new objects with a visible reason`, async () => {
        const document = generateDocument(MAX_LAYERS);
        insertBoard(databasePath, 'full', 'Full generated board', document);
        await h.open('full', MAX_LAYERS);
        assert.equal(await alert(), '');
        await session.click('button[aria-label="Rectangle (Ctrl+R)"]');
        await session.clickAt({ x: 700, y: 120 });
        await until('capacity refusal shown', async () => (await alert()).includes(`at most ${MAX_LAYERS} objects`));
        await session.clickAt({ x: ANCHOR.x + 50, y: ANCHOR.y + 50 });
        await session.key('d', 2);
        await h.frames();
        assert.ok((await alert()).includes('This board is full'));
        assert.equal(await h.patches(), 0, 'Refused edits send nothing');
        assert.equal(read('full').layerIds.length, MAX_LAYERS);
        assert.equal(await h.evaluate('document.querySelector("[data-board-layers]").childElementCount'), MAX_LAYERS);
        // The reason wraps in its own panel below the Info bar; nothing leaves a 390 px viewport.
        // Deselect first: the selection toolbar is centred on the selection and is checked separately.
        await session.clickAt({ x: 1000, y: 120 });
        await until('selection cleared', async () => !(await h.evaluate('!!document.querySelector("svg.lucide-copy")')));
        assert.ok((await alert()).includes('This board is full'), 'The reason stays until the next change');
        const layout = () => h.evaluate(`(() => {
            const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
            return { width: document.documentElement.scrollWidth, bar: box(document.querySelector('[role=status]').parentElement),
                alert: box(document.querySelector('[role=alert]')), menu: box(document.querySelector('svg.lucide-menu').closest('button')) };
        })()`);
        for (const [width, height] of [[390, 844], [1440, 900]]) {
            await session.page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
            await h.frames();
            const { width: pageWidth, bar, alert: notice, menu } = await layout();
            assert.ok(pageWidth <= width, `No horizontal overflow at ${width} px: ${pageWidth}`);
            assert.ok(notice.top >= bar.bottom, `Reason sits below the Info bar at ${width} px`);
            assert.ok(notice.left >= 0 && notice.right <= width, `Reason fits the viewport at ${width} px`);
            assert.ok(menu.right <= width, `Menu button stays on screen at ${width} px`);
        }
        await session.page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    });

    await step('the server refuses documents above the limit; such stored boards show a readable page', async () => {
        const over = generateDocument(MAX_LAYERS + 1);
        const before = read('navigation');
        const response = await fetch(`${origin}/api/boards/navigation`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: over }),
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error, `Boards hold at most ${MAX_LAYERS} objects`);
        assert.deepEqual(read('navigation'), before, 'Refused save leaves the stored board unchanged');
        insertBoard(databasePath, 'over', 'Over-limit board', over);
        await session.page('Page.navigate', { url: `${origin}/board/over` });
        await until('readable over-limit page', async () => (await alert()).includes('cannot open this board'));
        assert.ok((await alert()).includes(`at most ${MAX_LAYERS} objects`));
        assert.ok(await h.evaluate('!!document.querySelector("a[href=\'/\']")'), 'Way back to the board list');
        insertBoard(databasePath, 'future', 'Future board', { schemaVersion: 99, layerIds: [], layers: {} });
        await session.page('Page.navigate', { url: `${origin}/board/future` });
        await until('newer-version message', async () => (await alert()).startsWith('This board was saved by a newer version of the app'));
    });
}

module.exports = { capacitySteps, MAX_LAYERS };
