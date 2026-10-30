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

Node.js >=22.13 supplies built-in `node:sqlite`. SQLite stores board ID, title,
creation/update timestamps and a JSON document containing ordered layer IDs and
layer records. Supported layer types are rectangle, ellipse, freehand path,
text and note. Both editor and validation currently cap boards at 100 layers.
Concurrent editing tabs are unsupported; there is no revision conflict protocol.

The default database is `data/miro.sqlite` relative to the working directory;
`MIRO_SQLITE_PATH` can select an absolute path. WAL/SHM are runtime state. Keep a
consistent database backup, including uncheckpointed WAL as needed; no automated
backup/restore workflow is delivered here. PNG export uses the existing SVG
scene and `html-to-image`; it is not an editable board backup.

Active routes do not depend on Clerk, Convex or Liveblocks. Their unused source
and packages remain in the repository. The former Liveblocks auth endpoint
returns HTTP 410. The local API checks incoming Origin against validated request
protocol and incoming Host for mutating browser requests; it does not trust
forwarded host headers. This is not authentication or a multi-user boundary.

The Dockerfile retains `next start` and the full locked dependency tree on
Node 22, runs as non-root, binds inside the container to `0.0.0.0:3000`, and uses
`/app/data` for SQLite persistence. The image build is separate from deployment;
this repository does not establish a running service or public endpoint.

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

## Proposed migration — not implemented

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
