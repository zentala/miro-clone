const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const Module = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const { Transformer } = require('@napi-rs/image');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

const root = resolve(__dirname, '..');

function loadTypeScript(path, mocks = {}) {
    const source = readFileSync(path, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loaded = new Module(path, module);
    loaded.filename = path;
    loaded.paths = Module._nodeModulePaths(dirname(path));
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (parent?.filename === path && Object.hasOwn(mocks, request)) return mocks[request];
        return originalLoad.call(this, request, parent, isMain);
    };
    try { loaded._compile(output, path); } finally { Module._load = originalLoad; }
    return loaded.exports;
}

function orientedJpeg() {
    const pixels = Buffer.alloc(200 * 100 * 4);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) {
        pixels.set(x < 100 ? [230, 30, 45, 255] : [20, 80, 220, 255], (y * 200 + x) * 4);
    }
    return Transformer.fromRgbaPixels(pixels, 200, 100).jpeg(90).then(jpeg => {
        const tiff = Buffer.alloc(26);
        tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4); tiff.writeUInt16LE(1, 8);
        tiff.writeUInt16LE(0x112, 10); tiff.writeUInt16LE(3, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt16LE(6, 18);
        const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
        const marker = Buffer.alloc(4); marker[0] = 255; marker[1] = 225; marker.writeUInt16BE(payload.length + 2, 2);
        return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
    });
}

function seededPixels(width, height, seed) {
    const pixels = Buffer.allocUnsafe(width * height * 4);
    let state = seed >>> 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        pixels[offset] = state & 0xff;
        pixels[offset + 1] = state >>> 8 & 0xff;
        pixels[offset + 2] = state >>> 16 & 0xff;
        pixels[offset + 3] = 255;
    }
    return pixels;
}

function fixtureImageBytes(bytes, mediaType, index) {
    const label = Buffer.from(`t06-fixture-${String(index).padStart(4, '0')}`);
    if (mediaType === 'image/jpeg') {
        const comment = Buffer.alloc(label.length + 4);
        comment[0] = 0xff; comment[1] = 0xfe;
        comment.writeUInt16BE(label.length + 2, 2);
        label.copy(comment, 4);
        return Buffer.concat([bytes.subarray(0, 2), comment, bytes.subarray(2)]);
    }
    if (mediaType === 'image/webp') {
        const metadata = Buffer.alloc(label.length + 8 + (label.length % 2));
        metadata.write('XMP ', 0, 'ascii');
        metadata.writeUInt32LE(label.length, 4);
        label.copy(metadata, 8);
        const output = Buffer.concat([bytes, metadata]);
        output.writeUInt32LE(output.length - 8, 4);
        return output;
    }
    const type = Buffer.from('tEXt');
    const text = Buffer.from(`Fixture\0${label.toString('ascii')}`);
    const payload = Buffer.concat([type, text]);
    let crc = 0xffffffff;
    for (const byte of payload) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const chunk = Buffer.alloc(payload.length + 8);
    chunk.writeUInt32BE(text.length, 0);
    payload.copy(chunk, 4);
    chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, payload.length + 4);
    return Buffer.concat([bytes.subarray(0, -12), chunk, bytes.subarray(-12)]);
}

test('variant widths use rendered CSS width times DPR once, including a direct zoom jump', () => {
    const { chooseAssetVariantWidth } = loadTypeScript(resolve(root, 'types/asset.ts'));
    assert.equal(chooseAssetVariantWidth(100, 1), 160);
    assert.equal(chooseAssetVariantWidth(100, 1.25), 160);
    assert.equal(chooseAssetVariantWidth(200, 1.25), 320);
    assert.equal(chooseAssetVariantWidth(1200, 2), 2560);
});

test('EXIF orientation 6 produces a portrait variant while preserving the input JPEG', async () => {
    const widths = [48, 160, 320, 640, 1280, 2560];
    const modules = loadTypeScript(resolve(root, 'lib/image-variants.ts'), {
        '../types/asset': {
            ASSET_VARIANT_WIDTHS: widths,
            orientedImageDimensions: (width, height, orientation) => orientation >= 5 && orientation <= 8
                ? { width: height, height: width } : { width, height },
        },
        './assets': { openAsset: async () => { throw new Error('not used by this unit test'); } },
    });
    const original = await orientedJpeg();
    const originalCopy = Buffer.from(original);
    const { bytes, width, height } = await modules.createImageVariant(original, {
        mediaType: 'image/jpeg', width: 200, height: 100, orientation: 6,
    }, 160);
    const metadata = await new Transformer(bytes).metadata(true);
    assert.deepEqual({ width, height, outputWidth: metadata.width, outputHeight: metadata.height },
        { width: 100, height: 200, outputWidth: 100, outputHeight: 200 });
    assert.deepEqual(original, originalCopy, 'Variant processing never changes the content-addressed original');
    assert.equal((await new Transformer(original).metadata(true)).orientation, 6);
});

test('new EXIF-oriented uploads publish display dimensions without rewriting original bytes', async t => {
    const rootDirectory = mkdtempSync(resolve(tmpdir(), 'miro-progressive-orientation-'));
    t.after(() => rmSync(rootDirectory, { recursive: true, force: true }));
    const rows = new Map();
    const database = {
        prepare(sql) {
            if (sql.startsWith('SELECT * FROM assets')) return { get: id => rows.get(id) };
            if (sql.startsWith('INSERT OR IGNORE INTO assets')) return { run: (id, mediaType, byteSize, width, height, createdAt) => {
                rows.set(id, { id, media_type: mediaType, byte_size: byteSize, width, height, created_at: createdAt });
            } };
            throw new Error(`Unexpected SQL in fixture: ${sql}`);
        },
    };
    const typeModule = loadTypeScript(resolve(root, 'types/asset.ts'));
    const assets = loadTypeScript(resolve(root, 'lib/assets.ts'), {
        './boards': { assetReferences: () => [] },
        './sqlite': { getDatabase: () => database, getDatabasePath: () => resolve(rootDirectory, 'miro.sqlite') },
        './image-variants': { cacheImageVariant: async () => {} },
        '../types/asset': typeModule,
    });
    const original = await orientedJpeg();
    const { asset } = await assets.ingestAsset(original, 'image/jpeg');
    assert.deepEqual({ width: asset.width, height: asset.height }, { width: 100, height: 200 });
    assert.deepEqual(readFileSync(assets.assetPath(asset.id)), original);
});

test('variants never upscale small sources and GIF responses retain original bytes', async () => {
    const widths = [48, 160, 320, 640, 1280, 2560];
    const modules = loadTypeScript(resolve(root, 'lib/image-variants.ts'), {
        '../types/asset': {
            ASSET_VARIANT_WIDTHS: widths,
            orientedImageDimensions: (width, height, orientation) => orientation >= 5 && orientation <= 8
                ? { width: height, height: width } : { width, height },
        },
        './assets': { openAsset: async () => { throw new Error('not used by this unit test'); } },
    });
    const small = await Transformer.fromRgbaPixels(Buffer.alloc(40 * 20 * 4, 255), 40, 20).png();
    const smallVariant = await modules.createImageVariant(small, { mediaType: 'image/png', width: 40, height: 20 }, 160);
    assert.deepEqual({ width: smallVariant.width, height: smallVariant.height }, { width: 40, height: 20 });
    const gif = Buffer.from('47494638396101000100800000ffffff0000002c00000000010001000002024401003b', 'hex');
    const gifVariant = await modules.createImageVariant(gif, { mediaType: 'image/gif', width: 1, height: 1 }, 160);
    assert.equal(gifVariant.mediaType, 'image/gif');
    assert.deepEqual(gifVariant.bytes, gif);
});

test('ARCH W2 image slice: 800 generated images in a 2,000-object browser workload', { timeout: 600000 }, async t => {
    const context = await createCriticalEditor(t);
    const { page, evaluate, origin, until, click, databasePath, exceptions, networkFailures } = context;
    await fetch(`${origin}/api/boards`);
    const imageCount = 800;
    const otherObjectCount = 1200;
    const dimensions = [[700, 700], [1400, 350], [350, 1400]];
    const width = 700;
    const height = 700;
    const mediaTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const encoder = {
        'image/png': transformer => transformer.png(),
        'image/jpeg': transformer => transformer.jpeg(90),
        'image/webp': transformer => transformer.webp(82),
    };
    const templates = new Map();
    for (const mediaType of mediaTypes) for (const [imageWidth, imageHeight] of dimensions) {
        const key = `${mediaType}:${imageWidth}x${imageHeight}`;
        const seed = Array.from(key).reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
        const pixels = seededPixels(width, height, seed);
        templates.set(key, await encoder[mediaType](Transformer.fromRgbaPixels(pixels, imageWidth, imageHeight)));
    }
    const imageVariants = loadTypeScript(resolve(root, 'lib/image-variants.ts'), {
        '../types/asset': loadTypeScript(resolve(root, 'types/asset.ts')),
        './assets': {
            openAsset: async () => { throw new Error('Fixture cache generation does not read from storage'); },
            assetVariantCachePath: (id, variantWidth) => join(dirname(databasePath), 'assets', '.variants', `${id}-${variantWidth}.webp`),
        },
    });
    const database = new DatabaseSync(databasePath);
    const boardId = randomUUID();
    const layerIds = [];
    const layers = {};
    let originalBytes = 0;
    try {
        const insertAsset = database.prepare('INSERT INTO assets (id, media_type, byte_size, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        const assetRoot = join(dirname(databasePath), 'assets');
        for (let index = 0; index < imageCount; index++) {
            const mediaType = mediaTypes[index % mediaTypes.length];
            const [imageWidth, imageHeight] = dimensions[index % dimensions.length];
            const bytes = fixtureImageBytes(templates.get(`${mediaType}:${imageWidth}x${imageHeight}`), mediaType, index);
            const assetId = createHash('sha256').update(bytes).digest('hex');
            const shard = join(assetRoot, assetId.slice(0, 2));
            mkdirSync(shard, { recursive: true });
            writeFileSync(join(shard, assetId), bytes);
            await imageVariants.cacheImageVariant(bytes, { id: assetId, mediaType, width: imageWidth, height: imageHeight }, 48);
            insertAsset.run(assetId, mediaType, bytes.length, imageWidth, imageHeight, 1_800_000_000_000 + index);
            originalBytes += bytes.length;
            const column = index % 40;
            const row = Math.floor(index / 40);
            const layerId = `w2-image-${String(index).padStart(4, '0')}`;
            layerIds.push(layerId);
            layers[layerId] = {
                type: 5,
                x: -5000 + column * 250,
                y: -2500 + row * 250,
                width: 240,
                height: 240,
                assetId,
            };
        }
        for (let index = 0; index < otherObjectCount; index++) {
            const column = index % 40;
            const row = Math.floor(index / 40);
            const layerId = `w2-shape-${String(index).padStart(4, '0')}`;
            layerIds.push(layerId);
            layers[layerId] = {
                type: 0,
                x: -5000 + column * 250 + 16,
                y: -2500 + row * (5000 / 30) + 16,
                width: 8,
                height: 8,
                fill: { r: index % 256, g: 110, b: 170 },
            };
        }
        const document = JSON.stringify({ schemaVersion: 3, layerIds, layers });
        database.prepare('INSERT INTO boards (id, title, created_at, updated_at, document) VALUES (?, ?, ?, ?, ?)')
            .run(boardId, 'Generated W2 image slice', 1_800_000_000_000, 1_800_000_000_000, document);
    } finally {
        database.close();
    }

    await page('Page.addScriptToEvaluateOnNewDocument', { source: `
        performance.setResourceTimingBufferSize(10000);
        window.__w2ImageRequests = { active: 0, peakActive: 0, cancelled: 0, requests: [], loadedImages: new WeakSet(), decodedImages: new WeakSet(), erroredImages: new WeakSet(), imageErrors: 0 };
        document.addEventListener('load', async event => {
            const image = event.target;
            if (image?.tagName?.toLowerCase() !== 'image' || !image.href?.baseVal) return;
            const metrics = window.__w2ImageRequests;
            metrics.loadedImages.add(image);
            metrics.decodedImages.add(image);
        }, true);
        document.addEventListener('error', event => {
            if (event.target?.tagName?.toLowerCase() === 'image') window.__w2ImageRequests.erroredImages.add(event.target);
        }, true);
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init = {}) => {
            const url = typeof input === 'string' ? input : input.url;
            if (!url.includes('/api/assets/')) return originalFetch(input, init);
            const record = { url, startedAt: performance.now(), status: null, width: null, height: null, contentLength: null, cancelled: false };
            const metrics = window.__w2ImageRequests;
            metrics.requests.push(record);
            metrics.active++;
            metrics.peakActive = Math.max(metrics.peakActive, metrics.active);
            const signal = init.signal;
            const onAbort = () => { record.cancelled = true; };
            signal?.addEventListener('abort', onAbort, { once: true });
            return originalFetch(input, init).then(async response => {
                record.status = response.status;
                record.width = Number(response.headers.get('x-image-width')) || null;
                record.height = Number(response.headers.get('x-image-height')) || null;
                record.contentLength = Number(response.headers.get('content-length')) || null;
                record.bodyBytes = (await response.clone().arrayBuffer()).byteLength;
                return response;
            }, error => {
                record.cancelled = error?.name === 'AbortError';
                throw error;
            }).finally(() => {
                record.endedAt = performance.now();
                metrics.active--;
                signal?.removeEventListener('abort', onAbort);
            });
        };
    ` });
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false });
    await page('Page.navigate', { url: `${origin}/board/${boardId}` });
    await until('W2 board with 2,000 hydrated layers', () => evaluate(`document.querySelector('[data-board-layers]')?.children.length === ${imageCount + otherObjectCount}`), 120000);
    const initial = await evaluate('({ zoom: Number(document.querySelector("[data-board-camera]").getAttribute("transform").match(/scale\\(([^)]+)\\)/)[1]), requests: window.__w2ImageRequests.requests.length, peak: window.__w2ImageRequests.peakActive, visibleImages: [...document.querySelectorAll("[data-image-layer]")].filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }).length })');
    for (let index = 0; index < 4; index++) await click('button[aria-label="Zoom out"]');
    await until('fit scale 10% after the four-level camera transition', () => evaluate('Number(document.querySelector("[data-board-camera]").getAttribute("transform").match(/scale\\(([^)]+)\\)/)[1]) === 0.1'));
    await evaluate('window.__w2FitStartedAt = performance.now()');
    await evaluate(`window.__w2FitMonitor = setInterval(() => {
        const images = [...document.querySelectorAll('[data-image-layer] image[aria-label]')];
        const pending = images.filter(image => !window.__w2ImageRequests.decodedImages.has(image)).length;
        window.__w2ImageRequests.peakPending = Math.max(window.__w2ImageRequests.peakPending || 0, pending);
    }, 10)`);
    await until('all 800 fitted SVG images load and decode', () => evaluate('document.querySelectorAll("[data-image-layer] image[aria-label]").length === 800 && [...document.querySelectorAll("[data-image-layer] image[aria-label]")].every(image => window.__w2ImageRequests.decodedImages.has(image)) && window.__w2ImageRequests.active === 0'), 120000);
    const fit = await evaluate(`(() => {
        const requests = window.__w2ImageRequests.requests;
        window.__w2FitCompletedAt = performance.now();
        const fitted = requests.filter(request => request.startedAt <= window.__w2FitCompletedAt && /[?&]width=48(?:&|$)/.test(request.url));
        const visible = [...document.querySelectorAll('[data-image-layer]')].filter(node => {
            const r = node.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        }).length;
        return {
            zoom: Number(document.querySelector('[data-board-camera]').getAttribute('transform').match(/scale\\(([^)]+)\\)/)[1]),
            visible,
            imageLoads: [...document.querySelectorAll('[data-image-layer] image[aria-label]')].filter(image => window.__w2ImageRequests.loadedImages.has(image)).length,
            imageDecodes: [...document.querySelectorAll('[data-image-layer] image[aria-label]')].filter(image => window.__w2ImageRequests.decodedImages.has(image)).length,
            imageErrors: [...document.querySelectorAll('[data-image-layer] image[aria-label]')].filter(image => window.__w2ImageRequests.erroredImages.has(image)).length,
            requests: fitted.length,
            active: window.__w2ImageRequests.active,
            pending: visible - [...document.querySelectorAll('[data-image-layer] image[aria-label]')].filter(image => window.__w2ImageRequests.decodedImages.has(image)).length,
            peakPending: window.__w2ImageRequests.peakPending || 0,
            cancelled: fitted.filter(request => request.cancelled).length,
            responseBytes: fitted.reduce((sum, request) => sum + (request.status === 200 ? request.bodyBytes || 0 : 0), 0),
            elapsedMs: Number((performance.now() - window.__w2FitStartedAt).toFixed(2)),
        };
    })()`);
    await evaluate('clearInterval(window.__w2FitMonitor)');

    for (let index = 0; index < 6; index++) await click('button[aria-label="Zoom in"]');
    await until('zoomed W2 image requests', () => evaluate('window.__w2ImageRequests.requests.length > 0 && Number(document.querySelector("[data-board-camera]").getAttribute("transform").match(/scale\\(([^)]+)\\)/)[1]) === 2'));
    await until('a zoom-selected 1280-pixel image variant completes', () => evaluate('window.__w2ImageRequests.requests.some(request => request.url.includes("width=1280") && request.status === 200 && request.bodyBytes > 0)'), 60000);
    const zoomed = await evaluate('({ zoom: Number(document.querySelector("[data-board-camera]").getAttribute("transform").match(/scale\\(([^)]+)\\)/)[1]), active: window.__w2ImageRequests.active, requests: window.__w2ImageRequests.requests.length })');
    await page('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 960, y: 540, deltaX: 1000, deltaY: 0 });
    await new Promise(resolve => setTimeout(resolve, 350));
    const panned = await evaluate('({ camera: document.querySelector("[data-board-camera]").getAttribute("transform"), requests: window.__w2ImageRequests.requests.length, active: window.__w2ImageRequests.active })');
    await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1.25, mobile: false });
    await until('DPR transition applied', () => evaluate('window.devicePixelRatio === 1.25'));
    await evaluate('window.dispatchEvent(new Event("resize"))');
    await until('final W2 image requests settle after the DPR transition', () => evaluate('window.__w2ImageRequests.active === 0'), 60000);
    await new Promise(resolve => setTimeout(resolve, 300));
    const final = await evaluate(`(() => {
        const requests = window.__w2ImageRequests.requests;
        const entries = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/assets/'));
        const widths = {};
        const dimensions = {};
        const widthDimensions = {};
        for (const request of requests) {
            const match = request.url.match(/[?&]width=(\\d+)/);
            if (match) {
                widths[match[1]] = (widths[match[1]] || 0) + 1;
                if (request.width && request.height) {
                    const key = match[1] + '→' + request.width + 'x' + request.height;
                    widthDimensions[key] = (widthDimensions[key] || 0) + 1;
                }
            }
            if (request.width && request.height) {
                const key = request.width + 'x' + request.height;
                dimensions[key] = (dimensions[key] || 0) + 1;
            }
        }
        return {
            requests: requests.length,
            responseHeadersReceived: requests.filter(request => request.status === 200).length,
            completedBodies: requests.filter(request => request.status === 200 && request.bodyBytes !== undefined).length,
            cancelled: requests.filter(request => request.cancelled).length,
            cancelledAfterHeaders: requests.filter(request => request.cancelled && request.status === 200).length,
            peakFetchConcurrency: window.__w2ImageRequests.peakActive,
            bodyBytes: requests.reduce((sum, request) => sum + (request.status === 200 ? request.bodyBytes || 0 : 0), 0),
            transferredBytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
            resourceTimingEntries: entries.length,
            zeroTransferTimingEntries: entries.filter(entry => entry.transferSize === 0).length,
            resourceTimingRawPeak: (() => {
                const events = entries.filter(entry => entry.duration > 0 && entry.responseEnd >= entry.startTime).flatMap(entry => [[entry.startTime, 1], [entry.responseEnd, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                let active = 0, peak = 0;
                for (const [, delta] of events) { active += delta; peak = Math.max(peak, active); }
                return peak;
            })(),
            resourceTimingRawPeakBreakdown: (() => {
                const intervals = entries.filter(entry => entry.duration > 0 && entry.responseEnd > entry.startTime);
                const times = [...new Set(intervals.map(entry => entry.startTime))];
                let best = { timeMs: 0, raw: 0, positiveTransfer: 0, zeroTransfer: 0 };
                for (const timeMs of times) {
                    const active = intervals.filter(entry => entry.startTime <= timeMs && entry.responseEnd > timeMs);
                    if (active.length > best.raw) best = {
                        timeMs: Number(timeMs.toFixed(2)),
                        raw: active.length,
                        positiveTransfer: active.filter(entry => entry.transferSize > 0).length,
                        zeroTransfer: active.filter(entry => entry.transferSize === 0).length,
                    };
                }
                return best;
            })(),
            resourceTimingPositiveTransferPeak: (() => {
                const events = entries.filter(entry => entry.transferSize > 0 && entry.duration > 0 && entry.responseEnd >= entry.startTime).flatMap(entry => [[entry.startTime, 1], [entry.responseEnd, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
                let active = 0, peak = 0;
                for (const [, delta] of events) { active += delta; peak = Math.max(peak, active); }
                return peak;
            })(),
            selectedWidths: widths,
            selectedResponseDimensions: dimensions,
            selectedWidthToResponseDimensions: widthDimensions,
            originalFetches: requests.filter(request => !/[?&]width=/.test(request.url)).length,
            decodedMemory: typeof performance.measureUserAgentSpecificMemory === 'function' ? 'API_PRESENT_BUT_NOT_MEASURED' : 'NOT_CHECKED',
        };
    })()`);
    const fixture = {
        objects: layerIds.length,
        images: imageCount,
        nonImagePlaceholders: otherObjectCount,
        pixelTemplates: templates.size,
        uniqueness: 'per-asset PNG tEXt, JPEG COM or WebP XMP metadata; image pixels are repeated by matching format and dimensions',
        dimensions: `${dimensions.map(([w, h]) => `${w}x${h}`).join(', ')} (490,000 pixels each; aspect ratios 1:1, 4:1 and 1:4 cyclically)`,
        mediaTypeCounts: mediaTypes.reduce((counts, mediaType) => ({ ...counts, [mediaType]: Array.from({ length: imageCount }, (_, index) => mediaTypes[index % mediaTypes.length]).filter(type => type === mediaType).length }), {}),
        originalBytes,
        originalMegabytesDecimal: Number((originalBytes / 1_000_000).toFixed(3)),
        viewport: '1920x1080 CSS pixels',
        dprTransitions: [2, 1.25],
        cameraTransitions: ['default 100%', 'fit-scale 10%', 'zoom 200%', 'pan +1000 screen px'],
        initial,
        fit,
        zoomed,
        panned,
        final,
        browserExceptions: exceptions.length,
        uncancelledNetworkFailures: networkFailures.length,
    };
    t.diagnostic(`ARCH W2 synthetic image slice: ${JSON.stringify(fixture)}`);
    assert.equal(layerIds.length, 2000);
    assert.equal(imageCount + otherObjectCount, 2000);
    assert.ok(initial.visibleImages > 0 && initial.visibleImages < imageCount, 'The initial default camera exposes only part of the W2 cluster');
    assert.equal(fit.zoom, 0.1);
    assert.equal(fit.visible, imageCount, 'The fitted cluster places all W2 images in the viewport');
    assert.equal(fit.imageLoads, imageCount, 'The first fitted view records actual SVG image load events');
    assert.equal(fit.imageDecodes, imageCount, 'Every fitted SVG image decodes successfully');
    assert.equal(fit.imageErrors, 0, 'The first fitted view has no SVG image decode or load errors');
    assert.equal(fit.pending, 0, 'All first-fit visible image requests have completed');
    assert.equal(fit.active, 0);
    assert.ok(fit.responseBytes <= 8_000_000, `First-fit image response bodies are within 8 MB: ${fit.responseBytes}`);
    assert.ok(fit.elapsedMs <= 4000, `First-fit previews complete within 4 seconds: ${fit.elapsedMs} ms`);
    assert.ok(final.cancelled > 0, 'Pan/zoom transitions cancel stale image loads');
    assert.ok(Object.keys(final.selectedWidthToResponseDimensions).some(key => key.startsWith('1280→')), 'The zoomed CSS×DPR target returns a measured 1280-pixel variant');
    assert.equal(final.originalFetches, 0, 'Ordinary navigation never fetches an original');
    assert.ok(final.peakFetchConcurrency <= 8, 'Application fetch concurrency stays within its implementation bound');
    assert.ok(final.transferredBytes > 0);
    assert.deepEqual(exceptions, [], 'The W2 browser run has no uncaught exceptions');
    assert.deepEqual(networkFailures, [], 'The W2 browser run has no uncancelled request failures');
});
