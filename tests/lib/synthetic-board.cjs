// Deterministic synthetic boards for capacity tests. No real board data is read or copied.
// Uses only today's five layer types; images, cards, frames, code and tables do not exist yet.
const { DatabaseSync } = require('node:sqlite');

/** Small seeded PRNG (mulberry32) so every run builds the same board. */
function random(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Share of each layer type: notes 35 %, text 25 %, rectangles 15 %, ellipses 10 %, paths 15 %. */
const MIX = [[4, 0.35], [3, 0.6], [0, 0.75], [1, 0.85], [2, 1]];
const CELL = 160;
/** The first layer is always this rectangle, so tests can find, drag and resize it at zoom 1. */
const ANCHOR = { id: 'anchor', x: 200, y: 200, width: 100, height: 100 };

function stroke(next, width, height) {
    const count = 50 + Math.floor(next() * 150);
    const points = [];
    for (let i = 0; i < count; i++) {
        points.push([Math.round((i / (count - 1)) * width), Math.round(next() * height), 0.5]);
    }
    return points;
}

function layerAt(next, index, columns) {
    const fill = { r: Math.floor(next() * 256), g: Math.floor(next() * 256), b: Math.floor(next() * 256) };
    const x = 40 + (index % columns) * CELL, y = 360 + Math.floor(index / columns) * CELL;
    const roll = next();
    const type = MIX.find(([, limit]) => roll < limit)[0];
    const base = { type, x, y, width: 120, height: type === 3 ? 50 : 120, fill };
    if (type === 2) return { ...base, height: 60, points: stroke(next, 120, 60) };
    if (type === 3 || type === 4) return { ...base, value: `Synthetic ${type === 3 ? 'text' : 'note'} ${index}` };
    return base;
}

/** Builds a schema v2 document with `count` layers laid out on a square grid. */
function generateDocument(count, seed = 7) {
    const next = random(seed + count);
    const columns = Math.ceil(Math.sqrt(count));
    const layers = { [ANCHOR.id]: { type: 0, x: ANCHOR.x, y: ANCHOR.y, width: ANCHOR.width, height: ANCHOR.height, fill: { r: 37, g: 99, b: 235 } } };
    const layerIds = [ANCHOR.id];
    for (let index = 1; index < count; index++) {
        const id = `layer-${index}`;
        layers[id] = layerAt(next, index, columns);
        layerIds.push(id);
    }
    return { schemaVersion: 2, layerIds, layers };
}

/** Inserts a board row straight into a disposable database, bypassing the API's limits. */
function insertBoard(databasePath, id, title, document) {
    const db = new DatabaseSync(databasePath);
    try {
        const now = Date.now();
        db.prepare('INSERT INTO boards VALUES (?, ?, ?, ?, ?)').run(id, title, now, now, JSON.stringify(document));
    } finally { db.close(); }
}

module.exports = { ANCHOR, generateDocument, insertBoard };
