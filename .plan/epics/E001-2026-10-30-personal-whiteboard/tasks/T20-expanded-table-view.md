---
formatVersion: 1
id: "E001-T20"
title: "Open the same table records in a full-page view"
status: "pending"
priority: "medium"
type: "feature"
dependencies: ["E001-T19"]
epic: "E001"
points: 5
importance: "Medium"
effort: "medium"
role: "implementer"
executor: "unassigned"
write_set: ["app/board/[boardId]/table/[tableId]/page.tsx", "app/board/[boardId]/_components/record-table.tsx", "lib/record-tables.ts", "store/use-board-store.ts", "tests/table-views.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T20] open the same table records in a full-page view"
completion: "No"
execution: "not-dispatched"
phase: 4
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T20: Open the same table records in a full-page view

## Outcome

Provide full-page and embedded editing over one dataset with a reliable return to the board viewport.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/record-table.ts (planned in T19)`
- `app/board/[boardId]/_components/record-table.tsx (planned in T19)`
- `app/board/[boardId]/page.tsx`

## Bounds and proposed write scope

No separate table data store, duplicate status queue or inference that every screenshot icon is an implemented/required feature.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Open an embedded dataset in the expanded view without copying it or changing its stable ID.
- [ ] Edit in each direction and observe the same records/order on return, reload and undo/redo under the reviewed session history policy.
- [ ] Back to canvas restores the intended board/table context and viewport; missing/deleted table IDs show a recoverable error.
- [ ] Select the initial filter/sort/search slice explicitly if needed; unselected advanced behavior remains proposed.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/table-views.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T19 dataset/library first. Cross-view history/viewport defaults need review; exact browser route is proposed until dispatch.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
