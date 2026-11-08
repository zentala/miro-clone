# Miro migration: read-only structural export

## TLDR

`tools/miro-export` is a minimal Miro Web SDK v2 app that reads one board with
the `boards:read` scope and downloads a JSON package. It keeps every SDK record
verbatim and adds exact string IDs, geometry with its coordinate convention,
parent/group/connector relations, exact URLs, an image asset map, coverage and
explicit losses. It never writes to the board. It has run only on synthetic
fixtures; real-board fidelity is NOT_CHECKED until separately authorized access
exists. Normalization, dry run and import are later steps (E001-T16, T17).

## Pipeline position

```text
inspect -> structural export (this tool) -> normalization + dry run (T16)
        -> new-board import (T17) -> source/visual/persistence comparison
```

## Board-read surface

The smallest surface that exports structure, including link previews:

| Call | Scope | Purpose |
| --- | --- | --- |
| `miro.board.getInfo()` | `boards:read` | Board ID and timestamps |
| `miro.board.get()` | `boards:read` | All items, groups and tags on the board |
| `miro.board.ui.on('icon:click')`, `miro.board.ui.openPanel()` | none | Show the export panel |

The exporter calls no item method. Item methods such as `sync`, `setMetadata`,
`bringToFront`, `group`/`ungroup` and every `create*`, `remove`, `select`,
`setAppData` call need `boards:write` and are absent from the source; a test
fails if a board method outside `get`/`getInfo` appears. The app requests no
`boards:write`, `identity` or team scope and changes no sharing settings.

Proposed app manifest (not registered anywhere; registering it in a Miro
developer team is a separate, owner-authorized step):

```yaml
appName: Read-only board export
sdkVersion: SDK_V2
sdkUri: https://<host serving tools/miro-export>/index.html
scopes:
  - boards:read
```

## Running it (requires separate authorization)

1. Owner authorizes access to a named board and a Miro developer app.
2. Serve `tools/miro-export/` over HTTPS and install the app with the manifest
   above. Do not grant any other scope.
3. Open the board, click the app icon, press **Export board JSON**. The panel
   downloads `miro-export-<boardId>-<time>.json` and also shows the JSON for
   copying in case the iframe blocks downloads.
4. Store the file outside Git. Real exports, screenshots and credentials never
   enter this repository.

## Package format (`miro-clone.structural-export`, version 1)

| Field | Content |
| --- | --- |
| `source` | API `miro-web-sdk-v2`, scopes, raw `getInfo()` result |
| `coordinateConvention` | How `x`/`y` are measured (see below) |
| `records[]` | One per SDK item, in `get()` order: `id`, `sourceIndex`, `type`, `status`, `geometry`, `relations`, `urls`, `assetIds`, `raw` |
| `assets[]` | Image asset map: `assetId`, `itemId`, `url`, `title`, `alt`, retrieval method, `retrieved: false` |
| `coverage` | Totals by status and by type, with Web SDK/REST support per type |
| `losses[]` | Explicit loss and error entries |
| `context` | Capability table, its check date, non-structural formats |

Record status:

- `supported`: a known type whose fields the SDK exposes.
- `opaque`: SDK type `unsupported` (tables, code blocks, documents, kanban,
  emoji, mockups, strokes): position only, content not readable.
- `unknown`: a type the exporter does not know; raw record retained.
- `failed`: non-string or empty ID, missing type, duplicate ID or a non-object;
  raw data retained with the reason. A numeric ID is refused because Miro IDs
  exceed `Number.MAX_SAFE_INTEGER` and an exact ID cannot be guaranteed.

`raw` holds every data field the SDK returned (functions dropped, nothing
invoked). No record is dropped: `coverage.total` equals the number of items read.

## Coordinate convention

Values are exported as read; no conversion happens here.

- Unit: board units (dp) as reported by the SDK.
- `x`/`y` are the item center (`origin: "center"`); rotation pivots on it.
- `relativeTo: "canvas_center"`: measured from the board center (0, 0).
- `relativeTo: "parent_top_left"`: measured from the parent frame's top-left.
- `relativeTo: "parent_center"`: experimental in the SDK; kept as read.
- Connectors have no `x`/`y`; `geometry` is `null` and endpoints are item IDs.

T16 converts to absolute world coordinates using `parentId` and parent geometry.
The axis direction on a real board is NOT_CHECKED.

## Capability comparison (checked 2026-11-08)

Sources: [board items](https://developers.miro.com/docs/board-items),
[board reference](https://developers.miro.com/docs/websdk-reference-board),
[preview](https://developers.miro.com/docs/websdk-reference-preview),
[image](https://developers.miro.com/docs/websdk-reference-image),
[group](https://developers.miro.com/docs/websdk-reference-group), REST
"get items within frame" type list.

| Item | Web SDK read | REST read | Export handling |
| --- | --- | --- | --- |
| Sticky note, text, shape | Yes | Yes | HTML content and style raw; links extracted |
| Card, app card | Yes | Yes | Fields raw; links extracted |
| Image | Yes; bytes via `getFile("original")` | Yes | Asset entry; bytes not included |
| Embed | Yes | Yes | URL and preview URL |
| **Preview (link preview)** | **Yes, Web SDK only** | **No** | URL and geometry; rendered title/thumbnail not exported |
| Frame | Yes | Yes | `childrenIds`; children are separate records |
| Connector | Yes | Yes (connectors endpoint) | Endpoint IDs, shape, captions, style; no route points |
| Group | Yes (`itemsIds`) | Groups API (not reverified) | Membership relations |
| Tag | Yes | Yes (not reverified) | Record; items reference via `tagIds` |
| Mind map node | Experimental | No | Kept as supported raw |
| Unsupported items | Position only | No | `opaque` + loss entry |

Preview is the reason for the Web SDK route: REST cannot read link previews.
SDK coverage still does not promise full Miro fidelity.

## Loss entries

| Kind | When |
| --- | --- |
| `paint-order-unverified` | Always: `get()` order is not documented as z-order |
| `asset-not-retrieved` | Each image: bytes not in the package |
| `preview-metadata` | Each preview: Miro-rendered title/thumbnail not exported |
| `connector-route` | Each connector: route points not exported |
| `opaque-content` | Each `unsupported` item |
| `unknown-type` | Each unrecognized type |
| `failed-record` | Each malformed record, with source index and reason |
| `dangling-reference` | A parent, group, child, tag or connector endpoint not in the export |

Frames, connectors, images, previews and unsupported items always appear in
`coverage.byType`, with count zero when absent, so their handling is explicit.

## Keep originals; other export formats are not structure

Keep the downloaded package unchanged as the original; later steps write new
files and never edit or delete it. Keep any official Miro exports beside it.
They do not replace this package:

| Format | What it preserves | Why it is not editable structure |
| --- | --- | --- |
| PDF / SVG | Appearance | No items, IDs or relations |
| CSV | Text cells | Geometry, frames, connectors, images lost |
| Board backup (`.rtb`) | Restore inside Miro | Opaque, not portable editable JSON |

## Verification

`tests/miro-export.test.cjs` (part of `just check`) runs the exporter on the
synthetic fixture `tests/fixtures/migration/synthetic-source.json` and on a
seeded, generated 2,000-item board of SDK-like objects. It checks read-only
access, exact IDs, raw retention, geometry, relations, URLs, assets, coverage,
losses, empty/null/error inputs, malformed records and determinism.

NOT_CHECKED: a real Miro board; the panel inside the Miro iframe (including
downloads); SDK object shapes on a live board; REST rows marked "not
reverified"; axis direction.
