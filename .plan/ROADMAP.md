# Roadmap

Status: epic directions accepted by the owner on 2026-10-30; detailed behavior,
complete estimates, priorities and execution order await alignment. This roadmap
serves replacement of paid Miro by migrating a representative personal board.
It authorizes no account access, real export/import or new dependency.

The [feature map](FEATURE-MAP.md) separates explicit requirements, UI observed
in private reference screenshots and additional **PROPOSED** candidates. It is
the detailed alignment companion to this roadmap, not a second execution queue.
Screenshots are references, not evidence of implementation in this fork.

## Delivered baseline

Local board CRUD, SVG drawing/shapes, basic text/notes, session-local undo/redo,
SQLite autosave/status/retry, PNG export and container packaging exist in source.
The focused browser check covers create, pointer drawing, undo, redo, downloaded
PNG, reload and application restart. All-shape workflows, rename/delete,
failed-save recovery and grouped drag history remain outside that test's
behavioral coverage. Delivery does not mean full Miro compatibility.

## Accepted epic directions — detailed planning pending

Directions below are accepted. Importance values and details remain proposals
for alignment, not an accepted schedule.
Points use the existing relative scale; `?` means investigation is needed.

| Outcome | Points | Importance | Status | Done |
| --- | --- | --- | --- | --- |
| Slim Docker packaging and remove hosted legacy backend remnants | ? | Medium | Optimization direction accepted; hosted-backend removal already accepted for the single-user architecture. Implementation plan and measurements pending; no cleanup in this documentation task | No |
| Durable assets and progressive image loading | ? | High | Direction accepted; storage/performance contract needs discovery | No |
| Representative structural export and coverage inventory | ? | High | Direction accepted; source access needs separate authorization | No |
| Large-board navigation and nested frames | ? | High | Direction accepted; existing 100-layer cap needs review | No |
| Shared object behavior and lock/unlock | ? | High | All-descendant parent protection and preserved individual child locks ACCEPTED; other mutation/history details PROPOSED | No |
| Link/product cards and shared extraction boundary | ? | High | Direction accepted; inspect existing extraction capabilities first | No |
| Repeatable importer, dry run and loss comparison | ? | High | Direction accepted; dependent on export/model discovery | No |
| Full-page table view over the same underlying data | ? | Medium | Direction accepted; interaction and model need refinement | No |
| Rich text, syntax-highlighted code and subtle gray grid | ? | Medium | Direction accepted; reference review recorded in FEATURE-MAP; details pending | No |

The former proposal totaled 65 points before expanded requirements. It is not
a complete estimate for this roadmap. The current total is unknown; do not
count unknown scope as zero or select an execution route from the old total.
These rows are discovery areas, not ready-to-dispatch tasks. Final tasks need
bounded scope, acceptance, dependencies and independent review.

## Required image behavior

Gradient placeholder -> low-resolution preview -> variant suited to actual
visible CSS size, device pixel ratio and zoom. Preserve aspect ratio, never
upscale past the original, cull off-screen objects and bound requests/cache.
Immediate zoom must not download every intermediate resolution serially.
Measure network traffic and browser memory; see [architecture](ARCH.md).

## Required canvas/content behavior

- Nested frames retain parent-child relationships; moving a frame moves its
  children. Undo/redo, persistence and migration must retain those relationships.
- A subtle gray grid supports navigation without altering authored coordinates.
- Text gains size, font choice, bold, italic and color without content loss.
- Board and full-page record-table views edit the same data, not copied
  representations. A rich-text table extension is a distinct capability.
- Common lock/unlock applies to code blocks, frames and other objects.
  **ACCEPTED:** a locked frame protects all contained descendants, including
  nested descendants. Unlocking it preserves individually locked elements.
  These requirements are not implemented. Mixed-selection, unlock gestures
  and other detailed behavior remain **PROPOSED**.
- Code blocks require font-size control and a line-number toggle in addition
  to lock/unlock; details are in the [feature map](FEATURE-MAP.md).
- Code blocks preserve source/whitespace and gain library-based syntax
  highlighting with lazy language/editor loading. No highlighter or rich editor
  is currently installed. Selecting an existing maintained library requires
  review; no custom lexer or new dependency is authorized by this roadmap.
- A URL capture can create a new extraction request without a prior saved item.
  Share functions/schema from the existing extension where appropriate; rendered
  DOM work still requires a browser. Evaluate fetch, extension and only then a
  justified bounded shared headless worker. No browser per card or cloned profile.

## Migration acceptance and documentation

Investigate official Miro Help backup/export/restore, PDF/SVG appearance,
CSV geometry loss and REST coverage gaps. Prefer discovering a minimal
read-only Web SDK structural exporter (`boards:read`) for preview-heavy boards;
see [source references and limitations](ARCH.md#proposed-migration--not-implemented).
No exporter/importer is implemented yet.

Preserve IDs, URLs, geometry, parents and assets; retain unknown records. Use a
representative sample, dry run and explicit loss report for images, connectors,
frames and unsupported types. Compare source, rendering and persisted output
before claiming fidelity. First imports should create new boards. Do not delete
source exports or retire the source service as an import side effect.

Document inspect/export/normalize/dry-run/import/verify commands only as they
are implemented and tested. A later local skill may reference that workflow;
it must not become a second migration engine. There is no migration command
or approved real-account operation in this documentation change.

## Additional candidates

Grouping, snapping, advanced alignment/search, schema versions, richer recovery,
portable editable exports and advanced table views/formulas remain **PROPOSED**
additions, not accepted initial scope. Existing multi-selection/duplication,
layer ordering and save/status/retry behavior must be distinguished from new
work. Use [the feature map](FEATURE-MAP.md) for open questions and proposed
acceptance scenarios. No implementation is dispatched by this document.
