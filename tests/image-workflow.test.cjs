// Synthetic image workflow boundary checks; no user clipboard or browser profile.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { Transformer } = require('@napi-rs/image');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

const root = resolve(__dirname, '..');
const owned = mkdtempSync(join(tmpdir(), 'miro-image-workflow-'));
try {
    const source = readFileSync(join(root, 'lib/same-origin.ts'), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const modulePath = join(owned, 'same-origin.js');
    mkdirSync(dirname(modulePath), { recursive: true });
    writeFileSync(modulePath, outputText);
    const { isForeignOrigin } = require(modulePath);

    test('shared mutation guard compares Origin against request protocol and incoming Host', () => {
        const make = (url, headers) => new Request(url, { method: 'POST', headers });
        assert.equal(isForeignOrigin(make('http://localhost:4100/api/boards', {
            host: '127.0.0.1:4100', origin: 'http://127.0.0.1:4100',
            'x-forwarded-host': 'attacker.example',
        })), false);
        assert.equal(isForeignOrigin(make('https://board.example/api/boards', {
            host: 'board.example', origin: 'https://evil.example',
            forwarded: 'host=evil.example;proto=https',
        })), true);
        assert.equal(isForeignOrigin(make('ftp://board.example/api/boards', {
            host: 'board.example', origin: 'ftp://board.example',
        })), true);
        assert.equal(isForeignOrigin(make('http://board.example/api/boards', { host: 'board.example' })), false);
    });
} finally {
    rmSync(owned, { recursive: true, force: true });
}

function generatedPng(width, height, leftColor, rightColor) {
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        pixels.set(x < width / 2 ? leftColor : rightColor, (y * width + x) * 4);
    }
    return Transformer.fromRgbaPixels(pixels, width, height).png();
}

test('image layers: upload, clipboard, editing, history, persistence and export pixels', { timeout: 180000 }, async t => {
    const context = await createCriticalEditor(t);
    const { step, page, origin, evaluate, click, until, saved, databasePath, downloads, deadline } = context;
    const boardId = async () => evaluate('location.pathname.split("/").pop()');
    const board = async () => (await fetch(`${origin}/api/boards/${await boardId()}`, { signal: AbortSignal.timeout(deadline) })).json();
    const storedDocument = () => {
        const db = new DatabaseSync(databasePath, { readOnly: true });
        try { return JSON.parse(db.prepare('SELECT document FROM boards').get().document); }
        finally { db.close(); }
    };
    const imageRects = () => evaluate(`Array.from(document.querySelectorAll('[data-image-layer] image')).map(image => {
        const box=image.getBoundingClientRect(); return {x:box.x,y:box.y,width:box.width,height:box.height};
    })`);
    const waitForImages = count => until(`${count} rendered image layers`, async () => {
        const images = await imageRects(); return images.length === count ? images : false;
    });
    async function uploadFile(path) {
        await click('button[aria-label="Add image"]');
        await page('DOM.enable');
        const { root: { nodeId } } = await page('DOM.getDocument');
        const input = await page('DOM.querySelector', { nodeId, selector: 'input[aria-label="Choose image file"]' });
        assert.ok(input.nodeId, 'The image file input is available');
        await page('DOM.setFileInputFiles', { files: [path], nodeId: input.nodeId });
    }
    async function drag(from, to) {
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...to, button: 'left', buttons: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', buttons: 0, clickCount: 1 });
    }
    async function dragThrough(from, points) {
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, clickCount: 1 });
        for (const point of points) await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1 });
        const to = points[points.length - 1];
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', buttons: 0, clickCount: 1 });
    }
    async function key(key, modifiers) {
        const code = `Key${key.toUpperCase()}`;
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', {
            type, key, code, modifiers, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0),
        });
    }

    await step('create an isolated board through the UI', async () => {
        await page('Page.navigate', { url: origin });
        await until('hydrated dashboard', () => evaluate('document.querySelector("h1")?.textContent === "Boards" && !document.body.textContent.includes("Loading boards")'));
        await click('button');
        await until('new board editor', () => evaluate(`location.pathname.startsWith('/board/') && !!document.querySelector('[aria-label="Add image"]')`));
    });

    const uploadedBytes = await generatedPng(200, 100, [230, 30, 45, 255], [20, 80, 220, 255]);
    const uploadPath = join(downloads, 'generated-upload.png');
    writeFileSync(uploadPath, uploadedBytes);
    let initialAssetId;
    await step('file upload stores original bytes and creates an editable image with its native ratio', async () => {
        await uploadFile(uploadPath);
        const [rendered] = await waitForImages(1);
        await saved();
        assert.equal(rendered.width / rendered.height, 2);
        const current = await board();
        const layer = current.document.layers[current.document.layerIds[0]];
        assert.equal(layer.type, 5);
        assert.equal(layer.width / layer.height, 2);
        initialAssetId = layer.assetId;
        const path = join(dirname(databasePath), 'assets', layer.assetId.slice(0, 2), layer.assetId);
        assert.deepEqual(readFileSync(path), uploadedBytes, 'The asset store keeps the exact uploaded original');
        const served = await fetch(`${origin}/api/assets/${layer.assetId}`, { signal: AbortSignal.timeout(deadline) });
        assert.equal(served.status, 200);
        assert.equal(served.headers.get('content-type'), 'image/png');
        assert.deepEqual(Buffer.from(await served.arrayBuffer()), uploadedBytes);
        assert.deepEqual(storedDocument(), current.document, 'SQLite stores the durable image reference');
        const screenshot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(__dirname, 'capacity', 't05-visual-review-wide.png'), Buffer.from(screenshot.data, 'base64'));
    });

    await step('PNG export decodes with both generated image colors', async () => {
        await click('button:has(svg.lucide-image-down)');
        const download = await until('completed PNG export', () => context.begunDownloads.find(item => context.completedDownloads.has(item.guid)));
        const png = readFileSync(join(downloads, download.guid));
        const colors = await evaluate(`(async () => {
            const image=new Image(); image.src='data:image/png;base64,${png.toString('base64')}'; await image.decode();
            const canvas=document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
            const context=canvas.getContext('2d'); context.drawImage(image,0,0);
            const data=context.getImageData(0,0,canvas.width,canvas.height).data; const found=new Set();
            for(let i=0;i<data.length;i+=4) if(data[i+3]===255 && ((data[i]===230 && data[i+1]===30 && data[i+2]===45) || (data[i]===20 && data[i+1]===80 && data[i+2]===220))) found.add([data[i],data[i+1],data[i+2]].join(','));
            return [...found];
        })()`);
        assert.deepEqual(colors.sort(), ['20,80,220', '230,30,45']);
    });

    await step('pointer drag and corner handle resize preserve 2:1 geometry and history', async () => {
        const before = (await waitForImages(1))[0];
        await drag({ x: before.x + 10, y: before.y + 10 }, { x: before.x + 90, y: before.y + 50 });
        await saved();
        const moved = (await waitForImages(1))[0];
        assert.equal(moved.x - before.x, 80);
        assert.equal(moved.y - before.y, 40);

        const handle = await evaluate(`(() => { const box=document.querySelectorAll('[data-editor-overlay] rect')[5].getBoundingClientRect(); return {x:box.x+box.width/2,y:box.y+box.height/2}; })()`);
        await drag(handle, { x: handle.x + 100, y: handle.y + 50 });
        await saved();
        const resized = (await waitForImages(1))[0];
        assert.equal(resized.width, 300);
        assert.equal(resized.height, 150);
        let current = await board();
        let layer = current.document.layers[current.document.layerIds[0]];
        assert.equal(layer.assetId, initialAssetId);
        assert.equal(layer.width / layer.height, 2);

        await key('z', 2);
        await until('undo restores pre-resize bounds', async () => {
            const doc = (await board()).document; const item = doc.layers[doc.layerIds[0]];
            return item.width === 200 && item.height === 100;
        });
        await saved();
        await key('z', 10);
        await until('redo restores resized bounds', async () => {
            const doc = (await board()).document; const item = doc.layers[doc.layerIds[0]];
            return item.width === 300 && item.height === 150 && item.assetId === initialAssetId;
        });
        await saved();
    });

    await step('image resize stays positive through collapse and anchor crossing, then can resize again', async () => {
        const initial = await board();
        const layerId = initial.document.layerIds[0];
        const initialLayer = initial.document.layers[layerId];
        const anchor = { x: initialLayer.x, y: initialLayer.y };
        const bottomRight = () => evaluate(`(() => { const r=document.querySelectorAll('[data-editor-overlay] rect')[5].getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);

        await dragThrough(await bottomRight(), [anchor]);
        await saved();
        let current = await board();
        let layer = current.document.layers[layerId];
        assert.ok(Number.isFinite(layer.width) && layer.width > 0);
        assert.ok(Number.isFinite(layer.height) && layer.height > 0);
        assert.ok(Math.abs(layer.width / layer.height - 2) < 0.001);
        assert.equal(layer.assetId, initialAssetId);

        await drag(await bottomRight(), { x: anchor.x - 20, y: anchor.y - 10 });
        await saved();
        current = await board();
        layer = current.document.layers[layerId];
        assert.ok(Number.isFinite(layer.width) && layer.width > 0);
        assert.ok(Number.isFinite(layer.height) && layer.height > 0);
        assert.ok(Math.abs(layer.width / layer.height - 2) < 0.001);
        assert.ok(layer.x < anchor.x && layer.y < anchor.y, 'The resized image crosses to the other side of its anchor');
        assert.equal(layer.assetId, initialAssetId);

        const crossed = { ...layer };
        await drag(await bottomRight(), { x: crossed.x + crossed.width + 60, y: crossed.y + crossed.height + 30 });
        await saved();
        current = await board();
        layer = current.document.layers[layerId];
        assert.ok(Number.isFinite(layer.x) && Number.isFinite(layer.y));
        assert.ok(Number.isFinite(layer.width) && layer.width > 0);
        assert.ok(Number.isFinite(layer.height) && layer.height > 0);
        assert.ok(Math.abs(layer.width / layer.height - 2) < 0.001);
        assert.ok(layer.width > crossed.width && layer.height > crossed.height);
        assert.equal(layer.assetId, initialAssetId);
    });

    await step('duplicate, delete, two undos and redo retain the asset reference through reload', async () => {
        await click('button:has(svg.lucide-copy)');
        await waitForImages(2);
        await saved();
        let current = await board();
        assert.equal(current.document.layerIds.length, 2);
        assert.ok(current.document.layerIds.every(id => current.document.layers[id].assetId === initialAssetId));

        await click('button:has(svg.lucide-trash2)');
        await waitForImages(1);
        await saved();
        await key('z', 2);
        await waitForImages(2);
        await saved();
        await key('z', 10);
        await waitForImages(1);
        await saved();
        await key('z', 2);
        await waitForImages(2);
        await saved();
        await key('z', 2);
        await waitForImages(1);
        await saved();

        const expected = await board();
        await page('Page.reload', { ignoreCache: true });
        await until('saved board after reload', () => evaluate('location.pathname.startsWith("/board/") && document.querySelector("[role=status]")?.textContent === "Saved"'));
        await waitForImages(1);
        current = await board();
        assert.deepEqual(current.document, expected.document);
        assert.deepEqual(storedDocument(), expected.document);
        assert.ok(current.document.layerIds.every(id => current.document.layers[id].assetId === initialAssetId));
    });

    const pastedBytes = await generatedPng(20, 10, [20, 190, 80, 255], [250, 210, 20, 255]);
    await step('synthetic clipboard paste imports and stores its original without reading the OS clipboard', async () => {
        const prevented = await evaluate(`(() => {
            const raw=atob(${JSON.stringify(pastedBytes.toString('base64'))});
            const bytes=Uint8Array.from(raw, character=>character.charCodeAt(0));
            const transfer=new DataTransfer(); transfer.items.add(new File([bytes], 'generated-clipboard.png', {type:'image/png'}));
            const event=new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true});
            document.body.dispatchEvent(event); return event.defaultPrevented;
        })()`);
        assert.equal(prevented, true);
        await waitForImages(2);
        await saved();
        const current = await board();
        const pastedLayer = current.document.layers[current.document.layerIds[1]];
        assert.equal(pastedLayer.type, 5);
        assert.equal(pastedLayer.width / pastedLayer.height, 2);
        assert.deepEqual(readFileSync(join(dirname(databasePath), 'assets', pastedLayer.assetId.slice(0, 2), pastedLayer.assetId)), pastedBytes);
    });

    await step('invalid upload shows an error and creates no layer or dangling asset reference', async () => {
        const invalidPath = join(downloads, 'generated-invalid.png');
        writeFileSync(invalidPath, Buffer.from('not an image'));
        await uploadFile(invalidPath);
        await until('visible invalid-image reason', () => evaluate('!!document.querySelector("[role=alert]")?.textContent'));
        const current = await board();
        assert.equal(current.document.layerIds.length, 2);
        assert.equal(storedDocument().layerIds.length, 2);
        const report = await (await fetch(`${origin}/api/assets`)).json();
        assert.deepEqual(report.danglingReferences, []);
    });

    await step('narrow viewport keeps the selected image and nearby editor controls visible', async () => {
        await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
        await evaluate('new Promise(resolve => requestAnimationFrame(() => resolve(true)))');
        await page('Page.navigate', { url: origin });
        await until('narrow dashboard', () => evaluate('document.querySelector("h1")?.textContent === "Boards" && !document.body.textContent.includes("Loading boards")'));
        await click('button');
        await until('narrow board editor', () => evaluate(`location.pathname.startsWith('/board/') && !!document.querySelector('[aria-label="Add image"]')`));
        await uploadFile(uploadPath);
        await waitForImages(1);
        await saved();
        const layout = await evaluate(`(() => {
            const box=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
            const children=Array.from(document.querySelector('main').children);
            const find=(...parts)=>children.find(element=>parts.every(part=>String(element.className).includes(part)));
            const image=box(document.querySelector('[data-image-layer] image'));
            const selection=box(find('p-3','rounded-xl'));
            const left=box(find('top-[50%]','left-2'));
            const header=box(find('top-2','left-2'));
            const zoom=box(find('bottom-2','right-2'));
            const overlaps=(a,b)=>a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            return {viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},
                image,selection,left,header,zoom,
                overlaps:{imageSelection:overlaps(image,selection),selectionLeftToolbar:overlaps(selection,left),selectionHeader:overlaps(selection,header),selectionZoom:overlaps(selection,zoom)},
                handles:document.querySelectorAll('[data-editor-overlay] rect').length};
        })()`);
        t.diagnostic(`390x844 image layout: ${JSON.stringify(layout)}`);
        const screenshot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(__dirname, 'capacity', 't05-visual-review-narrow.png'), Buffer.from(screenshot.data, 'base64'));
        assert.equal(layout.viewport.width, 390);
        assert.ok(layout.viewport.scrollWidth <= 390, JSON.stringify(layout));
        assert.ok(layout.image.left >= 0 && layout.image.right <= 390 && layout.image.top >= 0 && layout.image.bottom <= 844, JSON.stringify(layout.image));
        assert.ok(layout.selection.left >= 0 && layout.selection.right <= 390, JSON.stringify(layout.selection));
        assert.ok(layout.left.left >= 0 && layout.left.right <= 390);
        assert.ok(layout.header.left >= 0 && layout.header.right <= 390);
        assert.ok(layout.zoom.left >= 0 && layout.zoom.right <= 390);
        assert.equal(layout.handles, 9);
        assert.equal(layout.image.width / layout.image.height, 2);
    });

    assert.deepEqual(context.exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(context.networkFailures, [], 'No failed browser requests');
});
