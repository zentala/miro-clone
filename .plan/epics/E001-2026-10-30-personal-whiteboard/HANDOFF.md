# Empty-context handoff: personal whiteboard migration

## Outcome and controlling sources

Repository owner: zentala/miro-clone, existing main branch. Work only in this
repository or its authorized worktree. This handoff is the entrypoint for later
execution, not permission to start now. One umbrella epic, E001, 22 task records,
155 indicative points; AO selected from full size >40, NOT RUN. Runtime readiness
is NOT_CHECKED; all task statuses pending, completion No, executor unassigned.

Read [root AGENTS](../../../AGENTS.md), [PURPOSE](../../PURPOSE.md),
[VISION](../../VISION.md), [ARCH](../../ARCH.md),
[accepted SQLite ADR](../../ADR/0001-single-user-sqlite.md),
[FEATURE-MAP](../../FEATURE-MAP.md), [DESIGN](../../../DESIGN.md), then
[PLAN](PLAN.md) and the selected task plus its dependency evidence. The direction
is a personal self-hosted board replacing paid Miro through representative
migration, without auth/collaboration/SaaS or a substitute editor product.

## Mental model and actual source

Next.js serves the dashboard/editor and same-origin board API. The browser's
LocalBoardProvider holds BoardStore, with mutable layer operations, snapshot
undo/redo and queued document saves. Cursor/selection state is not the persisted
board. The SQL table is boards(id TEXT PRIMARY KEY, title TEXT NOT NULL,
created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, document TEXT NOT NULL).
No schema version, asset table, frame/lock/image/card/code/table model exists.

Start from lib/sqlite.ts:16, lib/boards.ts, types/board.ts:3 and :19,
types/canvas.ts:12, store/use-board-store.ts:77, hooks/use-local-board.ts,
app/board/[boardId]/page.tsx and its _components/canvas.tsx. Existing multiselect,
duplicate and z-order live in canvas/selection-tools; preserve rather than
rebuild them. lib/utils.ts:32 and canvas onWheel currently support translation,
not a completed zoom model. Client and validator both cap at 100 layers.

Existing Node >=22.13 built-in SQLite creates the database at an absolute
MIRO_SQLITE_PATH override or data/miro.sqlite. Runtime WAL/SHM and later assets
must persist consistently. Dockerfile currently runs non-root Node 22 with
full dependencies and next start, data under /app/data; no deployed service or
automatic forge pipeline has been established by this source.

Old hosted SDK packages and unused Convex/Clerk/Liveblocks files remain.
Audit every consumer before deletion. Basic editable text/notes are not the
requested rich text; no exporter/importer or extraction integration exists.

## Accepted requirements and proposed defaults

A frame lock protects ALL contained descendants, including nested descendants;
unlocking the parent preserves individually locked children. These requirements
are accepted and are not reopened as proposal or implementation claims.
Mixed selection, reparent bypass policy, unlock gestures and history exceptions
remain defaults to review. Frame boundary-only resizing without scaling children
is proposed; coordinate/reference choices must not create jumps or cycles.

Required code controls include font size, line-number toggle and common lock.
Record tables have embedded/full-page views over the same records, not copied
datasets or a rich-text table. First table fields, libraries/fonts, performance
thresholds and exact new API/schema choices need review. New dependency paths
in a task are proposals, not permission to install without accepted scope.

## Delivery order, dependencies and early value

Task records, not this table, own status, write scope and evidence. A phase is
a dependency grouping, not a barrier to unrelated siblings or permission for
parallel writes. Start a later-group task once its own dependencies are accepted;
external waits must not hold independent synthetic/model work.

| Phase | Dependency grouping | Points | Done |
| --- | --- | ---: | --- |
| 1 | Baseline and defaults: [E001-T01](tasks/T01-baseline.md) | 5 | No |
| 2 | Packaging, shared model and source export: [E001-T02](tasks/T02-legacy-cleanup-packaging.md), [E001-T03](tasks/T03-versioned-document-relations.md), [E001-T15](tasks/T15-read-only-exporter.md) | 21 | No |
| 3 | Assets, coordinates, rich text, normalization and records: [E001-T04](tasks/T04-durable-assets.md), [E001-T07](tasks/T07-navigation-grid-capacity.md), [E001-T10](tasks/T10-rich-text.md), [E001-T16](tasks/T16-migration-package-dry-run.md), [E001-T19](tasks/T19-record-tables.md) | 40 | No |
| 4 | Image ingestion, frames, restore and expanded table: [E001-T05](tasks/T05-image-paste-upload.md), [E001-T08](tasks/T08-nested-frames.md), [E001-T18](tasks/T18-backup-restore.md), [E001-T20](tasks/T20-expanded-table-view.md) | 26 | No |
| 5 | Progressive loading, locks, code and cards: [E001-T06](tasks/T06-progressive-images.md), [E001-T09](tasks/T09-shared-locks.md), [E001-T11](tasks/T11-code-blocks.md), [E001-T12](tasks/T12-website-product-cards.md) | 32 | No |
| 6 | Extraction contract and delivered consumer: [E001-T13](tasks/T13-extraction-contract-handoff.md), [E001-T14](tasks/T14-extraction-consumer.md) | 13 | No |
| 7 | Idempotent import and independent rehearsal: [E001-T17](tasks/T17-idempotent-importer.md), [E001-T21](tasks/T21-acceptance-migration-rehearsal.md) | 13 | No |
| 8 | Release and intended HTTPS acceptance: [E001-T22](tasks/T22-release-deployment-acceptance.md) | 5 | No |

Phase-internal order: T09 before T11; T13 before T14; T17 before T21. Other edges
are explicit in dependencies, including T05/T07 before T06. Maximum phase 40
points (<70). All agent slots include root/coordinator and foreign work; cap
four total, never four per parent. No workers start from this handoff.

Early value: T01-T03 stabilize baseline/packaging; T04/T05/T07 make image-heavy
authoring usable; T06 improves loading when its own dependencies finish.
The first loss-aware import through T15/T16/T17 needs only T17's actual
asset/navigation/frame/lock/card/backup prerequisites. T10/T11/T19 are NOT
mandatory T17 dependencies: import only actually delivered model types, retain
unsupported raw source items and report accepted losses. Never advertise
rich-text/code/table import before its model exists. Infrequently used tables
must not hold the first link/image migration. T19/T20 are Medium/medium.

Full T21 acceptance still requires rich text, code and both record-table views,
plus extraction/migration/backup. T22 closes full intended HTTPS delivery.
Independently reviewed partial value may be delivered through the existing
infrastructure owner under separate accepted scope, without phase-wide
barriers. Neither partial nor full production activation is authorized now.

## Canonical task links and sizes

This is a read map, not a second task-state queue. All current task records say
pending/No; only the integrator updates them after independent acceptance.

| Task | Points | Importance | Hard dependencies | Done |
| --- | ---: | --- | --- | --- |
| [E001-T01](tasks/T01-baseline.md): Establish source baseline, design decisions and workload | 5 | High | None | No |
| [E001-T02](tasks/T02-legacy-cleanup-packaging.md): Remove retired hosted SDKs and slim container packaging | 5 | High | E001-T01 | No |
| [E001-T03](tasks/T03-versioned-document-relations.md): Version board documents and establish shared object relations | 8 | High | E001-T01 | No |
| [E001-T04](tasks/T04-durable-assets.md): Add durable file assets and SQLite references | 8 | High | E001-T03 | No |
| [E001-T05](tasks/T05-image-paste-upload.md): Paste, upload and render image layers | 8 | High | E001-T04 | No |
| [E001-T06](tasks/T06-progressive-images.md): Generate variants and bound viewport image loading | 8 | High | E001-T05, E001-T07 | No |
| [E001-T07](tasks/T07-navigation-grid-capacity.md): Implement zoom, pan, neutral grid and measured board capacity | 8 | High | E001-T03 | No |
| [E001-T08](tasks/T08-nested-frames.md): Add named nested frames with stable child geometry | 8 | High | E001-T03, E001-T07 | No |
| [E001-T09](tasks/T09-shared-locks.md): Enforce shared locks and accepted frame inheritance | 8 | High | E001-T03, E001-T08 | No |
| [E001-T10](tasks/T10-rich-text.md): Add durable rich text and font controls | 8 | High | E001-T03 | No |
| [E001-T11](tasks/T11-code-blocks.md): Add syntax-highlighted code with size, line numbers and locks | 8 | High | E001-T09, E001-T10 | No |
| [E001-T12](tasks/T12-website-product-cards.md): Add local website and product cards independent of extraction | 8 | High | E001-T05 | No |
| [E001-T13](tasks/T13-extraction-contract-handoff.md): Define extraction contract and hand off external-owner work | 5 | High | E001-T01, E001-T12 | No |
| [E001-T14](tasks/T14-extraction-consumer.md): Integrate the delivered extraction interface into cards | 8 | High | E001-T13 | No |
| [E001-T15](tasks/T15-read-only-exporter.md): Implement a minimal read-only structural export tool | 8 | High | E001-T01 | No |
| [E001-T16](tasks/T16-migration-package-dry-run.md): Normalize structural packages and report dry-run losses | 8 | High | E001-T15 | No |
| [E001-T17](tasks/T17-idempotent-importer.md): Import packages idempotently into new boards | 8 | High | E001-T16, E001-T06, E001-T08, E001-T09, E001-T12, E001-T18 | No |
| [E001-T18](tasks/T18-backup-restore.md): Coordinate SQLite and asset backup with verified restore | 5 | High | E001-T04 | No |
| [E001-T19](tasks/T19-record-tables.md): Add typed record tables and an embedded board view | 8 | Medium | E001-T03 | No |
| [E001-T20](tasks/T20-expanded-table-view.md): Open the same table records in a full-page view | 5 | Medium | E001-T19 | No |
| [E001-T21](tasks/T21-acceptance-migration-rehearsal.md): Independently accept the integrated board and rehearse migration | 5 | High | E001-T02, E001-T06, E001-T08, E001-T09, E001-T10, E001-T11, E001-T12, E001-T14, E001-T17, E001-T18, E001-T20 | No |
| [E001-T22](tasks/T22-release-deployment-acceptance.md): Coordinate release and independently accept intended HTTPS service | 5 | High | E001-T21 | No |

## Boundaries for a future dispatched executor

- Obtain actual compatible filesystem/write-path preflight and the accepted
  task handoff; the planned write_set is a repo-relative proposal to reconfirm.
- Keep schema/store/canvas/lockfile/check/docs ownership serialized; dependent
  completion and a free worker slot do not authorize overlapping writes.
- Do not touch private BACKLOG/STATE, source exports, credentials, user browser
  profile or real data. Use generated fixtures and owned disposable resources.
- Extension changes belong to the existing zntl-chrome owner/session. T13 owns
  the app contract/handoff; T14 integrated PASS needs real external evidence,
  not a fixture. No foreign path is authorized by a local task write_set.
- Minimal read-only source exporter work can be tested synthetically. Installing
  a source app or reading a real Miro board requires explicit source access;
  no account mutation/shared-link/subscription operation follows from planning.
- T22 owns app release docs/receipt. Actual infrastructure writes and private
  URL/access details stay with the existing infrastructure owner/session. Use
  forge-backed accepted updates, explicit production approval, fresh backup
  before real-data changes, and preserve data/assets/unrelated services.
- Do not operate retired orchestration/readiness/checksum tooling, install a
  daemon, invent a new lease/gate or populate a numeric time/token budget.
  Task points estimate scope. Ordinary finite command timeouts still apply.

## Verification, failure history and output

For product changes run existing just check: TypeScript, ESLint, build and
Node/CDP synthetic browser flow. Extend that same stack with the specific tests
in each task, rather than introduce another framework. Critical acceptance
must cover real UI, assets, geometry/history, reload/restart, measured network/
memory and appropriate restore/loss scenarios. Task22 also needs independent
intended HTTPS/replacement evidence from the infrastructure owner.

Baseline evidence is historical: 2026-10-30 just check exit 0, seven TAP passes
(one parent + six steps), cleanup complete. It proves neither new features nor
deployment. Preserve earlier static exit 2, first UI create 403/exit 1, later
Host-based pass, intentional diagnostic exit 1 (16.109 seconds) and corrected
exit 0 in AGENTS; never rerun the rejected defect to manufacture new history.
No unchanged app build/test was run for this planning-only update.

Deliver actual changed paths, exact commands/exits, source/behavior evidence,
known limitations and independent review. Keep unknown results NOT_CHECKED;
external fixtures are not actual integration and source/image builds are not
service delivery. The implementer never independently certifies their own diff.
Use ordinary hooks and verified integration; a task cannot mark itself completed.

## Actual prerequisites still outside this plan's evidence

The 155 points cover only this app repository's scoped tasks. Separately owned
extension/infrastructure implementation is unestimated external work, not
silently zero or included. T13 discovers/obtains the relevant owner's scope and
estimate; infrastructure delivery is separately scoped through its owner at
T22. This clarification adds no task or runtime gate.

Runtime orchestration admission/profile capability: NOT_CHECKED. Real Miro
representative source: not accessed/authorized by planning. Actual extraction
interface/owner receipt: not checked. Infrastructure uptake, production
activation, backup and intended HTTPS/replacement evidence: not checked.
Record each genuine wait at the existing owner once and continue independent
accepted work; do not create another PO/DM or task queue. Review of plan content
does not resolve those future execution conditions.
