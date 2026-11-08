// Shared browser harness: owned Next.js server, owned headless Chromium and a minimal CDP client.
// Node builtins only. Every process it starts is owned by the caller and must be passed to stop().
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { createServer } = require('node:net');
const { EventEmitter } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

const root = resolve(__dirname, '..', '..');
const deadline = 15000;
const VIRTUAL_KEYS = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Escape: 27 };

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
    constructor(socket, timeout) {
        super(); this.socket = socket; this.pending = new Map(); this.id = 0; this.timeout = timeout;
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
    static async connect(url, timeout = deadline) {
        const socket = new WebSocket(url);
        await new Promise((done, reject) => {
            const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timeout')); }, deadline);
            socket.addEventListener('open', () => { clearTimeout(timer); done(); }, { once: true });
            socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, { once: true });
        });
        return new CDP(socket, timeout);
    }
    call(method, params = {}, sessionId) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, this.timeout);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
    }
    close() { this.socket.close(); }
}

/** Starts the built app on loopback against a disposable SQLite file and waits until it answers. */
async function startApp({ port, databasePath, timeout = deadline }) {
    const record = child(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', root, '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: root,
        env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', MIRO_SQLITE_PATH: databasePath },
    });
    await until('isolated application readiness', async () => {
        if (record.error || record.closed) throw new Error(`Application failed: ${record.error || record.log}`);
        try { return (await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
    }, timeout);
    return record;
}

/** Starts headless Chromium with a disposable profile under `owned` and connects a CDP client. */
async function startChromium({ owned, profile, windowSize = '1280,900', timeout = deadline }) {
    const record = child('/usr/bin/chromium-browser', [
        '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-extensions', '--disable-component-update',
        '--disable-sync', '--disable-default-apps', `--window-size=${windowSize}`, 'about:blank',
    ], { cwd: owned, env: {
        ...process.env,
        XDG_DATA_HOME: join(owned, 'xdg-data'),
        XDG_CONFIG_HOME: join(owned, 'xdg-config'),
        XDG_CACHE_HOME: join(owned, 'xdg-cache'),
    } });
    const devtools = await until('owned Chromium debugging endpoint', async () => {
        if (record.error || record.closed) throw new Error(`Chromium failed: ${record.error || record.log}`);
        try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); } catch { return false; }
    });
    const cdp = await CDP.connect(`ws://127.0.0.1:${devtools[0]}${devtools[1]}`, timeout);
    return { record, cdp };
}

/** Opens one page target and returns helpers bound to its session. */
async function openPage(cdp) {
    const { targetId } = await cdp.call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.call('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => cdp.call(method, params, sessionId);
    async function evaluate(expression) {
        const result = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    const mouse = (type, point, extra = {}) => page('Input.dispatchMouseEvent', { type, ...point, ...extra });
    async function clickAt(point) {
        await mouse('mouseMoved', point);
        await mouse('mousePressed', point, { button: 'left', buttons: 1, clickCount: 1 });
        await mouse('mouseReleased', point, { button: 'left', buttons: 0, clickCount: 1 });
    }
    async function click(selector) {
        const point = await until(`clickable ${selector}`, () => evaluate(`(() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element || element.disabled) return false;
            const bounds = element.getBoundingClientRect();
            return bounds.width && bounds.height ? {x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2} : false;
        })()`));
        await clickAt(point);
    }
    /** modifiers: CDP bit field (Ctrl = 2, Shift = 8). */
    async function key(keyName, modifiers = 0) {
        const code = keyName.length === 1 ? `Key${keyName.toUpperCase()}` : keyName;
        const windowsVirtualKeyCode = VIRTUAL_KEYS[keyName] ?? keyName.toUpperCase().charCodeAt(0);
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', { type, key: keyName, code, modifiers, windowsVirtualKeyCode });
    }
    return { targetId, sessionId, page, evaluate, mouse, click, clickAt, key };
}

module.exports = { root, deadline, until, unusedPort, child, stop, CDP, startApp, startChromium, openPage };
