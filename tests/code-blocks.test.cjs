const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

test('code blocks preserve source and settings through history, migration and responsive editing', { timeout: 180000 }, async t => {
    const context = await createCriticalEditor(t);
    const { page, origin, evaluate, click, until, saved, deadline } = context;
    const evidence = await mkdtemp(join(tmpdir(), 'miro-code-evidence-'));

    await page('Page.navigate', { url: origin });
    await until('hydrated dashboard', () => evaluate('document.querySelector("h1")?.textContent === "Boards" && !document.body.textContent.includes("Loading boards")'));
    await click('button');
    await until('new board route', () => evaluate('location.pathname.startsWith("/board/")'));
    await until('board toolbar hydrated', () => evaluate('!!document.querySelector(\'button[aria-label="Pen"]\')'));
    const toolbarLabels = await evaluate('Array.from(document.querySelectorAll("button")).map(button => button.getAttribute("aria-label"))');
    assert.ok(toolbarLabels.includes('Code block (Ctrl+Shift+C)'), `Code block action is available: ${JSON.stringify(toolbarLabels)}`);
    const boardUrl = await evaluate('location.href');
    const boardId = boardUrl.split('/').at(-1);
    const api = `${origin}/api/boards/${boardId}`;
    const readBoard = async () => (await fetch(api, { signal: AbortSignal.timeout(deadline) })).json();
    const patchDocument = document => fetch(api, {
        method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document }), signal: AbortSignal.timeout(deadline),
    });
    const documentWithLayer = layer => ({ schemaVersion: 5, layerIds: ['candidate'], layers: { candidate: layer } });
    const ordinaryTextDocument = documentWithLayer({
        type: 3, x: 1, y: 2, width: 320, height: 180, fill: { r: 255, g: 255, b: 255 }, value: 'ordinary text',
    });
    assert.equal((await patchDocument(ordinaryTextDocument)).status, 200, 'Ordinary Text without code metadata remains valid');
    assert.deepEqual((await readBoard()).document, ordinaryTextDocument);
    const validCodeRecord = {
        type: 3, x: 1, y: 2, width: 320, height: 180, fill: { r: 255, g: 255, b: 255 }, value: 'const x = 1;',
        codeBlock: true, fontSize: 14, showLineNumbers: true,
    };
    const invalidCodeRecords = [
        ['codeBlock false', { ...validCodeRecord, codeBlock: false }],
        ['non-boolean codeBlock', { ...validCodeRecord, codeBlock: 'true' }],
        ['code metadata without marker', (() => { const { codeBlock, ...record } = validCodeRecord; return record; })()],
        ['non-Text code block', { ...validCodeRecord, type: 0 }],
        ['font size below minimum', { ...validCodeRecord, fontSize: 7 }],
        ['font size above maximum', { ...validCodeRecord, fontSize: 49 }],
        ['fractional font size', { ...validCodeRecord, fontSize: 14.5 }],
        ['string font size', { ...validCodeRecord, fontSize: '14' }],
        ['missing font size', (() => { const { fontSize, ...record } = validCodeRecord; return record; })()],
        ['non-boolean line-number setting', { ...validCodeRecord, showLineNumbers: 'true' }],
        ['missing line-number setting', (() => { const { showLineNumbers, ...record } = validCodeRecord; return record; })()],
    ];
    for (const [description, layer] of invalidCodeRecords) {
        assert.equal((await patchDocument(documentWithLayer(layer))).status, 400, `${description} is rejected`);
        assert.deepEqual((await readBoard()).document, ordinaryTextDocument, `${description} leaves the saved board unchanged`);
    }
    for (const fontSize of [8, 48]) {
        assert.equal((await patchDocument(documentWithLayer({ ...validCodeRecord, fontSize }))).status, 200, `Font size ${fontSize} is accepted`);
    }
    assert.equal((await patchDocument({ schemaVersion: 5, layerIds: [], layers: {} })).status, 200, 'The isolated board is reset for UI coverage');
    const source = 'const answer = 42;\n\tconsole.log(answer);\nwindow.__codeExecuted = true;';
    const clickAt = async point => {
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    };
    const doubleClickCode = async () => {
        const point = await until('visible code block', () => evaluate(`(() => {
            const block = document.querySelector('[data-code-block]');
            if (!block) return false;
            const rect = block.getBoundingClientRect();
            return rect.width && rect.height ? { x: rect.left + Math.min(80, rect.width / 2), y: rect.top + Math.min(70, rect.height / 2) } : false;
        })()`));
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        for (const clickCount of [1, 2]) {
            await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount });
            await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount });
        }
    };
    const screenshot = async name => {
        const result = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const path = join(evidence, name);
        await writeFile(path, Buffer.from(result.data, 'base64'));
        t.diagnostic(`${name}: ${path}`);
    };

    await click('button[aria-label="Code block (Ctrl+Shift+C)"]');
    await clickAt({ x: 420, y: 340 });
    const codeId = await until('code block persisted from the toolbar insertion tool', async () => {
        const board = await readBoard();
        return board.document.layerIds.find(id => board.document.layers[id].codeBlock === true) || false;
    });
    let board = await readBoard();
    let code = board.document.layers[codeId];
    assert.deepEqual([code.width, code.height, code.fontSize, code.showLineNumbers], [320, 220, 14, true]);
    assert.equal(await evaluate('!document.querySelector(".cm-editor")'), true, 'The CodeMirror editor stays unmounted until editing starts');
    assert.equal(await evaluate('document.querySelector("[data-code-block]")?.textContent.includes("1")'), true);
    await saved();

    await doubleClickCode();
    await until('CodeMirror editor mounted on demand', () => evaluate('!!document.querySelector(".cm-editor .cm-content[contenteditable=true]")'));
    await click('.cm-content[contenteditable="true"]');
    await until('CodeMirror receives editing focus', () => evaluate('document.activeElement?.matches(".cm-content[contenteditable=true]")'));
    await page('Input.insertText', { text: source });
    await until('code source persisted exactly', async () => (await readBoard()).document.layers[codeId].value === source);
    await saved();
    board = await readBoard();
    assert.equal(board.document.layers[codeId].value, source, 'Whitespace, indentation and newlines persist exactly');
    assert.equal(await evaluate('window.__codeExecuted === true'), false, 'Source code is displayed and never executed');
    assert.equal(await evaluate('!!document.querySelector(".cm-content span[class]")'), true, 'The selected JavaScript grammar highlights source tokens');
    await screenshot('code-wide-editing.png');

    await click('button[aria-label="Finish code editing"]');
    await until('Done closes CodeMirror', () => evaluate('!document.querySelector(".cm-editor")'));
    await click('button[aria-label="Undo (Ctrl+Z)"]');
    await until('board undo restores the prior source', async () => (await readBoard()).document.layers[codeId].value === '');
    await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
    await until('board redo restores exact source', async () => (await readBoard()).document.layers[codeId].value === source);

    await doubleClickCode();
    await until('CodeMirror reopened', () => evaluate('!!document.querySelector(".cm-editor")'));
    await click('input[aria-label="Show line numbers"]');
    const size = await until('code font-size input', () => evaluate(`(() => {
        const input = document.querySelector('input[aria-label="Code font size"]');
        const rect = input?.getBoundingClientRect();
        return input && rect?.width ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : false;
    })()`));
    await clickAt(size);
    await page('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await page('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await page('Input.insertText', { text: '18' });
    await saved();
    board = await readBoard();
    code = board.document.layers[codeId];
    assert.equal(code.fontSize, 18);
    assert.equal(code.showLineNumbers, false);
    assert.equal(code.value, source);
    await click('button[aria-label="Finish code editing"]');
    await until('Done closes settings editor', () => evaluate('!document.querySelector(".cm-editor")'));
    await page('Page.reload', { ignoreCache: true });
    await until('saved code block survives reload', () => evaluate('document.querySelector("[data-code-block]")?.textContent.includes("console.log(answer)")'));
    await saved();
    assert.deepEqual(((await readBoard()).document.layers[codeId]), code);

    await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    const repositioned = structuredClone((await readBoard()).document);
    repositioned.layers[codeId].x = 70;
    repositioned.layers[codeId].width = 280;
    const moveResponse = await fetch(api, {
        method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: repositioned }), signal: AbortSignal.timeout(deadline),
    });
    assert.equal(moveResponse.status, 200);
    await page('Page.reload', { ignoreCache: true });
    await until('narrow viewport code block rendered', () => evaluate('!!document.querySelector("[data-code-block]")'));
    await doubleClickCode();
    await until('narrow CodeMirror editor mounted', () => evaluate('!!document.querySelector(".cm-editor")'));
    const narrow = await until('narrow editor controls measured', () => evaluate(`(() => {
        const size = document.querySelector('input[aria-label="Code font size"]')?.getBoundingClientRect();
        const lineNumbers = document.querySelector('input[aria-label="Show line numbers"]')?.getBoundingClientRect();
        const done = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Done')?.getBoundingClientRect();
        const editor = document.querySelector('.cm-editor')?.getBoundingClientRect();
        const block = document.querySelector('[data-code-block]')?.getBoundingClientRect();
        const rail = document.querySelector('button[aria-label="Code block (Ctrl+Shift+C)"]')?.closest('div.absolute')?.getBoundingClientRect();
        const selectionTools = document.querySelector('button[aria-label="Lock selected objects"]')?.closest('div.absolute')?.getBoundingClientRect();
        const navigation = document.querySelector('[role="status"]')?.closest('div.absolute')?.getBoundingClientRect();
        const newFrame = document.querySelector('button[aria-label="New frame"]')?.getBoundingClientRect();
        const zoom = document.querySelector('button[aria-label="Zoom out"]')?.closest('div.absolute')?.getBoundingClientRect();
        return size && lineNumbers && done && editor && block && rail && selectionTools && navigation && newFrame && zoom ? {
            viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth },
            size: { left: size.left, right: size.right, top: size.top, bottom: size.bottom },
            lineNumbers: { left: lineNumbers.left, right: lineNumbers.right, top: lineNumbers.top, bottom: lineNumbers.bottom },
            done: { left: done.left, right: done.right, top: done.top, bottom: done.bottom },
            editor: { left: editor.left, right: editor.right, top: editor.top, bottom: editor.bottom },
            block: { left: block.left, right: block.right },
            rail: { left: rail.left, right: rail.right, top: rail.top, bottom: rail.bottom },
            selectionTools: { left: selectionTools.left, right: selectionTools.right, top: selectionTools.top, bottom: selectionTools.bottom },
            navigation: { left: navigation.left, right: navigation.right, top: navigation.top, bottom: navigation.bottom },
            newFrame: { left: newFrame.left, right: newFrame.right, top: newFrame.top, bottom: newFrame.bottom },
            zoom: { left: zoom.left, right: zoom.right, top: zoom.top, bottom: zoom.bottom },
        } : false;
    })()`));
    for (const control of [narrow.size, narrow.lineNumbers, narrow.done]) {
        assert.ok(control.left >= 0 && control.right <= 390 && control.top >= 0 && control.bottom <= 844, JSON.stringify(narrow));
    }
    assert.equal(narrow.viewport.scrollWidth, 390, JSON.stringify(narrow));
    assert.ok(narrow.block.left >= narrow.rail.right, JSON.stringify(narrow));
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert.equal(overlaps(narrow.selectionTools, narrow.rail), false, JSON.stringify(narrow));
    assert.equal(overlaps(narrow.selectionTools, narrow.navigation), false, JSON.stringify(narrow));
    assert.equal(overlaps(narrow.selectionTools, narrow.newFrame), false, JSON.stringify(narrow));
    assert.equal(overlaps(narrow.selectionTools, narrow.zoom), false, JSON.stringify(narrow));
    assert.ok(narrow.selectionTools.left >= 0 && narrow.selectionTools.right <= narrow.viewport.width && narrow.selectionTools.top >= 0 && narrow.selectionTools.bottom <= narrow.viewport.height, JSON.stringify(narrow));
    assert.ok(narrow.selectionTools.right <= narrow.viewport.width, JSON.stringify(narrow));
    await screenshot('code-narrow-editing.png');

    const legacyCode = {
        schemaVersion: 4,
        layerIds: ['legacy-code'],
        layers: { 'legacy-code': {
            type: 3, x: 20, y: 30, width: 320, height: 180, fill: { r: 255, g: 255, b: 255 },
            value: 'const legacy = true;', codeBlock: true, fontSize: 16, showLineNumbers: false,
        } },
    };
    const migrationResponse = await fetch(api, {
        method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: legacyCode }), signal: AbortSignal.timeout(deadline),
    });
    assert.equal(migrationResponse.status, 200);
    const migrated = await (await fetch(api)).json();
    assert.equal(migrated.document.schemaVersion, 5);
    assert.deepEqual(migrated.document.layers['legacy-code'], legacyCode.layers['legacy-code'], 'The existing v4-to-v5 upgrade preserves code metadata');
    t.diagnostic('Code block migration verified');

    const nested = structuredClone(migrated.document);
    nested.layerIds.push('code-frame');
    nested.layers['code-frame'] = { type: 7, x: 150, y: 150, width: 800, height: 500, name: 'Code frame' };
    nested.layers['legacy-code'].parentId = 'code-frame';
    assert.equal((await patchDocument(nested)).status, 200, 'Code blocks use the existing frame relation');
    await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const positionCode = async (document, x, y) => {
        document.layers['legacy-code'].x = x;
        document.layers['legacy-code'].y = y;
        document.layers['code-frame'].x = 150;
        document.layers['code-frame'].y = 150;
        return patchDocument(document);
    };
    assert.equal((await positionCode(nested, 420, 340)).status, 200);
    await page('Page.reload', { ignoreCache: true });
    await until('migrated code block rendered', () => evaluate('!!document.querySelector("[data-code-block]")'));
    t.diagnostic('Migrated code block reopened in browser');
    const selectCode = async () => {
        const point = await until('code block selectable', () => evaluate(`(() => {
            const rect = document.querySelector('[data-code-block]')?.getBoundingClientRect();
            return rect?.width ? { x: rect.left + 80, y: rect.top + 50 } : false;
        })()`));
        await clickAt(point);
    };
    const assertCodeEditBlocked = async reason => {
        await doubleClickCode();
        await until(`${reason} lock notice`, () => evaluate('document.body.textContent.includes("This object is locked. Unlock it before editing its text.")'));
        assert.equal(await evaluate('!document.querySelector(".cm-editor")'), true, `${reason} protection prevents mounting the editor`);
        assert.equal((await (await fetch(api)).json()).document.layers['legacy-code'].value, 'const legacy = true;');
    };
    await selectCode();
    await click('button[aria-label="Lock selected objects"]');
    nested.layers['legacy-code'].locked = true;
    await until('code block common lock saved', async () => (await (await fetch(api)).json()).document.layers['legacy-code'].locked === true);
    t.diagnostic('Common code block lock persisted');
    await assertCodeEditBlocked('Own');
    t.diagnostic('Own code block lock blocked editing');
    await click('button[aria-label="Unlock selected objects"]');
    nested.layers['legacy-code'].locked = false;
    await until('code block common unlock saved', async () => (await (await fetch(api)).json()).document.layers['legacy-code'].locked !== true);
    t.diagnostic('Common code block unlock persisted');

    await clickAt({ x: 200, y: 200 });
    await until('containing frame selected', () => evaluate('!!document.querySelector(\'input[aria-label="Frame name"]\')'));
    await click('button[aria-label="Lock selected objects"]');
    await until('containing frame lock saved', async () => (await (await fetch(api)).json()).document.layers['code-frame'].locked === true);
    await selectCode();
    await assertCodeEditBlocked('Inherited frame');
    t.diagnostic('Inherited frame lock blocked editing');

    await click('button[aria-label="Lock selected objects"]');
    await until('child lock saved inside locked frame', async () => (await (await fetch(api)).json()).document.layers['legacy-code'].locked === true);
    await clickAt({ x: 200, y: 200 });
    await until('locked containing frame selected', () => evaluate('!!document.querySelector(\'input[aria-label="Frame name"]\')'));
    await click('button[aria-label="Unlock selected objects"]');
    await until('ancestor unlocked while child lock remains', async () => {
        const document = (await (await fetch(api)).json()).document;
        return document.layers['code-frame'].locked !== true && document.layers['legacy-code'].locked === true;
    });
    t.diagnostic('Unlocking frame preserved child lock');
    await selectCode();
    await assertCodeEditBlocked('Child');
    await click('button[aria-label="Unlock selected objects"]');
    await until('child lock released through common toolbar', async () => (await (await fetch(api)).json()).document.layers['legacy-code'].locked !== true);
});
