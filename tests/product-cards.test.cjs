// Product card URL and refresh policy checks use generated metadata only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const ts = require('typescript');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

const root = resolve(__dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'miro-product-cards-'));
test('product-card policy fixtures', async t => {
    t.after(() => rmSync(scratch, { recursive: true, force: true }));
    const source = readFileSync(join(root, 'types/extraction.ts'), 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const modulePath = join(scratch, 'extraction.cjs');
    writeFileSync(modulePath, output);
    const { isHttpSourceUrl, mergeProductMetadata } = require(modulePath);

    await t.test('accepts HTTP(S) source URLs without normalizing the saved string', () => {
        const sourceUrl = 'https://shop.example/products/coat?variant=blue';
        assert.equal(isHttpSourceUrl(sourceUrl), true);
        assert.equal(isHttpSourceUrl('http://127.0.0.1:3000/item'), true);
        assert.equal(isHttpSourceUrl('javascript:alert(1)'), false);
        assert.equal(isHttpSourceUrl('data:text/html,unsafe'), false);
        assert.equal(isHttpSourceUrl('not a URL'), false);
    });

    await t.test('refresh updates captured metadata but preserves manual title and image edits', () => {
        const current = {
            type: 6,
            x: 20,
            y: 30,
            width: 320,
            height: 272,
            sourceUrl: 'https://shop.example/products/coat?variant=blue',
            variantUrl: 'https://shop.example/products/coat?variant=blue',
            title: 'Owner title',
            titleSource: 'manual',
            assetId: 'a'.repeat(64),
            imageSource: 'manual',
            extractionStatus: 'offline',
            extractionMessage: 'The last lookup was offline.',
        };
        const refreshed = mergeProductMetadata(current, {
            title: 'Captured title',
            variantUrl: 'https://shop.example/products/coat?variant=green',
            assetId: 'b'.repeat(64),
        });

        assert.equal(refreshed.sourceUrl, current.sourceUrl, 'The exact original source remains stable');
        assert.equal(refreshed.variantUrl, 'https://shop.example/products/coat?variant=green');
        assert.equal(refreshed.title, 'Owner title');
        assert.equal(refreshed.assetId, 'a'.repeat(64));
        assert.equal(refreshed.extractionStatus, 'ready');
        assert.equal(refreshed.extractionMessage, undefined);
    });

    await t.test('refresh keeps prior extracted values when the new result omits a field', () => {
        const current = {
            type: 6,
            x: 20,
            y: 30,
            width: 320,
            height: 272,
            sourceUrl: 'https://shop.example/products/coat?variant=blue',
            variantUrl: 'https://shop.example/products/coat?variant=blue',
            title: 'Captured title',
            titleSource: 'extracted',
            assetId: 'a'.repeat(64),
            imageSource: 'extracted',
            extractionStatus: 'error',
        };
        const refreshed = mergeProductMetadata(current, {});
        assert.equal(refreshed.title, current.title);
        assert.equal(refreshed.assetId, current.assetId);
        assert.equal(refreshed.sourceUrl, current.sourceUrl);
        assert.equal(refreshed.extractionStatus, 'ready');
    });
});

test('product card retry exposes pending before async completion and keeps synchronous failure', { timeout: 120000 }, async t => {
    const context = await createCriticalEditor(t);
    const { origin, page, evaluate, click, until, saved } = context;
    const sourceUrl = 'https://shop.example/products/coat?variant=blue';
    const created = await fetch(`${origin}/api/boards`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Synthetic product cards' }),
    });
    assert.equal(created.status, 201);
    const board = await created.json();
    const initialCard = {
        type: 6,
        x: 300,
        y: 220,
        width: 320,
        height: 272,
        sourceUrl,
        variantUrl: sourceUrl,
        extractionStatus: 'ready',
    };
    const seeded = await fetch(`${origin}/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: { schemaVersion: 4, layerIds: ['card'], layers: { card: initialCard } } }),
    });
    assert.equal(seeded.status, 200);

    await page('Page.navigate', { url: `${origin}/board/${board.id}` });
    await until('hydrated ready product card', () => evaluate('!!document.querySelector("g[data-product-card] input[aria-label=\"Product title\"]")'));
    await evaluate(`(() => {
        window.__productExtractionMode = 'async';
        window.__productExtractionHandler = event => {
            if (event.detail.sourceUrl !== ${JSON.stringify(sourceUrl)}) return;
            event.preventDefault();
            if (window.__productExtractionMode === 'async') {
                setTimeout(() => event.detail.complete({ title: 'Captured title', variantUrl: 'https://shop.example/products/coat?variant=green' }), 900);
            } else {
                event.detail.fail('offline', 'Synthetic offline');
            }
        };
        window.addEventListener('miro:product-extraction-request', window.__productExtractionHandler);
    })()`);

    await click('g[data-product-card] button:nth-of-type(2)');
    await until('pending visible for async refresh of a READY card', () => evaluate('document.querySelector("g[data-product-card] [role=status]")?.textContent === "Preview pending"'));
    await click('g[data-product-card] input[aria-label="Product title"]');
    await page('Input.insertText', { text: 'Owner title' });
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await until('async refresh completes without replacing a new manual title', () => evaluate(`(() => {
        const card = document.querySelector('g[data-product-card]');
        return card?.querySelector('[role=status]')?.textContent === 'Preview ready' &&
            card?.querySelector('input[aria-label="Product title"]')?.value === 'Owner title';
    })()`));
    await saved();
    const afterRefresh = await (await fetch(`${origin}/api/boards/${board.id}`)).json();
    assert.equal(afterRefresh.document.layers.card.sourceUrl, sourceUrl);
    assert.equal(afterRefresh.document.layers.card.variantUrl, 'https://shop.example/products/coat?variant=green');
    assert.equal(afterRefresh.document.layers.card.title, 'Owner title');
    assert.equal(afterRefresh.document.layers.card.titleSource, 'manual');

    await evaluate("window.__productExtractionMode = 'sync-fail'");
    await click('g[data-product-card] button:nth-of-type(2)');
    assert.equal(await evaluate('document.querySelector("g[data-product-card] [role=status]")?.textContent'), 'Synthetic offline',
        'A synchronous failure must remain the final state instead of being overwritten by pending');
    await saved();
    const afterFailure = await (await fetch(`${origin}/api/boards/${board.id}`)).json();
    assert.equal(afterFailure.document.layers.card.extractionStatus, 'offline');
    assert.equal(afterFailure.document.layers.card.extractionMessage, 'Synthetic offline');
});
