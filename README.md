# Miro Clone — personal SQLite fork

This is [zentala/miro-clone](https://github.com/zentala/miro-clone), a personal,
self-hosted fork of [jatin1510/miro-clone](https://github.com/jatin1510/miro-clone),
originally built from the [Code with Antonio](https://www.youtube.com/@codewithantonio)
whiteboard tutorial. The existing Next.js/React/SVG editor and drawing/UI
libraries are retained. This fork replaces the active hosted backend with
local SQLite for a single user; it is not an official Miro product or a promise
of full Miro compatibility.

## What changed from upstream

| Area | Upstream | This fork |
| --- | --- | --- |
| Identity | Clerk users and organizations | One local workspace, no accounts/authentication |
| Persistence | Convex board metadata and Liveblocks editor storage | Same-origin Next.js board API and server-side SQLite |
| Collaboration | Liveblocks rooms/presence/history | Single-user editing and session-local undo/redo |
| Operations | Hosted backend configuration | Node >=22.13, local database, optional container packaging |

**Breaking architecture change:** hosted accounts, organization IDs, board
records and room state are not automatically migrated. Existing hosted data
cannot be opened by simply pointing the local API at the old backend. Multiple
users, collaboration and concurrent editor tabs are unsupported. Legacy SDK
packages/files remain, but active application paths require no Clerk, Convex
or Liveblocks account or credentials. See the
[architecture decision](.plan/ADR/0001-single-user-sqlite.md).

The current editor supports boards, shapes, freehand strokes, basic text/notes,
undo/redo, durable document saves and PNG export. Images, link/product cards,
frames, rich text, code blocks, table views and migration tooling are future
requirements, not delivered features. The current editor/validation cap is
100 layers per board.

Product documentation: [purpose](.plan/PURPOSE.md), [vision](.plan/VISION.md),
[architecture](.plan/ARCH.md), [proposed roadmap](.plan/ROADMAP.md) and
[changelog](CHANGELOG.md). Future functions follow migration of a representative
board; proposed work is not approval to access or import a real account.

## Requirements

Node.js 22.13 or newer (built-in `node:sqlite`) and npm. Install the locked
packages with `npm ci`. Existing drawing/UI libraries are retained.

The standard Next.js commands remain `npm run dev`, `npm run build`, and
`npm start`. Run the application only in a trusted local environment: it has
no authentication or multi-user access boundary. Container packaging is available, but
a built image does not establish deployment or a managed runtime.

## Local storage

Board titles and documents are stored in `data/miro.sqlite`, relative to the
application working directory. SQLite creates the directory/schema on first
use and may create adjacent `-wal` and `-shm` files. All three are ignored by
Git. `MIRO_SQLITE_PATH` can select a different absolute database path. The
container uses `/app/data/miro.sqlite` and persists `/app/data` as a volume.
Preserve a consistent database backup and any uncheckpointed WAL; PNG export
is not an editable board backup. Preserve the database when replacing source files. Do not delete it to
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

## Legacy integrations

Unused hosted-service source and packages remain in the repository. Removing
them requires a separately scoped usage review and cleanup; no dual-backend
runtime mode is provided.
