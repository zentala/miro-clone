// Real browser acceptance using only Node builtins and installed Chromium.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, mkdir, readFile, rm, stat } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { createServer } = require('node:net');
const { EventEmitter } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { DatabaseSync } = require('node:sqlite');

const root = resolve(__dirname, '..');
const deadline = 15000;
async function until(description, predicate, timeout = deadline) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        last = await predicate();
        if (last) return last;
        await delay(75);
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
function child(command, args, options) {
    const process = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const record = { process, log: '', error: null, closed: false };
    process.once('error', error => { record.error = error; });
    process.once('close', () => { record.closed = true; });
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
class CDP extends EventEmitter {
    constructor(socket) {
        super(); this.socket = socket; this.pending = new Map(); this.id = 0;
        socket.addEventListener('message', ({ data }) => {
            const message = JSON.parse(data);
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                clearTimeout(pending.timer); this.pending.delete(message.id);
                if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
                else pending.resolve(message.result);
            } else this.emit(message.method, message.params, message.sessionId);
        });
        socket.addEventListener('close', () => {
            for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('CDP connection closed')); }
            this.pending.clear();
        });
    }
    static async connect(url) {
        const socket = new WebSocket(url);
        await new Promise((done, reject) => {
            const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timeout')); }, deadline);
            socket.addEventListener('open', () => { clearTimeout(timer); done(); }, { once: true });
            socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, { once: true });
        });
        return new CDP(socket);
    }
    call(method, params = {}, sessionId) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, deadline);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
    }
    close() { this.socket.close(); }
}

test('critical editor: UI create, pointer draw, undo, redo, PNG export, durable reload/restart', { timeout: 120000 }, async t => {
    const owned = await mkdtemp(join(tmpdir(), 'miro-critical-'));
    const databasePath = join(owned, 'synthetic.sqlite');
    const profile = join(owned, 'chromium-profile');
    const downloads = join(owned, 'downloads');
    await mkdir(profile); await mkdir(downloads);
    const processes = [];
    let cdp;
    t.after(async () => {
        if (cdp) cdp.close();
        // Reverse creation order; never enumerate or terminate unrelated processes.
        for (const record of [...processes].reverse()) await stop(record);
        await rm(owned, { recursive: true, force: true });
        assert.ok(processes.every(record => record.closed), 'All owned child processes must exit');
        await assert.rejects(() => stat(owned), { code: 'ENOENT' });
        t.diagnostic('Cleanup complete: owned Next/Chromium exited; temporary SQLite, profile and downloads removed');
    });
    const port = await unusedPort();
    const origin = `http://127.0.0.1:${port}`;
    async function startApp() {
        const record = child(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', root, '--hostname', '127.0.0.1', '--port', String(port)], {
            cwd: root,
            env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', MIRO_SQLITE_PATH: databasePath },
        });
        processes.push(record);
        await until('isolated application readiness', async () => {
            if (record.error || record.closed) throw new Error(`Application failed: ${record.error || record.log}`);
            try { return (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
        });
        return record;
    }
    let app = await startApp();
    const foreignCreate = await fetch(`${origin}/api/boards`, {
        method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Must not be created' }), signal: AbortSignal.timeout(deadline),
    });
    assert.equal(foreignCreate.status, 403, 'Foreign origins must remain rejected');
    const chromium = child('/usr/bin/chromium-browser', [
        '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-extensions', '--disable-component-update',
        '--disable-sync', '--disable-default-apps', '--window-size=1280,900', 'about:blank',
    ], { cwd: owned, env: {
        ...process.env,
        XDG_DATA_HOME: join(owned, 'xdg-data'),
        XDG_CONFIG_HOME: join(owned, 'xdg-config'),
        XDG_CACHE_HOME: join(owned, 'xdg-cache'),
    } });
    processes.push(chromium);
    const devtools = await until('owned Chromium debugging endpoint', async () => {
        if (chromium.error || chromium.closed) throw new Error(`Chromium failed: ${chromium.error || chromium.log}`);
        try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); } catch { return false; }
    });
    cdp = await CDP.connect(`ws://127.0.0.1:${devtools[0]}${devtools[1]}`);
    const { targetId } = await cdp.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => cdp.call(method, params, sessionId);
    const exceptions = [], networkFailures = [], completedDownloads = new Set(), begunDownloads = [];
    cdp.on('Runtime.exceptionThrown', (event, session) => { if (session === sessionId) exceptions.push(event.exceptionDetails.text + ': ' + (event.exceptionDetails.exception?.description || '')); });
    cdp.on('Network.loadingFailed', (event, session) => { if (session === sessionId && !event.canceled) networkFailures.push(event.errorText); });
    cdp.on('Browser.downloadWillBegin', event => begunDownloads.push(event));
    cdp.on('Browser.downloadProgress', event => { if (event.state === 'completed') completedDownloads.add(event.guid); });
    await page('Page.enable'); await page('Runtime.enable'); await page('Network.enable');
    await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloads, eventsEnabled: true });
    async function evaluate(expression) {
        const result = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    async function click(selector) {
        const point = await until(`clickable ${selector}`, () => evaluate(`(() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element || element.disabled) return false;
            const bounds = element.getBoundingClientRect();
            return bounds.width && bounds.height ? {x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2} : false;
        })()`));
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    }
    // Class-independent query: the drawing SVG owns the input handlers and full viewport.
    const renderedStroke = () => evaluate('Array.from(document.querySelectorAll("svg")).find(svg => svg.classList.contains("h-[100vh]"))?.querySelector("path")?.getAttribute("d") || ""');
    const saved = () => until('visible Saved status', () => evaluate('document.querySelector("[role=status]")?.textContent === "Saved"'));
    let boardUrl, originalStroke, originalDocument;
    let flowFailed = false;
    async function step(name, run) {
        return t.test(name, { skip: flowFailed ? 'Earlier prerequisite failed' : false }, async () => {
            try { await run(); }
            catch (error) {
                flowFailed = true;
                const state = await evaluate('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,2000)})').catch(() => 'Page unavailable');
                throw new Error(`${error.message}\nPage: ${state}\nBrowser exceptions: ${JSON.stringify(exceptions)}\nServer: ${app.log}`, { cause: error });
            }
        });
    }

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
        assert.deepEqual(boards[0].document, { layers: {}, layerIds: [] });
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
        assert.deepEqual(board.document, { layerIds: [], layers: {} });
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
        await stop(app);
        app = await startApp();
        await page('Page.reload', { ignoreCache: true });
        await until('same stroke after server restart', async () => (await renderedStroke()) === originalStroke);
        await saved();
        assert.equal(await evaluate('location.href'), boardUrl);
        assert.ok(await evaluate('document.body.textContent.includes("Untitled board")'));
        const board = await (await fetch(boardUrl.replace('/board/', '/api/boards/'))).json();
        assert.deepEqual(board.document, originalDocument);
    });
    assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(networkFailures, [], 'No failed browser requests');
});
