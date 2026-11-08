# Architecture

## Implemented baseline

The application is Next.js 14 with React 18 and an SVG editor. The browser opens
boards through `app/board/[boardId]/page.tsx`; `LocalBoardProvider` owns a local
`BoardStore`. That store holds selection, drawing state and session-local
undo/redo history. Document-changing mutations enqueue full JSON snapshots for
serialized same-origin saves; cursor/selection-only changes do not save.

The active persistence path is:

```text
Dashboard/editor -> /api/boards and /api/boards/[boardId]
                 -> lib/boards.ts -> lib/sqlite.ts -> SQLite
```

Node.js >=22.18 supplies built-in `node:sqlite` and default TypeScript type
stripping, which the migration scripts use (E001-T16). SQLite stores board ID, title,
creation/update timestamps and a JSON document containing a schema version,
ordered layer IDs and layer records (see
[document schema versions](#document-schema-versions-e001-t03)). Supported layer types are rectangle, ellipse, freehand path,
text and note. Editor and validation share one limit, `MAX_LAYERS` = 5,000 layers
(measured in E001-T07, see [measured browser capacity](#measured-browser-capacity-e001-t07)).
Concurrent editing tabs are unsupported; there is no revision conflict protocol.

The default database is `data/miro.sqlite` relative to the working directory;
`MIRO_SQLITE_PATH` can select an absolute path. WAL/SHM are runtime state. Keep a
consistent database backup, including uncheckpointed WAL as needed; no automated
backup/restore workflow is delivered here. PNG export uses the existing SVG
scene and `html-to-image`; it is not an editable board backup.

Clerk, Convex and Liveblocks source and packages were removed in E001-T02; the
former Liveblocks auth endpoint remains only as an HTTP 410 stub. Remaining
remnants (env keys, orphan helpers, unused packages and public assets) belong
to E001-T24. The local API checks incoming Origin against validated request
protocol and incoming Host for mutating browser requests; it does not trust
forwarded host headers. This is not authentication or a multi-user boundary.

Since E001-T02 the Dockerfile builds on Node 22 and ships only the traced Next.js
standalone server (`node server.js`, image about 267 MB instead of 912 MB). Next
image optimization is off (`images.unoptimized`), because image processing
belongs to `@napi-rs/image` in T04/T06. The container runs as non-root, binds
inside to `0.0.0.0:3000` and keeps SQLite in the `/app/data` volume, which
survives container replacement. `just container-check` runs the six UI steps
against a disposable container. The image build is separate from deployment;
this repository does not establish a running service or public endpoint.

## Source baseline (E001-T01, 2026-11-08)

TLDR: five numeric layer types, two separate 100-layer caps, whole-document
snapshot history and one full-document save per mutation. No version, parent,
lock, zoom or asset model exists. Measured costs below show why the shared
model must stop cloning and saving the whole document on every pointer move.

Measured against `ebab7f1` by reading source; nothing was built or rendered.

| Area | Current source | Evidence |
| --- | --- | --- |
| Layer types | Numeric enum: Rectangle 0, Ellipse 1, Path 2, Text 3, Note 4; every layer has x/y/width/height/fill and optional `value` | `types/canvas.ts:12-18`, `:20-69`, `:134-139` |
| Document | `{ layerIds, layers }`, no version field; paint order is `layerIds` | `types/board.ts:3` |
| Validator | Rejects >100 IDs, type outside 0..4, missing fill; path 2..100000 points | `types/board.ts:22`, `:29-33`, `:34-35` |
| Editor cap | `MAX_LAYERS = 100`; insert, pencil and duplicate return silently at the cap | `canvas.tsx:51`, `:96-98`, `:211`, `:397-399` |
| Storage | One `boards` table, document as TEXT JSON, WAL | `lib/sqlite.ts:16-21`, `lib/boards.ts:9`, `:25-28` |
| History | `mutate` deep-clones before, compares two `JSON.stringify` results, pushes whole snapshot; max 100 past entries; `pause()` groups a drag/resize into one entry | `store/use-board-store.ts:71-90`, `:83`, `:50-51` |
| Saves | Every changing mutation enqueues a full-document PATCH; queue is serial, not coalesced, so each pointer move of a drag sends one PATCH | `store/use-board-store.ts:87`, `:92-106`; drag path `canvas.tsx:120-144`, `:296-297` |
| Undo/redo | Restores a snapshot and saves it; selection is presence, not history | `store/use-board-store.ts:52-70` |
| Camera | `{x, y}` only; pointer mapping subtracts camera; wheel pans | `types/canvas.ts:7-10`, `lib/utils.ts:32-40`, `canvas.tsx:278-285`, `:566-569` |
| Selection | Net selects only fully contained layers; resize only for a single non-path layer | `lib/utils.ts:110-115`, `selection-box.tsx:16-24`, `canvas.tsx:257` |
| Rendering | `useStorage` builds a new `Map` of all layers per call; each `LayerPreview` calls it | `hooks/use-local-board.ts:11-14`, `layer-preview.tsx:21` |
| Text/notes | `react-contenteditable` stores HTML in `value`; font size derived from box size; Kalam | `text.tsx:8`, `:20-27`, `:61`; `note.tsx:8`, `:63` |
| Context menu | None in app, components or hooks (grep for `contextmenu` found nothing) | — |

Mutation entry points that a lock rule would have to guard today (12):
insert `canvas.tsx:85`, translate `:120`, pencil `:203`, resize `:244`,
duplicate `:391`, keyboard move `:425`, bring-to-front/back
`selection-tools.tsx:25`, `:47`, fill `:66`, delete `hooks/use-delete-layers.ts:6`,
text edit `text.tsx:37`, note edit `note.tsx:37`.

Observed by reading source, not reproduced in a browser (NOT_CHECKED):
- A plain `z` key falls through into the `ArrowUp` case and moves the
  selection 5 px up (`canvas.tsx:498-511`, no `break` outside the Ctrl branch).
- Reset-camera button shows only when both x and y are non-zero (`canvas.tsx:548`).
- Stored text/note HTML is rendered as HTML (`text.tsx:61`, `note.tsx:63`) and
  the validator only checks it is a string (`types/board.ts:33`). Imported
  content must be sanitized before it reaches this path.
- Fonts come from `next/font/google` (`app/layout.tsx:7`, `text.tsx:8`,
  `info.tsx:21`): self-hosted at runtime but downloaded at build time.

### Measured synthetic cost (Node v22.22.3, i5-12600K)

A scratch script (not committed) built synthetic documents and timed one
mutation's work as the store does it: clone, two stringify calls for the
change check, clone and stringify for the save body.

History counts 101 snapshots (100 past entries plus the current document);
sizes are rounded to one decimal (T01 verifier F1 corrected the 1000-point row
in E001-T07: 285 MiB / 101 = 2.82 MiB).

| Document | JSON size | 100-step history (JSON equivalent) | Per mutation |
| --- | ---: | ---: | ---: |
| 100 rectangles | 12.8 KiB | 1.3 MiB | 0.33 ms |
| 100 notes | 15.7 KiB | 1.6 MiB | 0.38 ms |
| 100 paths × 200 points | 576.8 KiB | 56.9 MiB | 17.6 ms |
| 100 paths × 1000 points | 2.8 MiB | 285 MiB | 101 ms |
| 1000 notes (over cap) | 158.9 KiB | 15.7 MiB | 2.8 ms |
| 5000 notes (over cap) | 803.1 KiB | 79.2 MiB | 16.5 ms |

Freehand points dominate. At 5000 objects one mutation already takes a full
60 Hz frame before React renders, and a drag sends one such document per
pointer move. Browser render, network and heap baselines are NOT_CHECKED:
this worktree has no installed dependencies and installing them is outside
T01. T07 captures them with the existing CDP harness before changing code.

## Recommended shared-model boundary (proposal for T03)

Two options were compared inside the accepted React/SVG/SQLite fork. Replacing
the renderer, editor, product or stack is out of scope.

| | Minimal per-component patches | Shared versioned-object extension (recommended) |
| --- | --- | --- |
| New types | Widen union and hard-coded `0..4` check per type; image has no `fill` but validator requires it (`types/board.ts:29-31`) | Common envelope validated once, per-type validator registry |
| Frames | Containment computed from geometry; ambiguous for overlap | Explicit `parentId`, cycle check, reparent without coordinate change |
| Locks | Guard each of the 12 entry points above, plus future ones | One guard in `BoardStore.mutate` (`store/use-board-store.ts:71`) for every route |
| Old boards | Unversioned; future fields silently accepted or rejected | `version` field; explicit upgrade of unversioned docs at decode (`lib/boards.ts:9`); refuse unknown future versions |
| Assets | Tempting to inline data URLs into the document | Asset ID references only; binaries outside the JSON |

Recommended boundary, all within existing files:
1. Document: add `version`; keep `layerIds` as global paint order and layer IDs
   as stable strings; upgrade v1 (`types/board.ts:3`) at decode.
2. Layer envelope: shared optional `parentId` and own `locked` bit; keep the
   numeric enum append-only so stored values stay valid (`types/canvas.ts:12`).
3. Coordinates: keep absolute world coordinates (today's model). Moving a frame
   moves descendants in the same mutation; reparenting changes no coordinates,
   so no jumps. Frame-relative coordinates stay a T03/T08 alternative.
4. Mutation guard: `mutate` checks effective lock (own bit or any locked
   ancestor) and parent invariants before committing, so toolbar, keyboard and
   pointer routes share one rule.
5. History and saves: keep snapshot history for now, but T03/T07 must coalesce
   saves per gesture (save on `history.resume`) and replace the double
   stringify change check. Structural sharing is a T07 option if measurement
   requires it.
6. Rendering: replace the `layer-preview.tsx` switch with a type registry and
   subscribe per layer instead of rebuilding a `Map` per call.

## Document schema versions (E001-T03)

TLDR: board documents carry `schemaVersion`; unversioned rows are version 1 and
are upgraded in memory on read. Version 2 adds optional `parentId` and an own
`locked` bit per layer. Newer versions are refused and never overwritten. No
SQL table or column changed.

- **Field name.** `schemaVersion`, not the `version` proposed above, so a later
  revision or conflict counter cannot be confused with the schema.
- **Upgrade path.** `lib/document-migrations.ts` holds one pure step per version
  (v1 -> v2 only adds the field). `lib/boards.ts` upgrades on every read and
  writes v2 only on the next accepted save; opening a board never rewrites it.
  Unversioned submissions from an old client are upgraded, not refused.
- **Validation boundary.** `lib/document-version.ts` validates the current
  version once for server and store. Error codes separate `duplicate-id`,
  `missing-reference` (paint order, record or parent), `cycle` (including
  self-parent), `unsupported-record` (unknown layer type), `unsupported-version`
  and `invalid-schema`. PATCH returns 400 with the code; the last accepted
  document stays stored.
- **Unreadable stored rows.** GET and every PATCH (title included) of a row this
  version cannot read return 409 with the code; title, payload text and
  `updated_at` stay byte-identical. The list keeps the row with `document: null`
  and `documentError`. DELETE still works.
- **Relations.** Layer keys remain the stable IDs; `layerIds` stays global paint
  order; coordinates stay absolute. Any existing layer may be a parent until
  T08 restricts parent kinds. `isEffectivelyLocked` walks every ancestor;
  inherited protection is computed, never written into a child's own bit.
  Enforcing locks on mutations is T09.
- **Store.** `BoardStore.mutate` runs the shared relation check before history
  and save; a violating mutation rolls back and throws. Deleting a parent moves
  its children up one level with unchanged geometry. T08 may replace this with
  an accepted frame-delete policy.
- **Rollback.** The pre-version app (commit `81211c9`) accepts v2 documents
  because its validator ignores unknown fields and returns them unchanged, so it
  saves `schemaVersion`, parents and lock bits back intact; it does not enforce
  them. Restoring a pre-upgrade database copy reopens with identical content.
  Both are tested on synthetic copies in `tests/document-model.test.cjs`.
- **Next version.** A new layer type or field bumps `CURRENT_SCHEMA_VERSION`,
  adds an upgrade step and extends the type registry, so an older app refuses
  the document instead of dropping the unknown record.

## Measured browser capacity (E001-T07)

TLDR: measured in a real browser before and after the change. The old renderer
could not use 2,000 objects (about 1 s per frame); after T07, 2,000 objects open in
about 0.5 s and pan at one frame (16.7 ms) at every zoom, and an edit costs 5–7 ms
of store work. Proposed limit for PO: 5,000 objects. Edits still re-render every
layer (about 0.2 s at 2,000), which misses the 100 ms undo target.

Script: `tests/capacity/measure-capacity.cjs` (`just measure-capacity`), generated
seeded boards of today's five layer types (`tests/lib/synthetic-board.cjs`;
notes 35 %, text 25 %, rectangles 15 %, ellipses 10 %, paths 15 % with 50–200
points). No images, frames, cards, code or tables exist yet, so W2/W3 here cover
object count only. Headless Chromium on mITX (i5-12600K class, Fedora 44), Node
v22.22.3, production build, loopback server. Frame times come from
`requestAnimationFrame` (16.7 ms = one 60 Hz frame); key move "sync" is the store
work inside the key handler, "frame" is until the next painted frame.

Before (2026-11-08, zoom did not exist, so only zoom 1):

| Run | Objects | Result |
| --- | ---: | --- |
| A, unchanged | 100 | Opens in 0.06–0.3 s; pan p95 16.7 ms; store work 2–4 ms; one drag = 20 saves, 609 KiB |
| A, unchanged | 2,000 / 10,000 | Refused at read: HTTP 409 `invalid-schema` (100-layer cap) |
| B, both caps raised only | 2,000 | Opens 1.0–1.6 s; pan p95 0.8–2.3 s; store work 48–104 ms; one drag = 20 saves, 13.9 MiB |
| B, both caps raised only | 10,000 | No case finished in 14 min at 1920×1080, DPR 2; stopped |

After (all three viewports × DPR 1/1.25/2 for 100 and 2,000; seven zoom levels):

| Objects | Viewports × DPR | First view | Store work | Edit/undo to frame | Saves per drag | Pan p95, zoom 0.05–4 |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 100 | all 9 | 0.07–0.18 s | 0.5–0.7 ms | 21–32 ms | 1 (30 KiB) | 16.7 ms everywhere |
| 2,000 | all 9 | 0.43–0.52 s | 5–15 ms | 210–360 ms | 1 (710 KiB) | 16.7 ms everywhere |
| 5,000 | 1920×1080, DPR 2 | 1.2 s | 12.7 ms | 0.54 s | 1 (1.6 MiB) | 33 ms (50 ms at 0.05) |
| 10,000 | 1920×1080, DPR 2 | 2.2 s | 26 ms | 1.1 s | 1 (3.3 MiB) | 33–67 ms; heap 539 MiB |

Against the proposed thresholds at W2 (2,000, 1920×1080, DPR 2): first view
0.43 s (≤ 2 s, met), pan p95 16.8 ms (≤ 33 ms, met), saves per gesture 1 (met),
store work 6 ms (≤ 8 ms, met), undo to rendered result 216 ms (≤ 100 ms, **not
met**), save body 710 KiB (≤ 1 MiB, met). Image metrics wait for T04/T06.

PROPOSED limit (PO decides): 5,000 objects. W2 fits with 2.5× headroom; at
5,000 the board still opens in 1.2 s and pans at about 33 ms, while 10,000 misses
the first-view and pan targets and edits take over a second. Undo and drag
frames above 100 ms remain until layers subscribe individually (recommended
boundary item 6) — the next step, not part of T07.

What changed to get there:
- `useStorage` builds one layer map per store change instead of one per layer
  component (was quadratic); cursor-only presence no longer re-renders the board;
  layer components get a stable pointer handler, so pan and zoom skip them.
- `BoardStore` edits are copy-on-write: a mutation copies only the layers it
  writes, history entries share untouched layers, and the change check compares
  only written layers (replaces the double `JSON.stringify`, recommended item 5).
- Changes during a drag or resize are saved once, when the gesture ends.

## Camera, zoom and grid (E001-T07)

The camera `{ x, y, zoom }` is view state only: never saved, never in history.
Screen = world × zoom + (x, y). Plain wheel pans; Ctrl/⌘ + wheel or a trackpad
pinch zooms about the pointer; the zoom panel steps through 5–400 % about the
viewport centre. Pointer input maps through `screenToWorld` and keeps world
coordinates to two decimals. Selection handles and outlines keep their screen
size. The dot grid is a CSS background of the workspace, outside the SVG, so it
can be neither saved, hit nor exported. PNG export uses the layers' world bounds
and drops the camera transform: pan and zoom never change the image (size still
follows the viewport and device pixel ratio, as before).

## Representative workload and proposed thresholds

No real board was accessed. Counts are generated, deterministic (seeded) and
PROPOSED; T15 structural counts from an authorized sample recalibrate them.

| Workload | Objects | Images (generated originals) | Other content |
| --- | ---: | --- | --- |
| W1 cap | 100 | 0 | Today's five types; runs on current code |
| W2 representative | 2,000 | 800: JPEG/PNG/WebP, 0.3–24 MP, aspect 1:4–4:1, ~1.5 GB originals | 300 website/product cards, 500 text/notes, 150 shapes/paths, 60 frames nested to depth 3, 40 code blocks, 5 tables × 50 rows |
| W3 stress | 10,000 | 3,000 | Same mix scaled; finds the breaking point, not a pass bar |

Viewports: 1280×900 (existing test, `tests/critical-editor.test.cjs:151`),
1920×1080 and 2560×1440. DPR 1, 1.25, 2. Zoom 0.05, 0.1, 0.25, 0.5, 1, 2, 4.

Scenarios: open at fit-to-content; fast pan across the board; jump from 0.1 to
2 on an image cluster; zoom back out; drag a frame with 50 descendants; 20
undo/redo steps; reload; full process restart.

Metrics: first rendered view time; requests and bytes per scenario; original
fetches; peak in-flight image requests; JS heap and decoded image memory (CDP);
p95 frame time while panning; PATCH count and bytes per gesture; per-mutation
time; SQLite and asset directory size.

PROPOSED thresholds (W2, 1920×1080, DPR 2, reference machine i5-12600K;
PO accepts them with T01):

| Metric | Proposed bound |
| --- | --- |
| First rendered view | ≤ 2 s from navigation with placeholders; previews ≤ 4 s |
| Pan p95 frame time | ≤ 33 ms |
| Original image fetches during navigation | 0 |
| In-flight image requests | ≤ 8 |
| Decoded image memory | ≤ 512 MiB |
| Bytes for the first view at fit-to-content | ≤ 8 MB |
| Saves per drag/resize gesture | 1 |
| Document save body | ≤ 1 MiB, no image bytes |
| Per-mutation store work | ≤ 8 ms |
| Undo/redo step | ≤ 100 ms to rendered result |

## Accepted component directions — detailed design pending

The owner has accepted epic directions; [the feature map](FEATURE-MAP.md)
records required behavior separately from observed reference UI and additional
proposals. Screenshots are private references, not running application evidence.
The current layer model has no frames, lock state, images/cards, code blocks
or record tables. Future components need model and migration alignment before
implementation; no schema/API/editor change is made by this planning update.

Common lock/unlock for frames, code and other objects is required.
**ACCEPTED requirements:** a frame lock protects all contained descendants,
including nested descendants; unlocking the frame preserves each element's
individual lock. This is a required future behavior, not implemented code.
Mixed-selection refusal, unlock gestures, mutation restrictions and history
semantics remain **PROPOSED**; the wider shared-model contract is not settled.
Code font size and line-number toggle are explicit requirements. Record tables
need embedded and full-page views over the same data; rich-text tables are a
separate capability. Editor/highlighter/grid-library selection remains open.

The image, extraction and migration sections below retain design proposals;
accepting the direction does not accept every implementation detail. This
architecture and [roadmap](ROADMAP.md) use the same map for alignment, without
a parallel queue or ready-to-execute work packages.

## Proposed image pipeline — not implemented

Store originals and derived variants as durable files and asset metadata in
SQLite. Do not embed image binaries in every document snapshot. Design a
consistent backup of database plus assets before enabling real imports.

Render a metadata-derived gradient placeholder, then a low-resolution preview,
then a variant matched to actual displayed CSS size times device pixel ratio.
Zoom changes the displayed dimensions; do not multiply zoom twice. Preserve
aspect ratio and never upscale beyond the original. Candidate long-edge sizes
from the draft (128, 256, 512, 1024, 2048 pixels) require measurement, not adoption
as a fixed storage contract.

Cull off-screen objects; bound in-flight requests, stale work and decoded-image
cache/memory. On immediate zoom-in, select the needed variant instead of
serially fetching every intermediate size. Keep the previous preview until
replacement decoding completes. Normal navigation must not fetch originals
merely because a high-resolution export might later be requested. Measure
network bytes, variant choice and browser memory during fast zoom/pan on
representative boards and high-DPI displays.

## Proposed extraction boundary — not implemented

A pasted URL can initiate extraction without any previously saved record.
Inspect reusable extraction functions/schema from `zntl-chrome` before selecting
an integration. Share normalized metadata and reusable parsers where possible;
DOM-dependent code still needs a browser/document and is not automatically
usable as a Node-only import. There is no extraction integration in this source.

Consider ordinary fetch/structured data first, extension-based capture when a
rendered DOM is needed, and a bounded shared headless worker only if justified.
Never launch a browser per card, clone the user's browser profile or bypass
access controls. Bound jobs and concurrency; define pending, offline,
unsupported and error states. Keep exact URLs/product variants and local asset
copies where permitted. Choose transport/access boundaries during discovery;
this document creates no service or account permission.

## Migration — partly implemented

The read-only structural exporter (E001-T15) is implemented; its usage and
limits are in [docs/migration.md](../docs/migration.md). Normalization and
the dry-run loss report (E001-T16) are implemented, also documented there;
import (T17) is not implemented yet.

Use a representative sample: official backup/export/restore investigation ->
structural export -> normalization -> dry run/loss report -> new-board import ->
source/visual/persistence comparison. PDF/SVG may preserve appearance without
editable structure; assess CSV geometry loss and REST coverage gaps explicitly.
Do not assume an RTB backup is portable editable JSON.

Prefer investigating a minimal read-only Miro Web SDK app using `boards:read`
for structural export. Official [Preview documentation](https://developers.miro.com/docs/preview-1)
limits preview items to the Web SDK; [REST coverage](https://developers.miro.com/docs/miro-rest-api-introduction)
does not provide Preview read support. SDK use still does not promise complete
fidelity; check the [board-item support matrix](https://developers.miro.com/docs/board-items).
Preserve source IDs as strings, geometry, parents/groups, original URLs, asset
mapping and unsupported raw records. Include images/connectors/frames in the
loss report; never silently discard unknown items.

Retries should not duplicate imported items. New-board import is the proposed
safe default; merge/update policy is unresolved. Real-data operations need a
committed script, a fresh backup and separately authorized source access. Keep
private exports and all operational/account material out of public history.

See [the architecture decision](ADR/0001-single-user-sqlite.md) and
[proposed roadmap](ROADMAP.md).

## Durable assets (E001-T04)

TLDR: original images are stored as files beside the SQLite database and
registered in an `assets` table; documents reference them by ID only. The ID
is the SHA-256 of the original bytes. Ingestion publishes metadata only after
the file is durably in place, and nothing deletes stored data automatically.

- **Location.** The data root is the directory of the SQLite file
  (`data/` by default, `/app/data` in the container volume). Originals live at
  `assets/<first two hex chars>/<id>`, temporary writes at
  `assets/.incoming/<uuid>.part`. Bytes are stored unchanged (no EXIF
  rotation or re-encoding). `/data/assets/` is ignored by Git.
- **Table.** `assets(id, media_type, byte_size, width, height, created_at)`,
  created with `CREATE TABLE IF NOT EXISTS` beside `boards`; no board column
  changed. The SHA-256 ID makes uploads idempotent and lets the report verify
  file integrity.
- **Validation.** PNG, JPEG and WebP only, up to 50 MiB. Magic bytes must
  match the declared `Content-Type`, and `@napi-rs/image` (MIT) must decode
  the content as the same format; its memory limit refuses decompression
  bombs. GIF is refused because the bundled decoder build has no GIF codec;
  SVG is refused as active content. An asset ID must be 64 lowercase hex
  characters; the file path is derived only from it, so traversal is refused
  (400) before any filesystem access.
- **API.** `POST /api/assets` takes the raw bytes (same-origin guard as the
  board routes) and answers 201 (stored) or 200 (same bytes already stored);
  400 empty, 413 too large, 415 wrong or unsupported type, 422 undecodable.
  `GET /api/assets/<id>` serves the original with its stored type, `nosniff`,
  a sandbox CSP and an immutable cache header; 404 unknown, 500
  `data-missing` when the row exists but the file is gone or has the wrong
  size. `GET /api/assets` returns the read-only consistency report.
- **Document references.** A layer refers to an asset through an `assetId`
  string. `lib/boards.ts` refuses a save whose `assetId` has no metadata row
  (400 `missing-reference`), so a stored document never names unpublished
  data. No layer type uses the field yet: T05 adds the image layer, declares
  the field in the layer types and bumps the schema version as the document
  schema section requires.

### Ingestion order and recovery

1. Validate and decode in memory; nothing is written for a refused upload.
2. Write `assets/.incoming/<uuid>.part`, fsync, rename to the canonical path,
   fsync the directory. A failed call removes only its own temp file.
3. Insert the metadata row. This is the publication point: the API returns
   the ID only after it, and saves accept the ID only after it.

| Interruption | State left | Report entry | Recovery |
| --- | --- | --- | --- |
| Before rename (crash, full disk) | Temp file only | `deletable` | Delete the listed `.part` files by hand; they were never published |
| After rename, before the row | Intact file, no row | `unregistered` (`intact: true`) | Upload the same original again; it registers the existing file |
| File lost or damaged later (disk fault, database restored without files) | Row, no valid file | `missing` with the referencing boards | Restore the file from a backup taken with the database (T18), or upload the same original again; serving returns 500 `data-missing` until then |
| Edited outside the app | Board names an unregistered ID | `danglingReferences` | Upload the original, or restore the matching database copy |

**Unused is not deletable.** `unused` lists registered, intact assets that no
stored board references. They stay: an open editor's undo history, a later
import or an older backup may still need them, and removing one would turn
those references into missing data. Only `deletable` entries (temp files that
were never published) are safe to remove, and only by hand. Any future orphan
cleanup needs a committed script, a fresh backup of database and assets, and
its own approval. The report hashes every file, so its cost grows with the
total asset size (not measured).

**Container.** The Dockerfile needs no change: assets follow
`MIRO_SQLITE_PATH` into the `/app/data` volume, and the standalone trace
copies `@napi-rs/image` with its Linux x64 glibc binary (22 MB). The image
measured 309,854,801 bytes in `just container-check` (2026-11-08), up from
about 267 MB.

**Backup.** Database and asset files must be copied together; a database copy
newer than its asset copy shows up as `missing`. Coordinated backup and
restore belong to T18.
