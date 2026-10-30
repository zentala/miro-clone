# Roadmap

Status: epic directions accepted by the owner on 2026-10-30. The
[canonical umbrella plan](epics/E001-2026-10-30-personal-whiteboard/PLAN.md)
now breaks them into 22 pending tasks with 155 indicative points. Full size >40
selects AO; execution is not dispatched and runtime readiness is NOT_CHECKED.
No real source access, product change or production activation is authorized.

The [feature map](FEATURE-MAP.md) separates requirements, observed reference UI
and additional PROPOSED candidates. Detailed defaults/library choices remain
open where marked; screenshots are private references, not implementation.
The [handoff](epics/E001-2026-10-30-personal-whiteboard/HANDOFF.md) and task
records own dependencies, write-scope proposals, acceptance and future evidence.
This roadmap is a workstream map, not a second task-state queue.

## Delivered baseline

Local board CRUD, SVG drawing/shapes, basic text/notes, session-local undo/redo,
SQLite autosave/status/retry, PNG export and container packaging exist in source.
The focused browser check covers create, pointer drawing, undo, redo, downloaded
PNG, reload and application restart. All-shape workflows, rename/delete,
failed-save recovery and grouped drag history remain outside that test's
behavioral coverage. Delivery does not mean full Miro compatibility.

## Canonical execution breakdown

Task records are the sole source of status/points/evidence. They all start
pending with completion No; no implementation has been dispatched. This
reference table does not duplicate a status queue.

| Accepted workstream | Canonical task records |
| --- | --- |
| Baseline, model and lean packaging | [E001-T01](epics/E001-2026-10-30-personal-whiteboard/tasks/T01-baseline.md), [E001-T02](epics/E001-2026-10-30-personal-whiteboard/tasks/T02-legacy-cleanup-packaging.md), [E001-T03](epics/E001-2026-10-30-personal-whiteboard/tasks/T03-versioned-document-relations.md) |
| Durable/progressive images | [E001-T04](epics/E001-2026-10-30-personal-whiteboard/tasks/T04-durable-assets.md), [E001-T05](epics/E001-2026-10-30-personal-whiteboard/tasks/T05-image-paste-upload.md), [E001-T06](epics/E001-2026-10-30-personal-whiteboard/tasks/T06-progressive-images.md) |
| Navigation, frames and common locks | [E001-T07](epics/E001-2026-10-30-personal-whiteboard/tasks/T07-navigation-grid-capacity.md), [E001-T08](epics/E001-2026-10-30-personal-whiteboard/tasks/T08-nested-frames.md), [E001-T09](epics/E001-2026-10-30-personal-whiteboard/tasks/T09-shared-locks.md) |
| Rich text and syntax-highlighted code | [E001-T10](epics/E001-2026-10-30-personal-whiteboard/tasks/T10-rich-text.md), [E001-T11](epics/E001-2026-10-30-personal-whiteboard/tasks/T11-code-blocks.md) |
| Website/product cards and extraction | [E001-T12](epics/E001-2026-10-30-personal-whiteboard/tasks/T12-website-product-cards.md), [E001-T13](epics/E001-2026-10-30-personal-whiteboard/tasks/T13-extraction-contract-handoff.md), [E001-T14](epics/E001-2026-10-30-personal-whiteboard/tasks/T14-extraction-consumer.md) |
| Source export, loss report and new-board import | [E001-T15](epics/E001-2026-10-30-personal-whiteboard/tasks/T15-read-only-exporter.md), [E001-T16](epics/E001-2026-10-30-personal-whiteboard/tasks/T16-migration-package-dry-run.md), [E001-T17](epics/E001-2026-10-30-personal-whiteboard/tasks/T17-idempotent-importer.md) |
| Coordinated backup/restore | [E001-T18](epics/E001-2026-10-30-personal-whiteboard/tasks/T18-backup-restore.md) |
| Record tables and expanded view | [E001-T19](epics/E001-2026-10-30-personal-whiteboard/tasks/T19-record-tables.md), [E001-T20](epics/E001-2026-10-30-personal-whiteboard/tasks/T20-expanded-table-view.md) |
| Independent acceptance and intended HTTPS delivery | [E001-T21](epics/E001-2026-10-30-personal-whiteboard/tasks/T21-acceptance-migration-rehearsal.md), [E001-T22](epics/E001-2026-10-30-personal-whiteboard/tasks/T22-release-deployment-acceptance.md) |

The previous 65-point sketch is superseded by 155 indicative points across
22 coherent tasks (5 or 8 points each). Estimates are not time/token limits.
Re-estimation must update canonical records, phase/epic sums and selected route,
not silently treat new/unknown work as zero. The eight dependency groupings
have totals 5, 21, 40, 26, 32, 13, 13 and 5; no phase exceeds 70.

Phases are dependency groupings, not barriers requiring unrelated siblings.
T09 precedes T11, T13 precedes T14 and T17 precedes T21 within their groups.
The first useful link/image migration does not wait for rich text, code or
rare tables: T17 imports only actually delivered models and preserves/reports
unsupported raw records. T10/T11/T19 are not its hard prerequisites. The full
T21 acceptance still requires all required features, including code/tables.
T19/T20 remain Medium/medium, not first-migration blockers.

Early value can be reviewed after baseline/model/packaging, then durable image
paste/navigation, then loss-aware new-board migration. Independently accepted
partial delivery may use the existing infrastructure owner with separately
approved scope; it need not wait for unrelated siblings. Final T22 still owns
full intended HTTPS/replacement acceptance, not automatic production permission.

Content completeness is separate from runtime readiness. Read-only source and
synthetic work can progress without a real account; actual source fidelity,
external extraction integration and production delivery keep their own real
access/receipt/approval requirements. No new runtime/admission machinery is
created or operated by this plan.

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

Grouping, snapping, advanced alignment/search, richer recovery,
portable editable exports and advanced table views/formulas remain **PROPOSED**
additions, not accepted initial scope. Compatible document-version evolution
is now scoped in the canonical shared-model task. Existing multi-selection/duplication,
layer ordering and save/status/retry behavior must be distinguished from new
work. Use [the feature map](FEATURE-MAP.md) for open questions and proposed
acceptance scenarios. No implementation is dispatched by this document.
