// The entrypoint shares browser setup with the split workflow helper.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
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
        const clickAt = async point => {
            await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
            await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
            await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
        };
        const renameSelectedFrame = async (name, commitKey) => {
            await click('input[aria-label="Frame name"]');
            await key('a', 'KeyA', 65, 2);
            await key('Backspace', 'Backspace', 8);
            assert.equal(await evaluate(`document.querySelector('input[aria-label="Frame name"]').value`), '', 'Clearing the frame name leaves an editable empty draft');
            for (const character of name) await page('Input.insertText', { text: character });
            assert.equal(await evaluate(`document.querySelector('input[aria-label="Frame name"]').value`), name,
                'Per-character input preserves spaces in the in-progress frame name');
            if (commitKey === 'Enter') await key('Enter', 'Enter', 13);
            else await key('Tab', 'Tab', 9);
            await saved();
        };
        const selectByArrow = async (direction, code, windowsVirtualKeyCode) => {
            await click('select[aria-label="Containing frame"]');
            await key(direction, code, windowsVirtualKeyCode);
            await key('Enter', 'Enter', 13);
        };

        const initialDocument = await readDocument();
        const syntheticCardId = initialDocument.layerIds.find(id => initialDocument.layers[id].type === 6);
        assert.ok(syntheticCardId, 'The previously verified synthetic product card is present');
        const cardTarget = await evaluate(`(() => {
            const card = document.querySelector('g[data-product-card]');
            if (!card) return false;
            const bounds = card.getBoundingClientRect();
            const point = { x: bounds.left + bounds.width / 2, y: bounds.top + 56 };
            const hit = document.elementFromPoint(point.x, point.y);
            return {
                point,
                bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
                hitsCard: hit?.closest('g[data-product-card]') === card,
                hitTag: hit?.tagName ?? null,
            };
        })()`);
        assert.ok(cardTarget, 'The synthetic product card is rendered for native selection');
        assert.equal(cardTarget.hitsCard, true, `The measured card point must hit the synthetic card: ${JSON.stringify(cardTarget)}`);
        await clickAt(cardTarget.point);
        await until('synthetic product card selected by native pointer hit', () => evaluate(`!!document.querySelector('[data-editor-overlay] rect')`));
        await until('selected product card Delete control', () => evaluate(`!!document.querySelector('button:has(svg.lucide-trash2)')`));
        await clickAt(await evaluate(`(() => {
            const bounds = document.querySelector('button:has(svg.lucide-trash2)').getBoundingClientRect();
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        })()`));
        await saved();
        await until('synthetic product card removed from UI and document', async () => {
            const current = await readDocument();
            const cardAbsentFromUi = await evaluate(`!document.querySelector('g[data-product-card]')`);
            return !current.layers[syntheticCardId] && cardAbsentFromUi;
        });
        assert.equal((await readDocument()).layers[syntheticCardId], undefined,
            'The synthetic product card is deleted through the existing UI');

        await click('button[aria-label="New frame"]');
        await until('new frame selected', () => evaluate(`!!document.querySelector("input[aria-label='Frame name']")`));
        await renameSelectedFrame('Outer frame', 'Enter');
        await click('button[aria-label="New frame"]');
        await until('second frame selected', () => evaluate(`!!document.querySelector("input[aria-label='Frame name']")`));
        await renameSelectedFrame('Inner frame', 'Tab');

        const created = await readDocument();
        const frameIds = created.layerIds.filter(id => created.layers[id].type === 7);
        assert.equal(frameIds.length, 2);
        const [outerId, innerId] = frameIds;
        assert.equal(created.layers[outerId].name, 'Outer frame', 'The exact outer frame name is saved');
        assert.equal(created.layers[innerId].name, 'Inner frame', 'The exact inner frame name is saved');
        const initialInnerPosition = { x: created.layers[innerId].x, y: created.layers[innerId].y };
        const innerMove = await evaluate(`(() => {
            const frame = document.querySelector('[data-frame-id="${innerId}"]');
            const bounds = frame?.querySelector('[data-frame-bounds]')?.getBoundingClientRect();
            if (!frame || !bounds) return false;
            const point = { x: bounds.left + 10, y: bounds.top + 200 };
            const hit = document.elementFromPoint(point.x, point.y);
            return {
                point,
                insideBounds: point.x >= bounds.left && point.x < bounds.right && point.y >= bounds.top && point.y < bounds.bottom,
                hitFrameId: hit?.closest('[data-frame-id]')?.getAttribute('data-frame-id') ?? null,
                bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
            };
        })()`);
        assert.ok(innerMove, 'Inner frame has rendered bounds for a native move');
        assert.equal(innerMove.insideBounds, true, `Measured Inner frame move point must be inside its bounds: ${JSON.stringify(innerMove)}`);
        assert.equal(innerMove.hitFrameId, innerId, `Measured Inner frame move point must hit Inner frame: ${JSON.stringify(innerMove)}`);
        await drag(innerMove.point, { x: innerMove.point.x + 20, y: innerMove.point.y + 40 });
        await saved();
        const movedDocument = await readDocument();
        assert.deepEqual({ x: movedDocument.layers[innerId].x, y: movedDocument.layers[innerId].y },
            { x: initialInnerPosition.x + 20, y: initialInnerPosition.y + 40 },
            'A native drag separates the Inner frame origin before containment assignment');
        let innerBeforeParent = { x: movedDocument.layers[innerId].x, y: movedDocument.layers[innerId].y };
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

        const screenshotDirectory = await mkdtemp(join(tmpdir(), 'miro-frame-evidence-'));
        t.diagnostic(`Frame screenshot evidence directory: ${screenshotDirectory}`);
        const preClickState = await evaluate(`(() => {
            const innerFrame = document.querySelector('[data-frame-id="${innerId}"]');
            const innerBounds = innerFrame?.querySelector('[data-frame-bounds]')?.getBoundingClientRect();
            const actualPoint = innerBounds ? { x: innerBounds.left + 10, y: innerBounds.top + 200 } : null;
            const pointInsideFrameBounds = !!innerBounds && !!actualPoint && actualPoint.x >= innerBounds.left &&
                actualPoint.x < innerBounds.right && actualPoint.y >= innerBounds.top && actualPoint.y < innerBounds.bottom;
            const hit = actualPoint ? document.elementFromPoint(actualPoint.x, actualPoint.y) : null;
            const selectedFrameInput = document.querySelector('input[aria-label="Frame name"]');
            const frameRects = Array.from(document.querySelectorAll('[data-board-layers] [data-frame-id]')).slice(0, 10).map(frame => {
                const rect = frame.getBoundingClientRect();
                return {
                    id: frame.getAttribute('data-frame-id'),
                    name: frame.getAttribute('data-frame-name'),
                    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
                };
            });
            const frameAncestry = hit?.closest('[data-frame-id]');
            return {
                actualPoint,
                pointInsideFrameBounds,
                expectedFrameId: ${JSON.stringify(innerId)},
                innerFrameBounds: innerBounds ? {
                    left: innerBounds.left, top: innerBounds.top, right: innerBounds.right, bottom: innerBounds.bottom,
                } : null,
                frames: frameRects,
                selectedFrameInput: {
                    exists: !!selectedFrameInput,
                    value: selectedFrameInput?.value.slice(0, 120) ?? null,
                },
                hit: {
                    tag: hit?.tagName ?? null,
                    frameId: frameAncestry?.getAttribute('data-frame-id') ?? null,
                    insideProductCard: !!hit?.closest('[data-product-card]'),
                    insideEditorOverlay: !!hit?.closest('[data-editor-overlay]'),
                },
            };
        })()`);
        t.diagnostic(`Frame click pre-state: ${JSON.stringify(preClickState)}`);
        assert.equal(preClickState.pointInsideFrameBounds, true,
            `Measured click point must be inside Inner frame bounds: ${JSON.stringify(preClickState)}`);
        assert.equal(preClickState.hit.frameId, innerId,
            `Measured click point must hit the expected Inner frame before selection: ${JSON.stringify(preClickState)}`);
        const actualPoint = preClickState.actualPoint;
        const beforeClickScreenshot = Buffer.from((await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
        await clickAt(actualPoint);
        const afterClickScreenshot = Buffer.from((await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
        try {
            await until('Inner frame selected by the pointer click', () => evaluate(`document.querySelector('input[aria-label="Frame name"]')?.value === 'Inner frame'`));
        } catch (error) {
            try {
                const beforeClickPath = join(screenshotDirectory, 'frame-select-before.png');
                const afterClickPath = join(screenshotDirectory, 'frame-select-after-failed-wait.png');
                await writeFile(beforeClickPath, beforeClickScreenshot);
                await writeFile(afterClickPath, afterClickScreenshot);
                t.diagnostic(`Frame click screenshot before native click: ${beforeClickPath}`);
                t.diagnostic(`Frame click screenshot after failed selection wait: ${afterClickPath}`);
            } catch (screenshotError) {
                t.diagnostic(`Could not capture post-click failure screenshot: ${screenshotError.message}`);
            }
            throw error;
        }
        assert.equal(await evaluate(`document.querySelector('input[aria-label="Frame name"]')?.value`), 'Inner frame',
            'The resize gesture starts with Inner frame selected');
        const innerScreen = await evaluate(`(() => {
            const bounds = document.querySelector('[data-frame-name="Inner frame"] [data-frame-bounds]').getBoundingClientRect();
            const selectedFrameName = document.querySelector('input[aria-label="Frame name"]')?.value ?? null;
            const handles = Array.from(document.querySelectorAll('[data-editor-overlay] rect')).map(handle => {
                const rect = handle.getBoundingClientRect();
                return {
                    node: handle,
                    tag: handle.tagName,
                    className: typeof handle.className === 'string' ? handle.className : handle.className.baseVal,
                    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
                    center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
                    cursor: getComputedStyle(handle).cursor,
                };
            });
            const bottomRightHandle = handles
                .filter(handle => handle.cursor === 'nwse-resize' && handle.right > handle.left && handle.bottom > handle.top)
                .sort((left, right) => {
                    const leftDistance = Math.hypot(left.center.x - bounds.right, left.center.y - bounds.bottom);
                    const rightDistance = Math.hypot(right.center.x - bounds.right, right.center.y - bounds.bottom);
                    return leftDistance - rightDistance;
                })[0];
            const hit = bottomRightHandle && document.elementFromPoint(bottomRightHandle.center.x, bottomRightHandle.center.y);
            return {
                selectedFrameName,
                expectedFrameId: ${JSON.stringify(innerId)},
                bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
                bottomRightHandle: bottomRightHandle && {
                    tag: bottomRightHandle.tag,
                    className: bottomRightHandle.className,
                    left: bottomRightHandle.left, top: bottomRightHandle.top,
                    right: bottomRightHandle.right, bottom: bottomRightHandle.bottom,
                    center: bottomRightHandle.center,
                    cursor: bottomRightHandle.cursor,
                },
                hit: hit && {
                    tag: hit.tagName,
                    className: typeof hit.className === 'string' ? hit.className : hit.className.baseVal,
                    insideEditorOverlay: !!hit.closest('[data-editor-overlay]'),
                },
                exactHandleHit: !!bottomRightHandle && hit === bottomRightHandle.node,
            };
        })()`);
        assert.ok(innerScreen.bottomRightHandle, `Expected rendered bottom-right resize handle; measured selection: ${JSON.stringify(innerScreen)}`);
        assert.ok(innerScreen.bottomRightHandle.right > innerScreen.bottomRightHandle.left &&
            innerScreen.bottomRightHandle.bottom > innerScreen.bottomRightHandle.top,
        'The bottom-right resize handle has hit-testable rendered bounds');
        t.diagnostic(`Resize hit-test: ${JSON.stringify(innerScreen)}`);
        assert.equal(innerScreen.exactHandleHit, true, `The bottom-right handle must be the native pointer hit target: ${JSON.stringify(innerScreen)}`);
        await drag(innerScreen.bottomRightHandle.center, {
            x: innerScreen.bounds.left + 110,
            y: innerScreen.bounds.top + 90,
        });
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

        const unlockedSelectionVisuals = await evaluate(`(() => {
            const outline = document.querySelector('[data-selection-outline]');
            const button = document.querySelector('button[aria-label="Lock selected objects"]');
            if (!outline || !button) return false;
            const rect = outline.getBoundingClientRect();
            const handles = Array.from(document.querySelectorAll('[data-editor-overlay] rect'))
                .filter(node => getComputedStyle(node).cursor.endsWith('resize'))
                .map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
            const r = button.getBoundingClientRect();
            return {
                stroke: getComputedStyle(outline).stroke,
                bounds: [rect.x, rect.y, rect.width, rect.height],
                handles,
                button: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
                buttonBackground: getComputedStyle(button).backgroundColor,
                buttonColor: getComputedStyle(button).color,
            };
        })()`);
        assert.ok(unlockedSelectionVisuals, 'The selected frame has an outline and lock toggle');
        assert.equal(unlockedSelectionVisuals.stroke, 'rgb(59, 130, 246)', 'An unlocked selection keeps the blue outline');
        assert.equal(unlockedSelectionVisuals.handles.length, 8, 'The selection keeps all eight resize handles');
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1100, y: 800 });
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x: unlockedSelectionVisuals.button.x, y: unlockedSelectionVisuals.button.y });
        const hoveredLockButton = await until('lock button hover styling', () => evaluate(`(() => {
            const button = document.querySelector('button[aria-label="Lock selected objects"]');
            const background = getComputedStyle(button).backgroundColor;
            const color = getComputedStyle(button).color;
            return background !== ${JSON.stringify(unlockedSelectionVisuals.buttonBackground)} &&
                color !== ${JSON.stringify(unlockedSelectionVisuals.buttonColor)} ? { background, color } : false;
        })()`));
        assert.match(hoveredLockButton.background, /59, 130, 246/);
        assert.match(hoveredLockButton.color, /^rgb\(/);
        await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await evaluate(`document.querySelector('button[aria-label="Lock selected objects"]').focus()`);
        const focusedLockButton = await evaluate(`(() => {
            const button = document.querySelector('button[aria-label="Lock selected objects"]');
            return { visible: button.matches(':focus-visible'), shadow: getComputedStyle(button).boxShadow };
        })()`);
        assert.equal(focusedLockButton.visible, true, 'The lock button remains visible under keyboard focus');
        assert.notEqual(focusedLockButton.shadow, 'none', 'The existing focus-visible ring remains rendered');

        await click('button[aria-label="Lock selected objects"]');
        await saved();
        document = await readDocument();
        assert.equal(document.layers[innerId].locked, true, 'The selection toolbar locks the selected frame');
        assert.equal(document.layers[childId].locked, undefined, 'A frame lock is inherited without rewriting child lock bits');
        assert.equal(await evaluate(`!!document.querySelector('[aria-label="Selection contains locked objects"]')`), true,
            'The selected frame shows a visible lock indicator');
        const lockedSelectionVisuals = await evaluate(`(() => {
            const outline = document.querySelector('[data-selection-outline]');
            const badge = document.querySelector('[data-lock-badge]');
            if (!outline || !badge) return false;
            const rect = outline.getBoundingClientRect();
            const badgeRect = badge.getBoundingClientRect();
            const handles = Array.from(document.querySelectorAll('[data-editor-overlay] rect'))
                .filter(node => getComputedStyle(node).cursor.endsWith('resize'))
                .map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
            return {
                stroke: getComputedStyle(outline).stroke,
                bounds: [rect.x, rect.y, rect.width, rect.height],
                badge: [badgeRect.x, badgeRect.y, badgeRect.width, badgeRect.height],
                handles,
            };
        })()`);
        assert.ok(lockedSelectionVisuals, 'An effectively locked selection has a top-right lock badge');
        assert.equal(lockedSelectionVisuals.stroke, 'rgb(163, 163, 163)', 'An effectively locked selection uses neutral-400');
        assert.deepEqual(lockedSelectionVisuals.bounds, unlockedSelectionVisuals.bounds, 'Lock styling preserves selection geometry');
        assert.deepEqual(lockedSelectionVisuals.handles, unlockedSelectionVisuals.handles, 'Lock styling preserves all resize handle geometry');
        assert.ok(Math.abs(lockedSelectionVisuals.badge[2] - 18) < 1 && Math.abs(lockedSelectionVisuals.badge[3] - 18) < 1,
            `The lock badge stays 18 screen pixels: ${JSON.stringify(lockedSelectionVisuals.badge)}`);
        assert.ok(Math.abs(lockedSelectionVisuals.badge[0] - (lockedSelectionVisuals.bounds[0] + lockedSelectionVisuals.bounds[2])) < 1 &&
            Math.abs(lockedSelectionVisuals.badge[1] - (lockedSelectionVisuals.bounds[1] - 18)) < 1,
        'The lock badge sits at the selection top-right without covering its resize handle');
        const lockedSelectionScreenshot = join(screenshotDirectory, 'locked-selection.png');
        await writeFile(lockedSelectionScreenshot, Buffer.from(
            (await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data,
            'base64'
        ));
        t.diagnostic(`Locked selection screenshot: ${lockedSelectionScreenshot}`);
        await click('button[aria-label="Undo (Ctrl+Z)"]');
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, undefined, 'Lock changes are undoable');
        await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, true, 'Lock changes are redoable');
        await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'l', code: 'KeyL', modifiers: 10 });
        await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'l', code: 'KeyL', modifiers: 10 });
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, undefined, 'Ctrl+Shift+L unlocks the selected frame');

        const innerBounds = await evaluate(`(() => { const r = document.querySelector('[data-frame-id="${innerId}"] [data-frame-bounds]').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; })()`);
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', x: innerBounds.x, y: innerBounds.y, button: 'right', buttons: 2, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', x: innerBounds.x, y: innerBounds.y, button: 'right', buttons: 0, clickCount: 1 });
        await until('selected object context menu', () => evaluate(`!!document.querySelector('[role="menuitem"]')`));
        await click('[role="menuitem"]');
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, true, 'The context menu locks the selected frame');
        await click('button[aria-label="Unlock selected objects"]');
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, undefined, 'The selection toolbar unlocks the selected frame');
        await click('button[aria-label="Lock selected objects"]');
        await saved();
        await click('button:has(svg.lucide-copy)');
        await saved();
        document = await readDocument();
        const duplicateFrameId = document.layerIds.find(id => id !== outerId && id !== innerId && document.layers[id].type === 7);
        assert.ok(duplicateFrameId, 'The locked frame can be duplicated');
        assert.equal(document.layers[duplicateFrameId].locked, undefined, 'A duplicate is an unlocked copy');
        await click('button:has(svg.lucide-trash2)');
        await saved();
        assert.equal((await readDocument()).layers[duplicateFrameId], undefined, 'The unlocked duplicate can be deleted');
        await click('button[aria-label="Undo (Ctrl+Z)"]');
        await saved();
        await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
        await saved();
        await clickAt({ x: innerResized.x + 5, y: innerResized.y + 5 });
        await until('original frame selected after duplicate deletion', () => evaluate(`document.querySelector('input[aria-label="Frame name"]')?.value === 'Inner frame'`));
        await click('button[aria-label="Unlock selected objects"]');
        await saved();
        assert.equal((await readDocument()).layers[innerId].locked, undefined, 'The original frame remains editable after removing its duplicate');

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
        const blankCanvasHit = await evaluate(`(() => {
            const hit = document.elementFromPoint(900, 700);
            return {
                tag: hit?.tagName ?? null,
                isBoardSvg: hit === Array.from(document.querySelectorAll('svg')).find(svg => svg.classList.contains('h-[100vh]')),
                insideFrame: !!hit?.closest('[data-frame-id]'),
                insideProductCard: !!hit?.closest('[data-product-card]'),
                insideEditorOverlay: !!hit?.closest('[data-editor-overlay]'),
            };
        })()`);
        t.diagnostic(`Blank canvas hit at (900,700): ${JSON.stringify(blankCanvasHit)}`);
        assert.equal(blankCanvasHit.isBoardSvg, true, `Expected blank SVG canvas hit: ${JSON.stringify(blankCanvasHit)}`);
        assert.equal(blankCanvasHit.insideFrame, false, `Blank canvas point must not hit a frame: ${JSON.stringify(blankCanvasHit)}`);
        assert.equal(blankCanvasHit.insideProductCard, false, `Blank canvas point must not hit a product card: ${JSON.stringify(blankCanvasHit)}`);
        await clickAt({ x: 900, y: 700 });
        await until('SelectionTools removed after clicking blank canvas', () => evaluate(`!document.querySelector('select[aria-label="Containing frame"]')`));
        assert.equal(await evaluate(`!!document.querySelector('select[aria-label="Containing frame"]')`), false,
            'A native blank-canvas click clears the outside-child selection tools');

        const dragOrigin = { x: resizedOuter.x + resizedOuter.width - 10, y: resizedOuter.y + 5 };
        const movedTo = { x: dragOrigin.x + 20, y: dragOrigin.y + 15 };
        const outerDragHit = await evaluate(`(() => {
            const hit = document.elementFromPoint(${JSON.stringify(dragOrigin.x)}, ${JSON.stringify(dragOrigin.y)});
            const frame = hit?.closest('[data-frame-id]');
            return {
                point: { x: ${JSON.stringify(dragOrigin.x)}, y: ${JSON.stringify(dragOrigin.y)} },
                tag: hit?.tagName ?? null,
                frameId: frame?.getAttribute('data-frame-id') ?? null,
                insideProductCard: !!hit?.closest('[data-product-card]'),
                insideEditorOverlay: !!hit?.closest('[data-editor-overlay]'),
            };
        })()`);
        t.diagnostic(`Outer frame drag hit: ${JSON.stringify(outerDragHit)}`);
        assert.equal(outerDragHit.frameId, outerId,
            `The existing outer drag origin must hit the expected frame: ${JSON.stringify(outerDragHit)}`);
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
        const previousTimeOrigin = await evaluate('performance.timeOrigin');
        await page('Page.reload', { ignoreCache: true });
        await until('nested frame geometry and names after reload', async () => {
            const current = await readDocument();
            const renderedFrames = await evaluate(`(() => {
                if (performance.timeOrigin === ${JSON.stringify(previousTimeOrigin)}) return false;
                const layers = document.querySelector('[data-board-layers]');
                if (!layers) return false;
                const frames = Array.from(layers.querySelectorAll('[data-frame-id]'));
                return [
                    [${JSON.stringify(outerId)}, 'Outer frame'],
                    [${JSON.stringify(innerId)}, 'Inner frame'],
                ].every(([id, name]) => frames.some(frame =>
                    frame.getAttribute('data-frame-id') === id && frame.getAttribute('data-frame-name') === name
                ));
            })()`);
            return renderedFrames && current.layers[childId]?.x === resizedChild.x + 20 && current.layers[childId]?.parentId === innerId &&
                current.layers[innerId]?.parentId === outerId && current.layers[outerId]?.name === 'Outer frame' &&
                current.layers[innerId]?.name === 'Inner frame';
        });
        assert.deepEqual(await evaluate(`Array.from(document.querySelector('[data-board-layers]').children).slice(0, 2).map(node => node.getAttribute('data-frame-name'))`),
            ['Outer frame', 'Inner frame'], 'Reload keeps ancestor-first frame paint order');

        for (const viewport of [{ width: 1280, height: 900, label: 'wide' }, { width: 390, height: 844, label: 'narrow' }]) {
            await page('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
            if (viewport.label === 'narrow') {
                await page('Input.dispatchMouseEvent', {
                    type: 'mouseWheel', x: viewport.width / 2, y: viewport.height / 2,
                    deltaX: 350, deltaY: 0, modifiers: 0,
                });
                assert.equal(await evaluate('Number(document.querySelector("[data-zoom-level]")?.getAttribute("data-zoom-level"))'), 1,
                    'Narrow screenshot keeps readable 100% zoom while panning the board');
            }
            const framing = await evaluate(`(() => {
                const frameRects = Array.from(document.querySelectorAll('[data-board-layers] [data-frame-id]'))
                    .map(node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }; });
                const child = Array.from(document.querySelectorAll('[data-board-layers] rect'))
                    .find(node => node.getAttribute('width') === '100' && node.getAttribute('height') === '100');
                if (!child) return false;
                const rect = child.getBoundingClientRect();
                return { frameRects, child: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, width: innerWidth, height: innerHeight };
            })()`);
            assert.ok(framing && framing.frameRects.length === 2, `${viewport.label} screenshot includes both frames`);
            for (const rect of [...framing.frameRects, framing.child]) {
                assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= framing.width && rect.bottom <= framing.height,
                    `${viewport.label} camera framing keeps frames and outside child visible: ${JSON.stringify(rect)}`);
            }
            const screenshot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            const screenshotBytes = Buffer.from(screenshot.data, 'base64');
            assert.deepEqual(screenshotBytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            const filename = `frames-${viewport.label}.png`;
            await writeFile(join(screenshotDirectory, filename), screenshotBytes);
            t.diagnostic(`Frame screenshot: ${join(screenshotDirectory, filename)}`);
        }
        await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await click('button[aria-label="Reset camera"]');
        await until('camera reset to 100% before image zoom assertions', () => evaluate('Number(document.querySelector("[data-zoom-level]")?.getAttribute("data-zoom-level")) === 1'));
        assert.equal(await evaluate('Number(document.querySelector("[data-zoom-level]")?.getAttribute("data-zoom-level"))'), 1,
            'The image request step starts from the default camera zoom');
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
        const cycle = { schemaVersion: 5, layerIds: ['a'], layers: { a: { type: 7, x: 0, y: 0, width: 1, height: 1, name: 'Cycle', parentId: 'a' } } };
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
