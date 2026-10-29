# Miro Clone

A single-user whiteboard with local SQLite persistence, based on the existing
Miro drawing editor. Create boards, draw shapes and freehand strokes, edit text
and notes, undo/redo, and export PNG images. No accounts, credentials, or hosted
backend are required by the active application.

## Requirements

Node.js 22.13 or newer (built-in `node:sqlite`) and npm. Install the locked
packages with `npm ci`. Existing drawing/UI libraries are retained.

The standard Next.js commands remain `npm run dev`, `npm run build`, and
`npm start`. Run the application only in a trusted local environment: it has
no authentication or multi-user access boundary. This change does not include
deployment or a managed runtime.

## Local storage

Board titles and documents are stored in `data/miro.sqlite`, relative to the
application working directory. SQLite creates the directory/schema on first
use and may create adjacent `-wal` and `-shm` files. All three are ignored by
Git. Preserve the database when replacing source files. Do not delete it to
reset an installation containing wanted boards.

The editor shows Saving, Saved, or Save failed. Saves are serialized in edit
order; undo and redo also persist. Wait for Saved before reloading or leaving.
A failed save offers Retry save; the browser warns before leaving with pending
or failed writes. Reload restores saved document content; undo/redo history
is session-local. Multiple concurrent editor tabs are not supported.

## Verification

Read [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md). `just check` runs
TypeScript, ESLint, a production build and a focused real-browser test:

```sh
node --test --test-concurrency=1 tests/critical-editor.test.cjs
```

The direct test command needs a current build (`npm run build`); `just check`
includes that build. The test requires the existing `/usr/bin/chromium-browser`
and Node.js 22. It uses only Node builtins, including the test runner and CDP
communication over WebSocket. No browser-testing packages are installed.

The test creates a board through the UI, draws through real pointer input,
undoes and redoes the stroke, verifies a downloaded PNG, then checks reload
and application restart survival against a disposable SQLite database. Its
server binds only to loopback; its database, Chromium profile and downloads
live in a newly created temporary directory and are removed with its owned
processes after the test. This is synthetic test execution, not deployment.
`MIRO_SQLITE_PATH` selects an absolute database path for the disposable server;
normal execution keeps the default `data/miro.sqlite`.

Critical manual verification, when running the app is authorized:

1. Create a board and rename it.
2. Draw a freehand stroke and insert each supported shape/text/note.
3. Undo and redo; drag/resize and confirm one gesture is one history entry.
4. Export PNG and inspect the downloaded image.
5. Wait for Saved, reload, and confirm content, order, title and geometry.
6. Confirm a failed write remains visible and Retry save persists the latest
   document; verify deletion returns to the board list.

## Original project

Original implementation: [jatin1510/miro-clone](https://github.com/jatin1510/miro-clone),
following the [Code with Antonio](https://www.youtube.com/@codewithantonio)
whiteboard tutorial. Unused legacy hosted-service source remains in the
repository; active routes do not use it. Removing that source and its packages
requires a separately scoped cleanup.
