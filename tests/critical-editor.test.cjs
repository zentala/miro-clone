// The entrypoint shares browser setup with the split workflow helper.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { isDeepStrictEqual } = require('node:util');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

test('critical editor: UI create, pointer draw, undo, redo, PNG export, durable reload/restart', { timeout: 120000 }, async t => {
    const context = await createCriticalEditor(t);
    const { step, page, origin, evaluate, click, until, renderedStroke, saved, databasePath, downloads, begunDownloads, completedDownloads, deadline, exceptions, networkFailures } = context;
    let boardUrl, originalStroke, originalDocument;
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
        assert.deepEqual(boards[0].document, { schemaVersion: 2, layers: {}, layerIds: [] });
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
        assert.deepEqual(board.document, { schemaVersion: 2, layerIds: [], layers: {} });
    });
    await step('redo restores identical stroke geometry', async () => {
        await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
        await until('stroke restored by redo', async () => (await renderedStroke()) === originalStroke);
        await saved();
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        assert.deepEqual(board.document, originalDocument);
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
    await step('pre-version board with all five layer types opens, edits, undoes and saves as v2', async () => {
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
        await until('keyboard move saved as v2', () => {
            const document = JSON.parse(read().document);
            return document.schemaVersion === 2 && document.layers['rect-1'].x === 405;
        });
        await click('button[aria-label="Undo (Ctrl+Z)"]');
        const expected = { schemaVersion: 2, ...fixture };
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
        assert.deepEqual(await request('future', 'GET'), { status: 409, body: { error: 'Document schema version 99 is newer than supported version 2', code: 'unsupported-version' } });
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
        assert.deepEqual((await (await fetch(`${origin}/api/boards/${board.id}`)).json()).document, document);
        const report = await (await fetch(`${origin}/api/assets`)).json();
        assert.deepEqual(report, { referenced: [{ id: asset.id, boards: [board.id] }], unused: [], missing: [], unregistered: [], deletable: [], danglingReferences: [], unscannedBoards: [] });
        const decoded = await evaluate(`(async () => { const image = new Image(); image.src = '/api/assets/${asset.id}'; await image.decode(); return [image.naturalWidth, image.naturalHeight]; })()`);
        assert.deepEqual(decoded, [30, 20], 'The browser decodes the served original');
    });
    assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(networkFailures, [], 'No failed browser requests');
});
