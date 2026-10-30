# E001: Personal whiteboard and representative migration

## TLDR

Complete one personal self-hosted Miro replacement, from the existing SVG/SQLite
board through image/link-heavy representative migration to an independently
accepted owner-approved HTTPS service. Direction: serves [PURPOSE](../../PURPOSE.md)
and [VISION](../../VISION.md), not full Miro parity. One umbrella epic, 22 pending
records, 155 indicative Fibonacci points; selected route AO because total >40.
Estimates are scope estimates, not budgets. No product execution is authorized.

Plan-content completeness is reviewed separately from runtime readiness:
all records/acceptance/dependencies passed independent source review and are accepted;
AO/runtime readiness is NOT_CHECKED, no executor is dispatched, no live source
access or production activation is granted. Content review is not runtime
admission. Do not operate retired orchestration/readiness machinery.

## Problem and current state

Repository: zentala/miro-clone, base_ref main as reviewed 2026-10-30.
The baseline works for a small personal board but cannot represent the images,
links, frames, rich content and records required for migration.

| Source evidence | Observed contract | Gap relevant to this plan |
| --- | --- | --- |
| lib/sqlite.ts:16 | WAL SQLite; one boards table | No asset schema/version migrations exist |
| types/board.ts:3 | Ordered layer IDs and map, no version | Backward-compatible evolution needed |
| types/board.ts:22, types/canvas.ts:12 | 100 layers; five types | No frame/lock/image/card/code/table models |
| store/use-board-store.ts:77 | Mutable operations, snapshot history, serialized saves | Shared relation/lock contract needed |
| lib/utils.ts:32, canvas onWheel | Translation-only pointer mapping and panning | Zoom/DPR and capacity need coherent change |
| selection-tools.tsx:25 in board components | Existing z-order/selection/duplication | Extend, do not rebuild as missing features |
| package.json:11, next.config.mjs:3 | Hosted SDKs/old image host remain | Usage-audited cleanup accepted |
| Dockerfile:18 | Full dependencies, next start, non-root volume | Slimming/standalone needs measured equivalence |
| tests/critical-editor.test.cjs:88, justfile | Node/CDP synthetic baseline workflow | Not proof of future features or deployment |

Board component paths above are under app/board/[boardId]/_components/.
Prior unchanged-app check on 2026-10-30: exit 0, one TAP parent plus six browser
steps and cleanup. No app tests rerun for this plan. All-shape, rename/delete,
failed-save recovery and grouped-drag coverage remain baseline gaps.

## Scope

Required: durable/progressive assets, image paste/upload, zoom/pan/grid, nested
frames, common locks, rich text/code, website/product cards with new-URL
extraction, two-view record tables, source export/dry run/loss reporting,
idempotent new-board import, coordinated restore, independent acceptance and
final intended HTTPS/replacement delivery.

Excluded: auth/accounts/cooperation, hosted dual backend, a replacement product
or framework, full IDE/code execution, perfect Miro parity, subscription
cancellation, destructive cleanup, merge-overwriting boards, cloned profiles,
a browser per card, runtime/tooling bootstrap and a second queue. Advanced
grouping/alignment/snapping/search, formulas/relations and additional views
remain optional/proposed. No real account/export, screenshot publication or
feature implementation is authorized by this planning change.

## Decisions and ADRs

- [SQLite ADR](../../ADR/0001-single-user-sqlite.md): retain local Node/React/SVG/
  SQLite; convert legacy data explicitly, no dual backend.
- [Feature map](../../FEATURE-MAP.md): locking a frame protects ALL contained
  descendants. Unlock preserves individually locked children. These are
  accepted requirements, not implemented; do not reopen them as proposals.
- [ARCH](../../ARCH.md) and [DESIGN](../../../DESIGN.md) constrain persistence and
  visual continuity. Reference screenshot observations are not implementation.
- No active decisions.jsonl was present during review. Choices below remain
  proposals to resolve in baseline discovery, not new accepted ADRs.

## Implementation Strategy

Extend the shared model before specialized components. Reuse Node/Next/SQLite,
SVG geometry/history, Radix controls, Node/CDP checks and current Docker layout.
Existing extraction functions/schema belong to the extension owner; existing
infrastructure owns service delivery. Do not rebuild those owners here.

Compare only minimum per-component patches against a coherent shared
versioned-object extension within the accepted React/SVG/SQLite fork. The
shared extension is recommended for consistent relations/lock/save behavior;
T01 refines its boundary. Replacing the renderer, editor, product or stack is
explicitly out of scope, not a third choice to reopen. No new library is
accepted by this recommendation.

## Schema impact

Current SQL is exactly:

    boards(id TEXT PRIMARY KEY, title TEXT NOT NULL,
           created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
           document TEXT NOT NULL)

Propose versioned JSON with stable string IDs, parents and own-lock bits, plus
explicit upgrades from unversioned five-type documents. No migration is
already implemented. Assets/import mappings/table records may need metadata
tables/indexes; T03/T04/T17/T19 inspect SQL and review before migrations.
Prefer additive/backward-readable evolution, refuse unknown future versions
without rewriting, and never reset live data to satisfy a validator.

Filesystem rename and DB transaction are not one atomic commit. T04 needs
staged publication/recovery, T18 consistent DB-plus-assets backup/restore and
T17 interruption-safe import. All real-data operations require a committed
script, verified fresh backup and separately accepted target scope.

### Defaults requiring alignment

Boundary-only frame resize without scaling children is proposed. Mixed-lock
selection refusal, reparent restrictions, selection-through, unlock gestures
and history exceptions remain proposed. T01/T09 resolve them while preserving
the two accepted inheritance/individual-lock requirements. First table fields,
fonts, editors/highlighters/grid/image libraries, variant sizes and performance
thresholds remain choices. No dependency is silently selected/installed.

### Dependencies, phases and milestones

Task files are the sole task status/evidence authority. This table is an order
map, not a parallel queue or permission to start a phase concurrently.

| Phase | Milestone / included tasks | Points | Done |
| --- | --- | ---: | --- |
| 1 | Baseline and defaults: [E001-T01](tasks/T01-baseline.md) | 5 | No |
| 2 | Packaging, shared model and source export: [E001-T02](tasks/T02-legacy-cleanup-packaging.md), [E001-T03](tasks/T03-versioned-document-relations.md), [E001-T15](tasks/T15-read-only-exporter.md) | 21 | No |
| 3 | Assets, coordinates, rich text, normalization and records: [E001-T04](tasks/T04-durable-assets.md), [E001-T07](tasks/T07-navigation-grid-capacity.md), [E001-T10](tasks/T10-rich-text.md), [E001-T16](tasks/T16-migration-package-dry-run.md), [E001-T19](tasks/T19-record-tables.md) | 40 | No |
| 4 | Image ingestion, frames, restore and expanded table: [E001-T05](tasks/T05-image-paste-upload.md), [E001-T08](tasks/T08-nested-frames.md), [E001-T18](tasks/T18-backup-restore.md), [E001-T20](tasks/T20-expanded-table-view.md) | 26 | No |
| 5 | Progressive loading, locks, code and cards: [E001-T06](tasks/T06-progressive-images.md), [E001-T09](tasks/T09-shared-locks.md), [E001-T11](tasks/T11-code-blocks.md), [E001-T12](tasks/T12-website-product-cards.md) | 32 | No |
| 6 | Extraction contract and delivered consumer: [E001-T13](tasks/T13-extraction-contract-handoff.md), [E001-T14](tasks/T14-extraction-consumer.md) | 13 | No |
| 7 | Idempotent import and independent rehearsal: [E001-T17](tasks/T17-idempotent-importer.md), [E001-T21](tasks/T21-acceptance-migration-rehearsal.md) | 13 | No |
| 8 | Release and intended HTTPS acceptance: [E001-T22](tasks/T22-release-deployment-acceptance.md) | 5 | No |

Within phase 5, T09 precedes T11; phase 6 runs T13 before T14; phase 7 runs T17
before T21. Each task records all hard edges. Phases are dependency groupings,
not barriers: a task can proceed once its own prerequisites are accepted even
if unrelated siblings or earlier-phase external work are waiting.

First representative import T17 has NO mandatory T10/T11/T19 dependency. Import
only types with actually delivered models/validators/renderers, prioritizing
links/images; preserve unsupported raw items and report owner-accepted losses.
Do not claim rich-text, code or table import before their models exist. Full
T21 acceptance still requires all required features, including rich text/code
and both table views. First useful migration is not full epic completion.

Maximum four active agents INCLUDING coordinator and foreign workers; subtract
occupied slots. Serialize overlapping store/types/canvas/lockfile/test/docs
writes even for independent DAG nodes. Largest phase is 40 points; none >70.
No numeric time/token allowance or budget_minutes field is invented.

### Early user-value milestones

- Usable local baseline: T01-T03 preserve existing boards while measuring a
  leaner package and establishing compatible version handling.
- Image-heavy authoring: T04/T05/T07 deliver durable image paste/upload and
  navigation; T06 improves loading after its own prerequisites. This need not
  wait for record tables, rich text/code or extraction-provider delivery.
- First loss-aware migration: T15/T16 plus T17's actual asset/frame/lock/card/
  backup dependencies deliver a new board from supported records, with retained
  unsupported source records and a reviewed loss report. Table/code/rich-text
  models do not block this milestone. It is not a full-fidelity claim.
- Full replacement: T21 integrates all required directions and T22 accepts the
  intended HTTPS/replacement outcome after separate production approval.

Independently reviewed partial deliveries may use the existing infrastructure
owner when separately scoped/authorized, without waiting for unrelated phase
siblings. No partial deployment is authorized now. T22 remains the final full
product delivery/URL acceptance task, not a barrier to every earlier useful slice.

## Test strategy

Extend existing just check with Node 22 node:test/CDP/system Chromium. Use real
UI workflows, generated disposable fixtures, owned loopback processes, finite
waits and cleanup. Each task names proposed test files/observable assertions;
these are not files created now. No new framework or self-mirroring test factory.

| Acceptance family | Failing or absent assertion today | Planned coverage |
| --- | --- | --- |
| Versioned/shared model | Old types reject new relations/objects | T03 model test and reload |
| Asset/image/progressive loading | No image asset API/type | T04-T06 asset/image tests |
| Coordinates/frames/locks | Only pan; no frame/lock model | T07-T09 geometry/lock tests |
| Rich text/code/record views | Missing requested controls/types | T10/T11/T19/T20 browser flows |
| New-URL capture | No actual extraction interface | T13 contract + T14 external receipt |
| Export/normalize/import/restore | No migration/restore scripts | T15-T18 roundtrip/loss tests |
| Integrated/performance | Prior check is baseline only | T21 independent measured rehearsal |
| Intended HTTPS/replacement | Source/image checks are not deployment | T22 infrastructure-owned receipt |

Preserve initial static exit 2, initial create 403/exit 1, later Host-based
six-step pass, intentional diagnostic failure (exit 1, 16.109 seconds), and
corrected-candidate exit 0 separately, as root AGENTS records. Missing evidence
is NOT_CHECKED. Never substitute server-only calls for UI, fixtures for external
integration, a raw port for deployment or a later PASS for erased failures.

## Agent Orchestrator Ready

Selected route AO, based on the full 155-point umbrella; NOT RUN.
Runtime readiness/admission: NOT_CHECKED. No executor/profile capability,
external-owner uptake or runtime admission has been checked by operating AO.
No retired readiness/checksum/manifest workflow, daemon, new lease/gate or
worker is operated/required here. Content contracts are not dispatch proof.
Existing DM retains delivery ownership. Any later permitted execution needs
explicit release and an actually supported host mechanism; do not infer it.

## Definition of Done

The user can arrange representative images/links, frames, rich text/code and
records; accepted descendant/individual locks hold; undo/redo, asset-backed PNG
and saved reload work. Every source item is accounted for in a reviewed loss
report, including unsupported connectors/frames; retries are idempotent and
nonempty coordinated restore works. Real-source fidelity needs a separately
authorized representative sample, not just generated fixtures.

Final acceptance includes the intended owner-approved HTTPS service and durable
replacement under the existing infrastructure owner, with separate production
approval and data preservation. Until then runtime delivery is NOT_CHECKED.
Independent source/result acceptance and accepted commits/evidence are required
before completing task records. Passing source tests alone is not delivery.

## Subtasks

The 22 records linked above define bounds, proposed local write sets, dependencies,
points, real tests and gating. All pending, completion No, execution not
dispatched. [HANDOFF](HANDOFF.md) is the empty-context entrypoint;
[INDEX](../INDEX.md) has one epic row only.

## Risks and GAPS

The 155 points estimate only scoped app-repository tasks. Separately owned
extension and infrastructure implementation is unestimated external work,
not zero and not included in that total. T13 discovers/obtains the relevant
external-owner scope and estimate; T22 coordinates separately scoped
infrastructure delivery. No extra task or runtime gate is introduced here.

No real Miro source, extraction implementation, runtime admission, production
activation or intended HTTPS evidence was accessed during planning. Synthetic
work can proceed independently; genuine external waits hold only dependent
acceptance. Unknown preview/connector/asset coverage requires visible losses,
not a full-fidelity promise.

All tasks are 5 or 8 indicative points. Discovery can change scope/sizing;
update task records, phase/epic totals and route together. Never reduce the
apparent total to select direct execution. The old 65-point sketch is superseded.
No product code/runtime/account work has run. Independent plan-content review
passed and the content is accepted; execution remains unauthorized/not admitted.
