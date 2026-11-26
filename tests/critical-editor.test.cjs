// The entrypoint shares browser setup with the split workflow helper.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { isDeepStrictEqual } = require('node:util');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

test('critical editor: UI create, pointer draw, undo, redo, PNG export, durable reload/restart', { timeout: 120000 }, async t => {
    const context = await createCriticalEditor(t);
    const { step, page, origin, evaluate, click, until, renderedStroke, saved, databasePath, downloads, begunDownloads, completedDownloads, deadline, exceptions, networkFailures } = context;
    let boardUrl, originalStroke, originalDocument, zoomAssetId;
    await step('create board through the UI', async () => {
        await page('Page.navigate', { url: origin });
        await until('hydrated dashboard', () => evaluate('document.querySelector("h1")?.textContent === "Boards" && !document.body.textContent.includes("Loading boards")'));
        await click('button');
        await until('new board editor', () => evaluate('location.pathname.startsWith("/board/") && !!document.querySelector("button[aria-label=Pen]")'));
        boardUrl = await evaluate('location.href');
        const response = await fetch(`${origin}/api/boards`);
        assert.equal(response.status, 200);
        const boards = await response.json();
        assert.equal(boards.length, 1); assert.equal(boards[0].title, 'Untitled board');
        assert.deepEqual(boards[0].document, { schemaVersion: 5, layers: {}, layerIds: [] });
        assert.equal(await renderedStroke(), '');
        for (const method of ['PATCH', 'DELETE']) {
            const response = await fetch(boardUrl.replace('/board/', '/api/boards/'), {
                method, headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' },
                ...(method === 'PATCH' ? { body: JSON.stringify({ title: 'Must not be renamed' }) } : {}),
                signal: AbortSignal.timeout(deadline),
            });
            assert.equal(response.status, 403, `${method} must reject foreign origins`);
        }
    });
    await step('draw with real browser pointer input and persist to SQLite', async () => {
        await click('button[aria-label="Pen"]');
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 340, y: 310 });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', x: 340, y: 310, button: 'left', buttons: 1, clickCount: 1 });
        for (const [x, y] of [[365, 320], [390, 345], [420, 330], [450, 365]]) {
            await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        }
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 450, y: 365, button: 'left', buttons: 0, clickCount: 1 });
        originalStroke = await until('rendered freehand stroke', renderedStroke);
        assert.match(originalStroke, /^M.+Z$/);
        await saved();
        const db = new DatabaseSync(databasePath, { readOnly: true });
        try {
            const rows = db.prepare('SELECT title, document FROM boards').all();
            assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Untitled board');
            originalDocument = JSON.parse(rows[0].document);
            assert.equal(originalDocument.layerIds.length, 1);
            const layer = originalDocument.layers[originalDocument.layerIds[0]];
            assert.equal(layer.type, 2); assert.ok(layer.points.length >= 2);
            assert.ok(layer.width > 0 && layer.height > 0);
        } finally { db.close(); }
    });
    await step('undo removes the stroke and persists the empty document', async () => {
        await click('button[aria-label="Undo (Ctrl+Z)"]');
        await until('stroke removed by undo', async () => (await renderedStroke()) === '');
        await saved();
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        assert.deepEqual(board.document, { schemaVersion: 5, layerIds: [], layers: {} });
    });
    await step('redo restores identical stroke geometry', async () => {
        await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
        await until('stroke restored by redo', async () => (await renderedStroke()) === originalStroke);
        await saved();
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        assert.deepEqual(board.document, originalDocument);
    });
    await step('pasting an unknown URL creates a durable local card with manual title fallback', async () => {
        const sourceUrl = 'https://shop.example/products/coat?variant=blue';
        await evaluate(`(() => {
            const data = new DataTransfer();
            data.setData('text/plain', ${JSON.stringify(sourceUrl)});
            const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
            document.querySelector('svg').dispatchEvent(event);
            return event.defaultPrevented;
        })()`);
        await until('pasted URL product card', () => evaluate('!!document.querySelector("g[data-product-card] a")'));
        const cardElement = await evaluate(`(() => {
            const card = document.querySelector('g[data-product-card]');
            const link = card?.querySelector('a');
            const input = card?.querySelector('input[aria-label="Product title"]');
            return { source: link?.getAttribute('href'), fallback: link?.textContent, input: !!input };
        })()`);
        assert.equal(cardElement.source, sourceUrl, 'The exact pasted source URL is retained');
        assert.equal(cardElement.fallback, sourceUrl, 'The raw URL remains readable without extraction');
        assert.equal(cardElement.input, true, 'The card exposes a manual title field');

        await click('input[aria-label="Product title"]');
        await page('Input.insertText', { text: 'Owner title' });
        await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await saved();
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        const cardId = board.document.layerIds.find(id => board.document.layers[id].type === 6);
        assert.ok(cardId, 'A product card is persisted in the board document');
        const card = board.document.layers[cardId];
        assert.equal(card.sourceUrl, sourceUrl);
        assert.equal(card.title, 'Owner title');
        assert.equal(card.titleSource, 'manual');
        assert.equal(card.extractionStatus, 'unsupported');
        originalDocument = board.document;
    });
    await step('export downloads a real nonempty PNG', async () => {
        await click('button:has(svg.lucide-image-down)');
        const download = await until('completed PNG download', () => begunDownloads.find(item => completedDownloads.has(item.guid)));
        assert.equal(download.suggestedFilename, 'Untitled board.png');
        const png = await readFile(join(downloads, download.guid));
        assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        assert.ok(png.length > 100); assert.ok(png.readUInt32BE(16) > 0); assert.ok(png.readUInt32BE(20) > 0);
        // Decode in the real browser and require opaque authored pixels.
        const pixels = await evaluate(`(async () => {
            const image = new Image(); image.src = 'data:image/png;base64,${png.toString('base64')}'; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
            const context=canvas.getContext('2d'); context.drawImage(image,0,0);
            const data=context.getImageData(0,0,canvas.width,canvas.height).data;
            return {width:image.width,height:image.height,visible:data.some((value,index)=>index%4===3 && value>0)};
        })()`);
        assert.ok(pixels.visible, 'PNG must contain authored pixels');
    });
    await step('reload survives browser navigation and application process restart', async () => {
        await page('Page.reload', { ignoreCache: true });
        await until('same stroke after reload', async () => (await renderedStroke()) === originalStroke);
        await saved();
        await context.stop(context.app);
        await context.startApp();
        await page('Page.reload', { ignoreCache: true });
        await until('same stroke after server restart', async () => (await renderedStroke()) === originalStroke);
        await saved();
        assert.equal(await evaluate('location.href'), boardUrl);
        assert.ok(await evaluate('document.body.textContent.includes("Untitled board")'));
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        assert.deepEqual(board.document, originalDocument);
    });
    await step('nested frames drag, resize, detach, reload and keep an outside child visible', async () => {
        const apiUrl = boardUrl.replace('/board/', '/api/boards/');
        const readDocument = async () => (await (await fetch(apiUrl)).json()).document;
        const key = async (value, code, windowsVirtualKeyCode, modifiers = 0) => {
            await page('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode, modifiers });
            await page('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode, modifiers });
        };
        const drag = async (from, to) => {
            await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from });
            await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, clickCount: 1 });
            for (let index = 1; index <= 8; index++) {
                const progress = index / 8;
                await page('Input.dispatchMouseEvent', { type: 'mouseMoved',
                    x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress,
                    button: 'left', buttons: 1 });
            }
            await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', buttons: 0, clickCount: 1 });
        };
        const renameSelectedFrame = async name => {
            await click('input[aria-label="Frame name"]');
            await key('a', 'KeyA', 65, 2);
            await page('Input.insertText', { text: name });
            await key('Tab', 'Tab', 9);
            await saved();
        };
        const selectByArrow = async (direction, code, windowsVirtualKeyCode) => {
            await click('select[aria-label="Containing frame"]');
            await key(direction, code, windowsVirtualKeyCode);
            await key('Enter', 'Enter', 13);
        };

        await click('button[aria-label="New frame"]');
        await until('new frame selected', () => evaluate(`!!document.querySelector("input[aria-label='Frame name']")`));
        await renameSelectedFrame('Outer frame');
        await click('button[aria-label="New frame"]');
        await until('second frame selected', () => evaluate(`!!document.querySelector("input[aria-label='Frame name']")`));
        await renameSelectedFrame('Inner frame');

        const created = await readDocument();
        const frameIds = created.layerIds.filter(id => created.layers[id].type === 7);
        assert.equal(frameIds.length, 2);
        const [outerId, innerId] = frameIds;
        const innerBeforeParent = { x: created.layers[innerId].x, y: created.layers[innerId].y };
        await selectByArrow('ArrowDown', 'ArrowDown', 40);
        await saved();
        let document = await readDocument();
        assert.equal(document.layers[innerId].parentId, outerId, 'Native arrow selection assigns the inner frame');
        assert.deepEqual({ x: document.layers[innerId].x, y: document.layers[innerId].y }, innerBeforeParent,
            'Containment-select arrows do not move the selected frame');
        assert.equal(await evaluate(`document.querySelector("select[aria-label='Containing frame']")?.value`), outerId,
            'The control reflects the selected frame parent');

        await click('button[aria-label="Rectangle (Ctrl+R)"]');
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 420 });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 420, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 600, y: 420, button: 'left', buttons: 0, clickCount: 1 });
        await saved();
        document = await readDocument();
        const childId = document.layerIds.find(id => document.layers[id].type === 0);
        assert.ok(childId);
        const childBeforeAssign = { x: document.layers[childId].x, y: document.layers[childId].y };
        await selectByArrow('ArrowDown', 'ArrowDown', 40);
        await saved();
        document = await readDocument();
        assert.equal(document.layers[childId].parentId, outerId, 'The native frame select assigns the child');
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, childBeforeAssign,
            'Native arrow navigation leaves descendant geometry unchanged');
        assert.equal(await evaluate(`document.querySelector("select[aria-label='Containing frame']")?.value`), outerId,
            'Changing selection to a child reflects its saved parent');

        await selectByArrow('Home', 'Home', 36);
        await saved();
        document = await readDocument();
        assert.equal(document.layers[childId].parentId, undefined, 'Selecting Board root directly detaches the child');
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, childBeforeAssign);
        await selectByArrow('ArrowDown', 'ArrowDown', 40);
        await saved();
        document = await readDocument();
        assert.equal(document.layers[childId].parentId, outerId, 'The child can be reassigned after detaching');
        await selectByArrow('ArrowDown', 'ArrowDown', 40);
        await saved();
        document = await readDocument();
        assert.equal(document.layers[childId].parentId, innerId, 'The child can be nested inside the inner frame');
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, childBeforeAssign);
        assert.equal(await evaluate(`document.querySelector("select[aria-label='Containing frame']")?.value`), innerId,
            'Changing the selected child updates the control to its new parent');
        assert.deepEqual(await evaluate(`Array.from(document.querySelector('[data-board-layers]').children).slice(0, 2).map(node => node.getAttribute('data-frame-name'))`),
            ['Outer frame', 'Inner frame'], 'The outer frame paints before its nested frame');

        const clickAt = async point => {
            await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
            await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
            await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
        };
        await clickAt({ x: 450, y: 310 });
        const innerScreen = await evaluate(`(() => {
            const bounds = document.querySelector('[data-frame-name="Inner frame"] [data-frame-bounds]').getBoundingClientRect();
            return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
        })()`);
        await drag({ x: innerScreen.right - 1, y: innerScreen.bottom - 1 }, { x: innerScreen.left + 110, y: innerScreen.top + 90 });
        await saved();
        document = await readDocument();
        const innerResized = document.layers[innerId];
        assert.equal(innerResized.width, 110);
        assert.equal(innerResized.height, 90);
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, childBeforeAssign,
            'Resizing the inner frame does not scale its now-outside child');
        assert.equal(document.layers[childId].parentId, innerId, 'Shrinking does not reparent an outside descendant');
        assert.ok(document.layers[childId].x >= innerResized.x + innerResized.width ||
            document.layers[childId].y >= innerResized.y + innerResized.height, 'The child remains outside the resized inner frame');
        assert.equal(document.layers[innerId].parentId, outerId);

        await clickAt({ x: 830, y: 580 });
        const outerScreen = await evaluate(`(() => {
            const bounds = document.querySelector('[data-frame-name="Outer frame"] [data-frame-bounds]').getBoundingClientRect();
            return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
        })()`);
        await drag({ x: outerScreen.right - 1, y: outerScreen.bottom - 1 }, { x: outerScreen.left + 130, y: outerScreen.top + 100 });
        await saved();
        document = await readDocument();
        const resizedOuter = document.layers[outerId];
        const resizedInner = document.layers[innerId];
        const resizedChild = document.layers[childId];
        assert.equal(resizedOuter.width, 130);
        assert.equal(resizedOuter.height, 100);
        assert.deepEqual({ x: resizedChild.x, y: resizedChild.y }, childBeforeAssign,
            'Shrinking the outer frame leaves the child at its absolute geometry');
        assert.ok(resizedChild.x >= resizedOuter.x + resizedOuter.width || resizedChild.y >= resizedOuter.y + resizedOuter.height,
            'The child remains outside the resized outer frame');
        assert.deepEqual({ x: resizedInner.x, y: resizedInner.y, width: resizedInner.width, height: resizedInner.height },
            { x: innerResized.x, y: innerResized.y, width: innerResized.width, height: innerResized.height },
            'Resizing the outer frame does not scale or move its nested frame');
        assert.equal(resizedChild.parentId, innerId, 'Shrinking does not reparent the outside descendant');
        assert.equal(resizedInner.parentId, outerId);

        const childHit = { x: resizedChild.x + 50, y: resizedChild.y + 50 };
        assert.ok(childHit.x < 1280 && childHit.y < 900, 'The outside child fixture is inside the visible viewport');
        await clickAt(childHit);
        await until('visible outside child selected by native pointer hit', () => evaluate(`Array.from(document.querySelectorAll('[data-editor-overlay] rect')).some(node => node.getAttribute('width') === '100' && node.getAttribute('height') === '100')`));

        const dragOrigin = { x: resizedOuter.x + resizedOuter.width - 10, y: resizedOuter.y + 5 };
        const movedTo = { x: dragOrigin.x + 20, y: dragOrigin.y + 15 };
        await drag(dragOrigin, movedTo);
        await saved();
        document = await readDocument();
        assert.deepEqual({ x: document.layers[outerId].x, y: document.layers[outerId].y }, { x: resizedOuter.x + 20, y: resizedOuter.y + 15 });
        assert.deepEqual({ x: document.layers[innerId].x, y: document.layers[innerId].y }, { x: resizedInner.x + 20, y: resizedInner.y + 15 });
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, { x: resizedChild.x + 20, y: resizedChild.y + 15 },
            'Dragging the outer frame moves every descendant exactly once');

        await click('button[aria-label="Undo (Ctrl+Z)"]');
        await saved();
        document = await readDocument();
        assert.deepEqual({ x: document.layers[outerId].x, y: document.layers[outerId].y }, { x: resizedOuter.x, y: resizedOuter.y });
        assert.deepEqual({ x: document.layers[innerId].x, y: document.layers[innerId].y }, { x: resizedInner.x, y: resizedInner.y });
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, { x: resizedChild.x, y: resizedChild.y });
        await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
        await saved();
        document = await readDocument();
        assert.deepEqual({ x: document.layers[outerId].x, y: document.layers[outerId].y }, { x: resizedOuter.x + 20, y: resizedOuter.y + 15 });
        assert.deepEqual({ x: document.layers[childId].x, y: document.layers[childId].y }, { x: resizedChild.x + 20, y: resizedChild.y + 15 });
        await page('Page.reload', { ignoreCache: true });
        await until('nested frame geometry and names after reload', async () => {
            const current = await readDocument();
            return current.layers[childId]?.x === resizedChild.x + 20 && current.layers[childId]?.parentId === innerId &&
                current.layers[innerId]?.parentId === outerId && current.layers[outerId]?.name === 'Outer frame' &&
                current.layers[innerId]?.name === 'Inner frame';
        });
        assert.deepEqual(await evaluate(`Array.from(document.querySelector('[data-board-layers]').children).slice(0, 2).map(node => node.getAttribute('data-frame-name'))`),
            ['Outer frame', 'Inner frame'], 'Reload keeps ancestor-first frame paint order');

        for (const viewport of [{ width: 1280, height: 900, label: 'wide' }, { width: 390, height: 844, label: 'narrow' }]) {
            await page('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
            const screenshot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            const screenshotBytes = Buffer.from(screenshot.data, 'base64');
            assert.deepEqual(screenshotBytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            await writeFile(join(downloads, `frames-${viewport.label}.png`), screenshotBytes);
        }
        await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    });
    await step('visible image requests follow committed camera zoom and rendered CSS pixels', async () => {
        const { Transformer } = require('@napi-rs/image');
        const pixels = Buffer.alloc(800 * 400 * 4);
        for (let i = 0; i < pixels.length; i += 4) pixels.set([i / 4 % 256, 80, 190, 255], i);
        const imageBytes = await Transformer.fromRgbaPixels(pixels, 800, 400).png();
        const upload = await fetch(`${origin}/api/assets`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/png' }, body: imageBytes, signal: AbortSignal.timeout(deadline) });
        assert.equal(upload.status, 201);
        const asset = await upload.json();
        zoomAssetId = asset.id;
        const boardApi = boardUrl.replace('/board/', '/api/boards/');
        const storedBoard = await (await fetch(boardApi, { signal: AbortSignal.timeout(deadline) })).json();
        const document = structuredClone(storedBoard.document);
        document.layerIds.push('progressive-image');
        document.layers['progressive-image'] = { type: 5, x: 500, y: 300, width: 100, height: 200, assetId: asset.id };
        const patched = await fetch(boardApi, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ document }), signal: AbortSignal.timeout(deadline) });
        assert.equal(patched.status, 200);
        await page('Page.reload', { ignoreCache: true });
        await until('visible image preview after reload', () => evaluate(`(() => {
            const image = document.querySelector('image[aria-label="Board image"]');
            return image?.getAttribute('href')?.startsWith('blob:') === true;
        })()`));
        const initial = await until('first visible 48-pixel image preview request', () => evaluate(`performance.getEntriesByType('resource').some(entry => entry.name.includes('/api/assets/${asset.id}?width=48'))`));
        assert.equal(initial, true);
        await page('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 550, y: 400, deltaY: -100, deltaX: 0, modifiers: 2 });
        await page('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 550, y: 400, deltaY: -100, deltaX: 0, modifiers: 2 });
        const measured = await until('committed zoom requests the width selected from rendered bounds', async () => evaluate(`(() => {
            const image = document.querySelector('image[aria-label="Board image"]');
            const camera = document.querySelector('[data-board-camera]');
            const transform = camera?.getAttribute('transform') || '';
            const match = transform.match(/scale\\(([^)]+)\\)/);
            const bounds = image?.getBoundingClientRect();
            const zoom = Number(match?.[1] || 1);
            const width = bounds?.width || 0;
            const dpr = window.devicePixelRatio || 1;
            const requested = [48, 160, 320, 640, 1280, 2560].find(value => value >= Math.ceil(width * dpr)) || 2560;
            const fetched = performance.getEntriesByType('resource').some(entry => entry.name.includes('/api/assets/${asset.id}?width=' + requested));
            return fetched && zoom > 1.5 ? { width, zoom, dpr, requested } : false;
        })()`));
        assert.deepEqual(measured, { width: measured.width, zoom: measured.zoom, dpr: 1, requested: 320 });
        assert.ok(Math.ceil(measured.width * measured.dpr) <= measured.requested);
        assert.ok(measured.requested === 48 || Math.ceil(measured.width * measured.dpr) > [48, 160, 320, 640, 1280, 2560][[48, 160, 320, 640, 1280, 2560].indexOf(measured.requested) - 1]);
        assert.equal(await evaluate(`document.querySelector('image[aria-label="Board image"]')?.getAttribute('href')?.startsWith('blob:')`), true);
    });
    await step('pre-version board with all five layer types opens, edits, undoes and saves as v5', async () => {
        const fill = { r: 10, g: 20, b: 30 };
        // Unversioned synthetic document as stored before E001-T03; record order differs from paint order.
        const fixture = { layerIds: ['note-5', 'rect-1', 'path-3', 'ellipse-2', 'text-4'], layers: {
            'rect-1': { type: 0, x: 400, y: 260, width: 120, height: 80, fill },
            'ellipse-2': { type: 1, x: 640.5, y: 300.25, width: 90, height: 60, fill },
            'path-3': { type: 2, x: 700, y: 420, width: 50, height: 25, fill, points: [[0, 0, 0.5], [25, 10, 0.5], [50, 25, 0.5]] },
            'text-4': { type: 3, x: 420, y: 420, width: 160, height: 50, fill, value: 'Synthetic text' },
            'note-5': { type: 4, x: 820, y: 240, width: 140, height: 140, fill, value: 'Synthetic note' },
        } };
        const storedText = JSON.stringify(fixture);
        const read = () => {
            const db = new DatabaseSync(databasePath, { readOnly: true });
            try { return { ...db.prepare('SELECT title, document FROM boards WHERE id = ?').get('pre-version') }; } finally { db.close(); }
        };
        const db = new DatabaseSync(databasePath);
        try { db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run('pre-version', 'Pre-version fixture', 1, 1, storedText); } finally { db.close(); }
        await page('Page.navigate', { url: `${origin}/board/pre-version` });
        await until('all five fixture layers rendered', () => evaluate(`(() => {
            const svg = Array.from(document.querySelectorAll("svg")).find(svg => svg.classList.contains("h-[100vh]"));
            return !!svg && !!svg.querySelector("rect") && !!svg.querySelector("ellipse") && !!svg.querySelector("path") &&
                svg.textContent.includes("Synthetic text") && svg.textContent.includes("Synthetic note");
        })()`));
        assert.ok(await evaluate('document.body.textContent.includes("Pre-version fixture")'));
        assert.equal(read().document, storedText, 'Opening must not rewrite the stored payload');
        const rectangle = { x: 460, y: 300 };
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rectangle });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...rectangle, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rectangle, button: 'left', buttons: 0, clickCount: 1 });
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        await until('keyboard move saved with the current schema', () => {
            const document = JSON.parse(read().document);
            return document.schemaVersion === 5 && document.layers['rect-1'].x === 405;
        });
        await click('button[aria-label="Undo (Ctrl+Z)"]');
        const expected = { schemaVersion: 5, ...fixture };
        await until('undo saved the original content', () => isDeepStrictEqual(JSON.parse(read().document), expected));
        await saved();
        assert.equal(read().title, 'Pre-version fixture');
        const board = await (await fetch(`${origin}/api/boards/pre-version`)).json();
        assert.deepEqual(board.document, expected);
    });
    await step('API refuses future versions with 409 and invalid relations with 400, leaving rows unchanged', async () => {
        const futureText = '{"schemaVersion": 99, "layerIds": [], "layers": {}}';
        const db = new DatabaseSync(databasePath);
        try { db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run('future', 'Future fixture', 2, 2, futureText); } finally { db.close(); }
        const rows = () => {
            const db = new DatabaseSync(databasePath, { readOnly: true });
            try { return db.prepare('SELECT * FROM boards WHERE id IN (?, ?) ORDER BY id').all('future', 'pre-version').map(row => ({ ...row })); } finally { db.close(); }
        };
        const before = rows();
        const request = async (id, method, body) => {
            const response = await fetch(`${origin}/api/boards/${id}`, { method, headers: { 'Content-Type': 'application/json' },
                ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(deadline) });
            return { status: response.status, body: await response.json() };
        };
        const cycle = { schemaVersion: 2, layerIds: ['a'], layers: { a: { type: 0, x: 0, y: 0, width: 1, height: 1, fill: { r: 0, g: 0, b: 0 }, parentId: 'a' } } };
        assert.deepEqual(await request('future', 'GET'), { status: 409, body: { error: 'Document schema version 99 is newer than supported version 5', code: 'unsupported-version' } });
        assert.equal((await request('future', 'PATCH', { title: 'Renamed' })).status, 409);
        assert.equal((await request('pre-version', 'PATCH', { document: cycle })).body.code, 'cycle');
        assert.equal((await request('pre-version', 'PATCH', { document: cycle })).status, 400);
        assert.deepEqual(rows(), before, 'Refused requests leave stored rows unchanged');
        const listed = await (await fetch(`${origin}/api/boards`)).json();
        assert.equal(listed.find(board => board.id === 'future').documentError.code, 'unsupported-version');
    });
    await step('asset upload is validated, stored beside SQLite, referenced by ID and served after restart', async () => {
        const { Transformer } = require('@napi-rs/image');
        const pixels = Buffer.alloc(30 * 20 * 4);
        for (let i = 0; i < pixels.length; i += 4) pixels.set([i % 256, 90, 200, 255], i);
        const png = await Transformer.fromRgbaPixels(pixels, 30, 20).png();
        const upload = (body, type, headers = { Origin: origin }) => fetch(`${origin}/api/assets`, {
            method: 'POST', headers: { ...headers, 'Content-Type': type }, body, signal: AbortSignal.timeout(deadline) });
        assert.equal((await upload(png, 'image/png', { Origin: 'https://untrusted.invalid' })).status, 403);
        assert.equal((await upload(png, 'image/jpeg')).status, 415);
        assert.equal((await upload(Buffer.alloc(50 * 1024 * 1024 + 1), 'image/png')).status, 413);
        const created = await upload(png, 'image/png');
        assert.equal(created.status, 201);
        const asset = await created.json();
        assert.equal((await upload(png, 'image/png')).status, 200, 'Same bytes are stored once');
        const stored = join(databasePath, '..', 'assets', asset.id.slice(0, 2), asset.id);
        assert.deepEqual(await readFile(stored), png, 'Original sits in the data root beside SQLite');
        const orientedPixels = Buffer.alloc(200 * 100 * 4);
        for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) {
            orientedPixels.set(x < 100 ? [230, 30, 45, 255] : [20, 80, 220, 255], (y * 200 + x) * 4);
        }
        const rawJpeg = await Transformer.fromRgbaPixels(orientedPixels, 200, 100).jpeg(90);
        const tiff = Buffer.alloc(26);
        tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4); tiff.writeUInt16LE(1, 8);
        tiff.writeUInt16LE(0x112, 10); tiff.writeUInt16LE(3, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt16LE(6, 18);
        const exif = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
        const marker = Buffer.alloc(4); marker[0] = 255; marker[1] = 225; marker.writeUInt16BE(exif.length + 2, 2);
        const orientedJpeg = Buffer.concat([rawJpeg.subarray(0, 2), marker, exif, rawJpeg.subarray(2)]);
        const orientedUpload = await upload(orientedJpeg, 'image/jpeg');
        assert.equal(orientedUpload.status, 201);
        const orientedAsset = await orientedUpload.json();
        assert.deepEqual({ width: orientedAsset.width, height: orientedAsset.height }, { width: 100, height: 200 },
            'New image layers size themselves from EXIF-oriented dimensions');
        const orientedStoredPath = join(databasePath, '..', 'assets', orientedAsset.id.slice(0, 2), orientedAsset.id);
        assert.deepEqual(await readFile(orientedStoredPath), orientedJpeg, 'EXIF JPEG original bytes remain unchanged');
        const variantResponse = await fetch(`${origin}/api/assets/${orientedAsset.id}?width=160`, { signal: AbortSignal.timeout(deadline) });
        assert.equal(variantResponse.headers.get('content-type'), 'image/webp');
        const orientedVariant = Buffer.from(await variantResponse.arrayBuffer());
        const variantMetadata = await new Transformer(orientedVariant).metadata(true);
        assert.deepEqual({ width: variantMetadata.width, height: variantMetadata.height }, { width: 100, height: 200 },
            'Small requested variants preserve oriented portrait geometry without upscaling');
        const orientationPixels = await evaluate(`(async()=>{const urls=${JSON.stringify([
            `data:image/jpeg;base64,${orientedJpeg.toString('base64')}`,
            `data:image/webp;base64,${orientedVariant.toString('base64')}`,
        ])};const result=[];for(const url of urls){const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixel=(x,y)=>Array.from(context.getImageData(x,y,1,1).data);result.push({width:image.naturalWidth,height:image.naturalHeight,top:pixel(10,10),bottom:pixel(10,image.naturalHeight-10)});}return result;})()`);
        assert.equal(orientationPixels[0].height > orientationPixels[0].width, true);
        assert.equal(orientationPixels[1].height > orientationPixels[1].width, true);
        assert.ok(orientationPixels[1].top[0] > orientationPixels[1].top[2], 'The variant keeps red at the top');
        assert.ok(orientationPixels[1].bottom[2] > orientationPixels[1].bottom[0], 'The variant keeps blue at the bottom');
        for (const id of ['..%2F..%2Fsynthetic.sqlite', '..%2Fdata%2Fmiro.sqlite', asset.id.toUpperCase()]) {
            assert.equal((await fetch(`${origin}/api/assets/${id}`)).status, 400, id);
        }
        const document = { schemaVersion: 2, layerIds: ['picture'], layers: { picture: { type: 0, x: 40, y: 40, width: 30, height: 20, fill: { r: 0, g: 0, b: 0 }, assetId: asset.id } } };
        const patch = async (id, body) => (await fetch(`${origin}/api/boards/${id}`, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(deadline) }));
        const board = await (await fetch(`${origin}/api/boards`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Asset board' }) })).json();
        const dangling = structuredClone(document); dangling.layers.picture.assetId = 'f'.repeat(64);
        assert.equal((await patch(board.id, { document: dangling })).status, 400, 'Unknown asset references are refused');
        assert.equal((await patch(board.id, { document })).status, 200);
        await context.stop(context.app);
        await context.startApp();
        const served = await fetch(`${origin}/api/assets/${asset.id}`);
        assert.equal(served.status, 200);
        assert.equal(served.headers.get('content-type'), 'image/png');
        assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await served.arrayBuffer()), png, 'Same bytes after restart');
        assert.deepEqual((await (await fetch(`${origin}/api/boards/${board.id}`)).json()).document,
            { ...document, schemaVersion: 5 });
        const report = await (await fetch(`${origin}/api/assets`)).json();
        const mainBoardId = new URL(boardUrl).pathname.split('/').at(-1);
        assert.deepEqual(report.referenced, [
            { id: asset.id, boards: [board.id] },
            { id: zoomAssetId, boards: [mainBoardId] },
        ].sort((left, right) => left.id.localeCompare(right.id)));
        assert.deepEqual(report.unused, [orientedAsset.id], 'The standalone EXIF fixture remains an intentionally unused original');
        assert.deepEqual(report.missing, [], 'No referenced originals are missing');
        assert.deepEqual(report.unregistered, [], 'No stored originals are unregistered');
        assert.deepEqual(report.danglingReferences, [], 'No board points to an unregistered original');
        assert.deepEqual(report.deletable, []);
        assert.deepEqual(report.unscannedBoards, []);
        const decoded = await evaluate(`(async () => { const image = new Image(); image.src = '/api/assets/${asset.id}'; await image.decode(); return [image.naturalWidth, image.naturalHeight]; })()`);
        assert.deepEqual(decoded, [30, 20], 'The browser decodes the served original');
    });
    assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(networkFailures, [], 'No failed browser requests');
});
