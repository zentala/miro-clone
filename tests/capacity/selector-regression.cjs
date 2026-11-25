#!/usr/bin/env node
// Browser regressions for selector closures and changed layer order snapshots.
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { startApp, startChromium, openPage, stop, unusedPort, until } = require('../lib/browser-harness.cjs');
const { generateDocument, insertBoard } = require('../lib/synthetic-board.cjs');

async function main() {
    const owned = await mkdtemp(join(tmpdir(), 'miro-selector-'));
    const profile = join(owned, 'chromium-profile');
    await mkdir(profile);
    const processes = [];
    let cdp;
    try {
        const port = await unusedPort();
        const origin = `http://127.0.0.1:${port}`;
        const databasePath = join(owned, 'selector.sqlite');
        processes.push(await startApp({ port, databasePath }));
        await fetch(`${origin}/api/boards`);

        const document = generateDocument(2);
        document.layers['layer-1'] = {
            type: 0, x: 600, y: 200, width: 100, height: 100,
            fill: { r: 220, g: 80, b: 80 },
        };
        insertBoard(databasePath, 'selector-regression', 'Selector regression', document);

        const chromium = await startChromium({ owned, profile });
        processes.push(chromium.record);
        cdp = chromium.cdp;
        const page = await openPage(cdp);
        await page.page('Page.enable');
        await page.page('Runtime.enable');
        await page.page('Page.navigate', { url: `${origin}/board/selector-regression` });
        await until('both synthetic layers rendered', () => page.evaluate(
            'document.querySelector("[data-board-layers]")?.childElementCount === 2'
        ));

        const outline = '[data-editor-overlay] rect:first-child';
        const bounds = () => page.evaluate(`(() => {
            const element = document.querySelector(${JSON.stringify(outline)});
            if (!element) return null;
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height, handles: document.querySelectorAll('[data-editor-overlay] rect').length };
        })()`);

        await page.clickAt({ x: 250, y: 250 });
        await until('first layer selected', async () => {
            const value = await bounds();
            return value?.x === 200 && value.y === 200 && value.width === 100 && value.height === 100 && value.handles === 9;
        });

        await page.clickAt({ x: 650, y: 250 });
        await until('selector closure follows the second selected ID', async () => {
            const value = await bounds();
            return value?.x === 600 && value.y === 200 && value.width === 100 && value.height === 100 && value.handles === 9;
        });

        const readPaintOrder = () => page.evaluate(
            'Array.from(document.querySelector("[data-board-layers]").children, layer => layer.getAttribute("fill"))'
        );
        await page.clickAt({ x: 250, y: 250 });
        await page.key('ArrowRight');
        await until('prior geometry edit is saved', () => page.evaluate(
            'document.querySelector("[role=status]")?.textContent === "Saved"'
        ));
        const beforeOrder = await readPaintOrder();
        assert.deepEqual(beforeOrder, ['#2563eb', '#dc5050']);
        await page.click('button:has(path[d^="M9 6.5"])');
        await until('bring-to-front updates rendered paint order', async () => {
            const order = await readPaintOrder();
            return order[0] === '#dc5050' && order[1] === '#2563eb';
        });
        const afterOrder = await readPaintOrder();
        if (process.argv[2]) {
            const screenshot = await page.page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(process.argv[2], Buffer.from(screenshot.data, 'base64'));
        }

        process.stdout.write(`${JSON.stringify({ result: 'PASS', selectedBounds: await bounds(), beforeOrder, afterOrder }, null, 2)}\n`);
    } finally {
        if (cdp) cdp.close();
        for (const process of [...processes].reverse()) await stop(process);
        await rm(owned, { recursive: true, force: true });
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
