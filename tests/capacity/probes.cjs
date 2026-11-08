// In-page probes for the capacity measurement. Each returns numbers measured inside the page.
const { setTimeout: delay } = require('node:timers/promises');

/** Layer elements rendered on the board, in old and new markup. */
const RENDERED_LAYERS = `(() => {
    const group = document.querySelector('[data-board-layers]');
    if (group) return group.childElementCount;
    const svg = Array.from(document.querySelectorAll('svg')).find(svg => svg.classList.contains('h-[100vh]'));
    const camera = svg && svg.querySelector(':scope > g');
    return camera ? camera.childElementCount - 1 : 0;
})()`;

const nextFrames = 'new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))';

/** Records every animation frame until __stopFrames() resolves with frame-time statistics. */
const START_FRAMES = `(() => {
    const times = []; let running = true;
    const tick = time => { times.push(time); if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__stopFrames = () => new Promise(done => requestAnimationFrame(() => {
        running = false;
        const deltas = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
        const pick = q => deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(q * deltas.length))] : null;
        done({ frames: deltas.length, p95: pick(0.95), max: deltas.at(-1) ?? null });
    }));
    return true;
})()`;

/** Counts PATCH requests and body sizes made by the board store. Installed before page scripts run. */
const PATCH_RECORDER = `(() => {
    const original = window.fetch;
    window.__patches = [];
    window.fetch = (input, init) => {
        if (init && init.method === 'PATCH') window.__patches.push(typeof init.body === 'string' ? init.body.length : 0);
        return original(input, init);
    };
})()`;

const round = value => value == null ? null : Math.round(value * 10) / 10;

async function waitRendered(session, count) {
    return session.evaluate(`new Promise(done => {
        const check = () => ${RENDERED_LAYERS} >= ${count} ? requestAnimationFrame(() => done(performance.now())) : requestAnimationFrame(check);
        check();
    })`);
}

async function waitSaved(session, timeout = 120000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await session.evaluate('document.querySelector("[role=status]")?.textContent === "Saved"')) return true;
        await delay(50);
    }
    throw new Error('Timed out waiting for Saved');
}

/** Dispatches a keydown inside the page; returns synchronous handler time and time to the next painted frame. */
async function timedKey(session, init) {
    return session.evaluate(`(async () => {
        const start = performance.now();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...${JSON.stringify(init)} }));
        const sync = performance.now() - start;
        await ${nextFrames};
        return { sync, frame: performance.now() - start };
    })()`);
}

/** Wheel gestures 16 ms apart; returns frame statistics while they are handled. */
async function pan(session, point, steps = 30) {
    await session.evaluate(START_FRAMES);
    for (let i = 0; i < steps; i++) {
        const direction = i < steps / 2 ? 1 : -1;
        await session.mouse('mouseWheel', point, { deltaX: 40 * direction, deltaY: 60 * direction });
        await delay(16);
    }
    return session.evaluate('window.__stopFrames()');
}

/** Presses on `from`, moves in `steps` pointer events and releases; returns frame statistics. */
async function drag(session, from, steps = 20, stepSize = 4) {
    await session.evaluate(START_FRAMES);
    await session.mouse('mouseMoved', from);
    await session.mouse('mousePressed', from, { button: 'left', buttons: 1, clickCount: 1 });
    let point = from;
    for (let i = 0; i < steps; i++) {
        point = { x: point.x + stepSize, y: point.y };
        await session.mouse('mouseMoved', point, { button: 'left', buttons: 1 });
    }
    await session.mouse('mouseReleased', point, { button: 'left', buttons: 0, clickCount: 1 });
    return session.evaluate('window.__stopFrames()');
}

/** Clicks the zoom buttons until the editor reports `target`; returns time from the last click to a painted frame. */
async function zoomTo(session, target) {
    let elapsed = 0;
    for (let i = 0; i < 20; i++) {
        const current = await session.evaluate('Number(document.querySelector("[data-zoom-level]")?.dataset.zoomLevel)');
        if (current === target) return elapsed;
        const label = current < target ? 'Zoom in' : 'Zoom out';
        const start = await session.evaluate('performance.now()');
        await session.click(`button[aria-label="${label}"]`);
        elapsed = (await session.evaluate(`${nextFrames}.then(() => performance.now())`)) - start;
    }
    throw new Error(`Zoom ${target} not reached`);
}

module.exports = { RENDERED_LAYERS, PATCH_RECORDER, round, waitRendered, waitSaved, timedKey, pan, drag, zoomTo };
