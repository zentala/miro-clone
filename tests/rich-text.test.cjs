const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const { createCriticalEditor } = require('./critical-editor/setup.cjs');

const root = resolve(__dirname, '..');
const editorSource = readFileSync(resolve(root, 'app/board/[boardId]/_components/rich-text-editor.tsx'), 'utf8');
const source = readFileSync(resolve(root, 'lib/rich-text.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const Module = require('node:module');
const instance = new Module(resolve(root, 'lib/rich-text.js'));
instance.filename = resolve(root, 'lib/rich-text.js');
instance.paths = Module._nodeModulePaths(root);
instance._compile(outputText, instance.filename);
const richText = instance.exports;

test('rich text toolbar controls preserve selection and use native click activation', () => {
    for (const [label, action] of [
        ['Bold', 'toggleBold'],
        ['Italic', 'toggleItalic'],
    ]) {
        const control = editorSource.match(new RegExp(`<Button\\b(?=[^>]*aria-label="${label}")[^>]*>[\\s\\S]*?<\\/Button>`))?.[0];
        assert.ok(control, `${label} is a toolbar button`);
        assert.match(control, /type="button"/);
        assert.match(control, /onMouseDown=\{preserveSelection\}/);
        assert.match(control, new RegExp(`onClick=\\{command\\(\\(\\) => editor\\.chain\\(\\)\\.${action}\\(\\)\\.run\\(\\)\\)\\}`));
    }

    const done = editorSource.match(/<Button\b(?=[^>]*>Done<\/Button>)[^>]*>[\s\S]*?<\/Button>/)?.[0];
    assert.ok(done, 'Done is a toolbar button');
    assert.match(done, /type="button"/);
    assert.match(done, /onMouseDown=\{preserveSelection\}/);
    assert.match(done, /onClick=\{command\(onDone\)\}/);
    assert.match(editorSource, /handleDOMEvents: \{ keydown: \(_view, event\) => \{ event\.stopPropagation\(\); return false; \} \}/);
});

test('rich text encoding keeps supported styles and emits only safe HTML', () => {
    const stored = richText.encodeRichText({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Keep me', marks: [
            { type: 'bold' }, { type: 'italic' },
            { type: 'textStyle', attrs: { color: '#123456', fontFamily: 'var(--font-inter)', fontSize: '30px', background: 'url(javascript:alert(1))' } },
            { type: 'link', attrs: { href: 'javascript:alert(1)' } },
        ] },
    ] }] });
    const decoded = richText.decodeRichText(stored);
    assert.equal(decoded.content[0].content[0].text, 'Keep me');
    assert.deepEqual(decoded.content[0].content[0].marks.map(mark => mark.type), ['bold', 'italic', 'textStyle']);
    const html = richText.displayRichText(stored).html;
    assert.match(html, /<p><span style="color:#123456;font-family:var\(--font-inter\);font-size:30px"><em><strong>Keep me<\/strong><\/em><\/span><\/p>/);
    assert.doesNotMatch(html, /script|background|link|onerror/i);
});

test('legacy HTML retains readable text while removing executable markup and attributes', () => {
    const legacy = '<p onclick="alert(1)">Safe text</p><script>window.wasExecuted = true</script><img src=x onerror="alert(2)">';
    const display = richText.displayRichText(legacy);
    assert.equal(display.document, null);
    assert.equal(display.html, 'Safe text');
    assert.doesNotMatch(display.html, /script|onclick|onerror|<img/i);
    assert.equal(richText.legacyText('<p>A &amp; B</p>'), 'A & B');
});

test('unknown rich text structure degrades to visible text and malformed values fall back safely', () => {
    const sanitized = richText.sanitizeRichText({ type: 'doc', content: [{
        type: 'script', content: [{ type: 'text', text: 'Visible unsupported content' }],
    }] });
    assert.match(richText.richTextHtml(sanitized), /Visible unsupported content/);
    assert.equal(richText.decodeRichText('\u001eMiroRichText:1:{broken'), null);
    assert.equal(richText.displayRichText('\u001eMiroRichText:1:{broken').html, '');
});

test('rich text editor: native controls, local fonts, paste, history and responsive geometry', { timeout: 180000 }, async t => {
    const context = await createCriticalEditor(t);
    const { page, origin, evaluate, click, until, saved, deadline } = context;
    const words = 'mouseBold enterBold spaceBold mouseItalic enterItalic spaceItalic canvasGuard doneMouse doneEnter doneSpace fontOverride sizeOverride';
    const richNote = richText.encodeRichText({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Plain note ' },
        { type: 'text', text: 'Explicit Inter', marks: [{ type: 'textStyle', attrs: { fontFamily: 'var(--font-inter)' } }] },
    ] }] });
    await page('Page.navigate', { url: origin });
    await until('hydrated dashboard', () => evaluate('document.querySelector("h1")?.textContent === "Boards" && !document.body.textContent.includes("Loading boards")'));
    await click('button');
    await until('new board editor', () => evaluate(`location.pathname.startsWith("/board/") && !!document.querySelector('button[aria-label="Pen"]')`));
    let boardUrl = await evaluate('location.href');
    const boardId = boardUrl.split('/').pop();
    const boardApi = `${origin}/api/boards/${boardId}`;
    const updateDocument = async next => {
        const response = await fetch(boardApi, {
            method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(deadline),
            body: JSON.stringify({ document: next }),
        });
        assert.equal(response.status, 200);
        document = next;
    };
    const readBoard = async () => (await fetch(boardApi, { signal: AbortSignal.timeout(deadline) })).json();
    async function insertDefaultLayer(toolLabel, type, point) {
        await click(`button[aria-label=${JSON.stringify(toolLabel)}]`);
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
        const id = await until(`default ${type} inserted through the canvas`, async () => {
            const current = await readBoard();
            return current.document.layerIds.find(layerId => current.document.layers[layerId].type === type) || false;
        });
        const layer = (await readBoard()).document.layers[id];
        assert.deepEqual([layer.width, layer.height], [100, 100], `${toolLabel} keeps its real default geometry`);
        await saved();
        return id;
    }
    const textId = await insertDefaultLayer('Text (Ctrl+T)', 3, { x: 120, y: 220 });
    const noteId = await insertDefaultLayer('Sticky Note (Ctrl+N)', 4, { x: 120, y: 500 });
    let document = (await readBoard()).document;
    document.layers[textId].value = words;
    document.layers[noteId].value = richNote;
    await updateDocument(document);
    await page('Page.reload', { ignoreCache: true });
    await until('synthetic text and note layers rendered', () => evaluate(
        `document.querySelectorAll('[role="textbox"][aria-readonly="true"]').length === 2`
    ));

    async function textPoint(selector) {
        return until(`visible text target ${selector}`, () => evaluate(`(() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width && rect.height ? { x: rect.x + Math.min(rect.width / 2, 80), y: rect.y + Math.min(rect.height / 2, 30) } : false;
        })()`));
    }
    async function doubleClick(selector) {
        const point = await textPoint(selector);
        await doubleClickAt(point);
    }
    async function doubleClickAt(point) {
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        for (const clickCount of [1, 2]) {
            await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount });
            await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount });
        }
    }
    async function doubleClickContaining(phrase) {
        const point = await until(`visible text containing ${phrase}`, () => evaluate(`(() => {
            const element = Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]'))
                .find(item => item.textContent.includes(${JSON.stringify(phrase)}));
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return rect.width && rect.height ? { x: rect.x + Math.min(rect.width / 2, 80), y: rect.y + Math.min(rect.height / 2, 30) } : false;
        })()`));
        await doubleClickAt(point);
    }
    async function openEditorContaining(phrase) {
        await doubleClickContaining(phrase);
        await until('rich text editor mounted', () => evaluate('!!document.querySelector(".ProseMirror")'));
        await until('ProseMirror receives editing focus after mount', () => evaluate(
            'document.activeElement === document.querySelector(".ProseMirror")'
        ));
    }
    async function openTextEditor() { await openEditorContaining('mouseBold'); }
    let reportedSelectionFocus = false;
    async function selectPhrase(phrase) {
        const selected = await evaluate(`(() => {
            const editor = document.querySelector('.ProseMirror');
            const focusedBeforeSelection = document.activeElement === editor;
            editor.focus();
            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const start = node.data.indexOf(${JSON.stringify(phrase)});
                if (start < 0) continue;
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.setBaseAndExtent(node, start, node, start + ${phrase.length});
                return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
                    text: selection.toString(), focusedBeforeSelection, focusedAfterFocus: document.activeElement === editor,
                }))));
            }
            return null;
        })()`);
        if (!reportedSelectionFocus) {
            t.diagnostic(`ProseMirror was ${selected?.focusedBeforeSelection ? "already focused" : "not focused"} before selectPhrase; focus after explicit setup: ${selected?.focusedAfterFocus ? "ProseMirror" : "other element"}`);
            reportedSelectionFocus = true;
        }
        assert.equal(selected?.text, phrase, `Browser selection contains ${phrase}`);
        assert.equal(selected?.focusedAfterFocus, true, 'ProseMirror has focus while the text selection is prepared');
    }
    async function press(keyName) {
        const key = keyName === 'Space' ? ' ' : keyName;
        const code = keyName === 'Space' ? 'Space' : keyName;
        const windowsVirtualKeyCode = keyName === 'Space' ? 32 : keyName === 'Enter' ? 13 : keyName.toUpperCase().charCodeAt(0);
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', {
            type, key, code, windowsVirtualKeyCode,
            ...(keyName === 'Enter' && type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}),
        });
    }
    async function pressCanvasKey(keyName, modifiers = 0) {
        const code = keyName.length === 1 ? `Key${keyName.toUpperCase()}` : keyName;
        const virtualKey = keyName.length === 1 ? keyName.toUpperCase().charCodeAt(0) : ({ ArrowUp: 38, ArrowRight: 39 }[keyName]);
        for (const type of ['keyDown', 'keyUp']) await page('Input.dispatchKeyEvent', {
            type, key: keyName, code, modifiers, windowsVirtualKeyCode: virtualKey,
        });
    }
    async function clickDone() {
        const point = await until('Done toolbar control', () => evaluate(`(() => {
            const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Done');
            if (!button) return false;
            const rect = button.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        })()`));
        await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
        await page('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
        await page('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
    }
    async function assertDefaultSizeToolbarReachable(phrase) {
        await openEditorContaining(phrase);
        await until('ProseMirror receives editing focus', () => evaluate(
            'document.activeElement === document.querySelector(".ProseMirror")'
        ));
        const reachability = await until(`floating toolbar and Done reachable for ${phrase}`, () => evaluate(`(() => {
            const panel = document.querySelector('[aria-label="Font family"]')?.parentElement;
            const done = Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === 'Done');
            if (!panel || !done || getComputedStyle(panel).visibility !== 'visible') return false;
            const editor = document.querySelector('.ProseMirror');
            const panelRect = panel.getBoundingClientRect();
            const doneRect = done.getBoundingClientRect();
            return {
                inBody: document.body.contains(panel),
                inForeignObject: !!panel.closest('foreignObject'),
                inCanvasOverlay: !!panel.closest('[data-canvas-overlay="rich-text-toolbar"]'),
                editorFocused: document.activeElement === editor,
                position: getComputedStyle(panel).position,
                panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom },
                done: { left: doneRect.left, right: doneRect.right, top: doneRect.top, bottom: doneRect.bottom, height: doneRect.height },
                viewport: { width: innerWidth, height: innerHeight },
                hit: document.elementFromPoint(doneRect.left + doneRect.width / 2, doneRect.top + doneRect.height / 2) === done || done.contains(document.elementFromPoint(doneRect.left + doneRect.width / 2, doneRect.top + doneRect.height / 2)),
            };
        })()`));
        assert.equal(reachability.inBody, true, JSON.stringify(reachability));
        assert.equal(reachability.inForeignObject, false, JSON.stringify(reachability));
        assert.equal(reachability.inCanvasOverlay, true, JSON.stringify(reachability));
        assert.equal(reachability.editorFocused, true, JSON.stringify(reachability));
        assert.ok(['absolute', 'fixed'].includes(reachability.position), JSON.stringify(reachability));
        assert.equal(reachability.done.height, 40, JSON.stringify(reachability));
        assert.ok(reachability.done.left >= 0 && reachability.done.right <= reachability.viewport.width, JSON.stringify(reachability));
        assert.ok(reachability.done.top >= 0 && reachability.done.bottom <= reachability.viewport.height, JSON.stringify(reachability));
        assert.equal(reachability.hit, true, JSON.stringify(reachability));
        await clickDone();
        await until('Done closes the default-size editor', () => evaluate('!document.querySelector(".ProseMirror")'));
    }
    async function assertToolbarSize(phrase, expectedSize) {
        await openEditorContaining(phrase);
        await until(`Font size shows inherited ${expectedSize}px for ${phrase}`, () => evaluate(
            `document.querySelector('[aria-label="Font size"]').value === ${JSON.stringify(String(expectedSize))}`
        ));
        await clickDone();
        await until('Done closes the size inspection editor', () => evaluate('!document.querySelector(".ProseMirror")'));
    }
    async function activateMark(label, tag, phrase, activation) {
        await selectPhrase(phrase);
        await evaluate('window.__t10ToolbarActivations = []; window.__t10MouseSelection = null; window.__t10MouseSelectionAfterUp = null;');
        const selector = `button[aria-label="${label}"]`;
        if (activation === 'mouse') await click(selector);
        else {
            await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
            assert.equal(await evaluate('window.getSelection().toString()'), phrase, `${label} retains selection before ${activation}`);
            await press(activation);
        }
        await until(`${label} applied once to ${phrase}`, () => evaluate(`(() => {
            const editor = document.querySelector('.ProseMirror');
            const marked = Array.from(editor.querySelectorAll(${JSON.stringify(tag)})).filter(node => node.textContent === ${JSON.stringify(phrase)});
            return marked.length === 1 && window.__t10ToolbarActivations.length === 1;
        })()`));
        await until(`${label} settles with the same selected text and editor focus`, () => evaluate(`(() => {
            const editor = document.querySelector('.ProseMirror');
            return document.activeElement === editor && window.getSelection()?.toString() === ${JSON.stringify(phrase)};
        })()`));
        assert.equal(await evaluate('window.getSelection().toString()'), phrase, `${label} preserves browser selection`);
        if (activation === 'mouse') assert.equal(await evaluate('window.__t10MouseSelectionAfterUp'), phrase, `${label} preserves selection through mouseup`);
        assert.deepEqual(await evaluate('window.__t10ToolbarActivations'), [label], `${activation} dispatches one native click`);
        assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')`), 'true');
    }

    await evaluate(`(() => {
        window.__t10ToolbarActivations = [];
        window.__t10MouseSelection = null;
        window.__t10CanvasShortcutLeaks = [];
        document.addEventListener('mousedown', event => {
            if (event.target.closest('button')) window.__t10MouseSelection = window.getSelection()?.toString() ?? '';
        }, true);
        document.addEventListener('mouseup', event => {
            if (event.target.closest('button')) window.__t10MouseSelectionAfterUp = window.getSelection()?.toString() ?? '';
        }, true);
        document.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button) return;
            const label = button.getAttribute('aria-label') || button.textContent.trim();
            if (['Bold', 'Italic', 'Done'].includes(label)) window.__t10ToolbarActivations.push(label);
        }, true);
        window.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) || event.key.startsWith('Arrow')) window.__t10CanvasShortcutLeaks.push(event.key);
        });
    })()`);

    await assertDefaultSizeToolbarReachable('mouseBold');
    await assertDefaultSizeToolbarReachable('Explicit Inter');
    await assertToolbarSize('mouseBold', 50);
    await assertToolbarSize('Explicit Inter', 15);
    const defaultSizeLayers = (await readBoard()).document.layers;
    assert.deepEqual([defaultSizeLayers[textId].width, defaultSizeLayers[textId].height], [100, 100]);
    assert.deepEqual([defaultSizeLayers[noteId].width, defaultSizeLayers[noteId].height], [100, 100]);

    const defaultAndMarkedFonts = await evaluate(`(() => {
        const text = Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]')).find(node => node.textContent.includes('mouseBold'));
        const note = Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]')).find(node => node.textContent.includes('Explicit Inter'));
        const normalizeFamily = value => value.split(',').map(name => name.trim().replace(/^['"]|['"]$/g, '')).join(',');
        const expectedKalam = normalizeFamily(getComputedStyle(document.body).getPropertyValue('--font-kalam'));
        const expectedInter = normalizeFamily(getComputedStyle(document.body).getPropertyValue('--font-inter'));
        return {
            text: normalizeFamily(getComputedStyle(text).fontFamily),
            note: normalizeFamily(getComputedStyle(note).fontFamily),
            explicit: normalizeFamily(getComputedStyle(note.querySelector('span[style*="font-family"]')).fontFamily),
            expectedKalam, expectedInter,
        };
    })()`);
    assert.equal(defaultAndMarkedFonts.text, defaultAndMarkedFonts.expectedKalam, JSON.stringify(defaultAndMarkedFonts));
    assert.equal(defaultAndMarkedFonts.note, defaultAndMarkedFonts.expectedKalam, JSON.stringify(defaultAndMarkedFonts));
    assert.equal(defaultAndMarkedFonts.explicit, defaultAndMarkedFonts.expectedInter, JSON.stringify(defaultAndMarkedFonts));
    await openTextEditor();

    await selectPhrase('sizeOverride');
    await evaluate(`document.querySelector('[aria-label="Font size"]').focus()`);
    await pressCanvasKey('a', 2);
    await page('Input.insertText', { text: '30' });
    await until('explicit 30px size applied to selected text', () => evaluate(`(() => {
        const editor = document.querySelector('.ProseMirror');
        const span = Array.from(editor.querySelectorAll('span[style*="font-size"]')).find(node => node.textContent === 'sizeOverride');
        return span?.style.fontSize === '30px';
    })()`));
    await saved();
    await clickDone();
    await until('editor closed after explicit font size', () => evaluate('!document.querySelector(".ProseMirror")'));
    const withSize = richText.decodeRichText((await readBoard()).document.layers[textId].value);
    assert.ok(withSize.content.some(node => node.content?.some(item => item.text === 'sizeOverride' &&
        item.marks?.some(mark => mark.type === 'textStyle' && mark.attrs?.fontSize === '30px'))), 'Explicit font size is persisted on the selected text');
    await openTextEditor();

    for (const [label, tag, phrases] of [
        ['Bold', 'strong', ['mouseBold', 'enterBold', 'spaceBold']],
        ['Italic', 'em', ['mouseItalic', 'enterItalic', 'spaceItalic']],
    ]) {
        for (const [index, activation] of ['mouse', 'Enter', 'Space'].entries()) {
            await activateMark(label, tag, phrases[index], activation);
        }
    }

    await selectPhrase('canvasGuard');
    await saved();
    const beforeCanvasKeys = await readBoard();
    await pressCanvasKey('d', 2);
    await pressCanvasKey('z', 2);
    await pressCanvasKey('ArrowRight');
    assert.deepEqual(await evaluate('window.__t10CanvasShortcutLeaks'), [], 'Editing contains canvas shortcut key events');
    await saved();
    const afterCanvasKeys = await readBoard();
    assert.equal(afterCanvasKeys.document.layerIds.length, beforeCanvasKeys.document.layerIds.length, 'Ctrl+D does not duplicate the edited layer');
    for (const id of beforeCanvasKeys.document.layerIds) {
        const before = beforeCanvasKeys.document.layers[id];
        const after = afterCanvasKeys.document.layers[id];
        assert.deepEqual([after.x, after.y], [before.x, before.y], 'Arrow keys do not move board layers while editing');
    }

    for (const [activation, key] of [['mouse', null], ['Enter', 'Enter'], ['Space', 'Space']]) {
        if (!await evaluate('!!document.querySelector(".ProseMirror")')) await openTextEditor();
        await selectPhrase('doneMouse');
        await evaluate('window.__t10ToolbarActivations = []; window.__t10MouseSelection = null; window.__t10MouseSelectionAfterUp = null;');
        if (activation === 'mouse') await clickDone();
        else {
            await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Done').focus()`);
            assert.equal(await evaluate('window.getSelection().toString()'), 'doneMouse', `Done retains selection before ${activation}`);
            await press(key);
        }
        await until(`Done ${activation} activation closes the editor`, () => evaluate(
            '!document.querySelector(".ProseMirror") && window.__t10ToolbarActivations.length === 1'
        ));
        assert.deepEqual(await evaluate('window.__t10ToolbarActivations'), ['Done'], `${activation} dispatches Done exactly once`);
        if (activation === 'mouse') {
            assert.equal(await evaluate('window.__t10MouseSelection'), 'doneMouse', 'Mouse down starts with the selected text before Done');
            assert.equal(await evaluate('window.__t10MouseSelectionAfterUp'), 'doneMouse', 'Mouse up preserves the selection before Done');
        }
    }

    await openTextEditor();
    const pasteSelection = await evaluate(`(() => {
        const editor = document.querySelector('.ProseMirror');
        const selection = window.getSelection();
        selection.selectAllChildren(editor); selection.collapseToEnd();
        const view = editor.editor;
        const state = view.state;
        return {
            dom: { text: selection.toString(), anchor: selection.anchorNode?.textContent, anchorOffset: selection.anchorOffset, focus: selection.focusNode?.textContent, focusOffset: selection.focusOffset },
            model: { from: state.selection.from, to: state.selection.to, text: state.selection.$from.parent.textBetween(0, state.selection.$from.parent.content.size), document: state.doc.toJSON() },
            expectedEnd: state.doc.content.size - 1,
            focused: document.activeElement === editor,
        };
    })()`);
    t.diagnostic(`Paste selection immediately after DOM setup: ${JSON.stringify(pasteSelection)}`);
    if (pasteSelection.model.from !== pasteSelection.expectedEnd || pasteSelection.model.to !== pasteSelection.expectedEnd) {
        await evaluate(`document.querySelector('.ProseMirror').editor.commands.setTextSelection(
            document.querySelector('.ProseMirror').editor.state.doc.content.size - 1
        )`);
        await until('ProseMirror selection and DOM range settle at the intended paste insertion point', () => evaluate(`(() => {
            const editor = document.querySelector('.ProseMirror');
            const selection = window.getSelection();
            const model = editor.editor.state.selection;
            const end = editor.editor.state.doc.content.size - 1;
            return model.from === end && model.to === end && document.activeElement === editor &&
                selection?.isCollapsed && selection.anchorNode?.parentElement?.closest('.ProseMirror') === editor;
        })()`));
    }
    const pasteSelectionBeforeDispatch = await evaluate(`(() => {
        const editor = document.querySelector('.ProseMirror');
        const selection = window.getSelection();
        const state = editor.editor.state;
        return {
            dom: { text: selection?.toString(), anchor: selection?.anchorNode?.textContent, anchorOffset: selection?.anchorOffset, focus: selection?.focusNode?.textContent, focusOffset: selection?.focusOffset },
            model: { from: state.selection.from, to: state.selection.to, text: state.selection.$from.parent.textBetween(0, state.selection.$from.parent.content.size), document: state.doc.toJSON() },
            expectedEnd: state.doc.content.size - 1,
            focused: document.activeElement === editor,
        };
    })()`);
    t.diagnostic(`Paste selection immediately before dispatch: ${JSON.stringify(pasteSelectionBeforeDispatch)}`);
    assert.equal(pasteSelectionBeforeDispatch.model.from, pasteSelectionBeforeDispatch.expectedEnd, 'Paste model selection starts at the intended document end');
    assert.equal(pasteSelectionBeforeDispatch.model.to, pasteSelectionBeforeDispatch.expectedEnd, 'Paste model selection is collapsed at the intended document end');
    assert.equal(pasteSelectionBeforeDispatch.focused, true, 'ProseMirror is focused before paste');

    const pasteResult = await evaluate(`(() => {
        const editor = document.querySelector('.ProseMirror');
        window.__t10PastedScript = false;
        const clipboard = new DataTransfer();
        clipboard.setData('text/html', '<p><strong>SafePaste</strong><img src="x" onerror="window.__t10PastedScript=true"><script>window.__t10PastedScript=true</script></p>');
        clipboard.setData('text/plain', 'SafePaste');
        const event = new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true });
        editor.dispatchEvent(event);
        return { prevented: event.defaultPrevented, text: editor.textContent };
    })()`);
    assert.equal(pasteResult.prevented, true, 'The editor handles the synthetic clipboard paste');
    await until('safe paste inserted into the editor', () => evaluate(
        `document.querySelector('.ProseMirror')?.textContent.includes('SafePaste')`
    ));
    const pasteEvidence = await evaluate(`(() => {
        const editor = document.querySelector('.ProseMirror');
        const selection = window.getSelection();
        const state = editor.editor.state;
        return {
            script: document.querySelector('.ProseMirror script, .ProseMirror img[onerror]') !== null,
            executed: window.__t10PastedScript,
            bold: Array.from(editor.querySelectorAll('strong')).some(node => node.textContent === 'SafePaste'),
            html: editor.innerHTML,
            text: editor.textContent,
            domSelection: { text: selection?.toString(), anchor: selection?.anchorNode?.textContent, anchorOffset: selection?.anchorOffset, focus: selection?.focusNode?.textContent, focusOffset: selection?.focusOffset },
            model: { document: state.doc.toJSON(), selection: state.selection.toJSON() },
            editorFocused: document.activeElement === editor,
        };
    })()`);
    t.diagnostic(`Paste DOM/model evidence: ${JSON.stringify(pasteEvidence)}`);
    const pasteSafety = { script: pasteEvidence.script, executed: pasteEvidence.executed, bold: pasteEvidence.bold };
    assert.deepEqual(pasteSafety, { script: false, executed: false, bold: true });
    await saved();

    await selectPhrase('fontOverride');
    await evaluate(`document.querySelector('[aria-label="Font family"]').focus()`);
    await pressCanvasKey('ArrowUp');
    await until('Inter selected for explicit range', () => evaluate(
        `document.querySelector('[aria-label="Font family"]').value === "var(--font-inter)"`
    ));
    await press('Enter');
    await until('Inter mark saved into rich text', async () => {
        const current = await readBoard();
        const value = current.document.layers[textId].value;
        const decoded = richText.decodeRichText(value);
        return decoded?.content?.some(node => node.content?.some(item => item.text === 'fontOverride' &&
            item.marks?.some(mark => mark.type === 'textStyle' && mark.attrs?.fontFamily === 'var(--font-inter)')));
    });
    await saved();
    const withFont = await readBoard();
    const savedRichText = withFont.document.layers[textId].value;
    await clickDone();
    await until('editor closed before app history controls', () => evaluate('!document.querySelector(".ProseMirror")'));
    await click('button[aria-label="Undo (Ctrl+Z)"]');
    await until('app undo removes the last font mark', async () => {
        const decoded = richText.decodeRichText((await readBoard()).document.layers[textId].value);
        return !decoded?.content?.some(node => node.content?.some(item => item.text === 'fontOverride' &&
            item.marks?.some(mark => mark.type === 'textStyle' && mark.attrs?.fontFamily === 'var(--font-inter)')));
    });
    await saved();
    await click('button[aria-label="Redo (Ctrl+Shift+Z)"]');
    await until('app redo restores the saved font mark', async () =>
        (await readBoard()).document.layers[textId].value === savedRichText
    );
    await saved();
    await page('Page.reload', { ignoreCache: true });
    await until('saved rich text after reload', () => evaluate(
        'location.pathname.includes("/board/") && document.querySelector("[role=status]")?.textContent === "Saved"'
    ));
    try {
        await until('both expected read-only text containers render after reload', () => evaluate(`(() => {
            const readOnly = Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]'));
            return readOnly.some(node => node.textContent.includes('mouseBold')) &&
                readOnly.some(node => node.textContent.includes('Explicit Inter'));
        })()`));
    } catch (error) {
        const savedBoard = await readBoard();
        const reloadEvidence = {
            page: await evaluate(`({ pathname: location.pathname, saveStatus: document.querySelector('[role="status"]')?.textContent ?? null,
                renderedText: Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]')).map(node => node.textContent) })`),
            savedLayers: savedBoard.document.layerIds.map(id => ({ id, value: savedBoard.document.layers[id].value })),
        };
        throw new Error(`${error.message}; reload evidence: ${JSON.stringify(reloadEvidence)}`, { cause: error });
    }
    assert.equal((await readBoard()).document.layers[textId].value, savedRichText);
    const reloadedFonts = await evaluate(`(() => {
        const readOnly = Array.from(document.querySelectorAll('[role="textbox"][aria-readonly="true"]'));
        const text = readOnly.find(node => node.textContent.includes('mouseBold'));
        const note = readOnly.find(node => node.textContent.includes('Explicit Inter'));
        const textOverride = Array.from(text.querySelectorAll('span[style*="font-family"]')).find(node => node.textContent.includes('fontOverride'));
        const noteOverride = Array.from(note.querySelectorAll('span[style*="font-family"]')).find(node => node.textContent.includes('Explicit Inter'));
        const normalizeFamily = value => value.split(',').map(name => name.trim().replace(/^['"]|['"]$/g, '')).join(',');
        const family = element => normalizeFamily(getComputedStyle(element).fontFamily);
        const variable = name => normalizeFamily(getComputedStyle(document.body).getPropertyValue(name));
        return { text: family(text), note: family(note), textOverride: family(textOverride), noteOverride: family(noteOverride), kalam: variable('--font-kalam'), inter: variable('--font-inter') };
    })()`);
    assert.equal(reloadedFonts.text, reloadedFonts.kalam, JSON.stringify(reloadedFonts));
    assert.equal(reloadedFonts.note, reloadedFonts.kalam, JSON.stringify(reloadedFonts));
    assert.equal(reloadedFonts.textOverride, reloadedFonts.inter, JSON.stringify(reloadedFonts));
    assert.equal(reloadedFonts.noteOverride, reloadedFonts.inter, JSON.stringify(reloadedFonts));

    async function geometry(viewportWidth, phrase, expectedRows) {
        await page('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: 844, deviceScaleFactor: 1, mobile: false });
        await openEditorContaining(phrase);
        const metrics = await evaluate(`(() => {
            const panel = document.querySelector('[aria-label="Font family"]').parentElement;
            const controls = Array.from(panel.children).map(element => {
                const rect = element.getBoundingClientRect();
                return { top: Math.round(rect.top * 10) / 10, height: rect.height };
            });
            const rect = panel.getBoundingClientRect();
            return { controls, rows: new Set(controls.map(item => item.top)).size, left: rect.left, right: rect.right, viewport: innerWidth };
        })()`);
        assert.equal(metrics.controls.length, 6);
        assert.ok(metrics.controls.every(control => control.height === 40), JSON.stringify(metrics));
        assert.equal(metrics.rows, expectedRows, JSON.stringify(metrics));
        assert.ok(metrics.left >= 0 && metrics.right <= metrics.viewport, JSON.stringify(metrics));
        await clickDone();
        await until('editor closed after geometry sample', () => evaluate('!document.querySelector(".ProseMirror")'));
    }

    await geometry(1280, 'mouseBold', 1);
    await geometry(390, 'Explicit Inter', 2);
    const finalDimensions = (await readBoard()).document.layers;
    assert.deepEqual([finalDimensions[textId].width, finalDimensions[textId].height], [100, 100]);
    assert.deepEqual([finalDimensions[noteId].width, finalDimensions[noteId].height], [100, 100]);
    assert.deepEqual(context.exceptions, [], 'No uncaught browser exceptions');
    assert.deepEqual(context.networkFailures, [], 'No failed browser requests');
});
