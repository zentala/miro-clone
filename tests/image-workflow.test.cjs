// Synthetic image workflow boundary checks; no user clipboard or browser profile.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

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
