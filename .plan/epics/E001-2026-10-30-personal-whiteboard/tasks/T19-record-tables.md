---
formatVersion: 1
id: "E001-T19"
title: "Add typed record tables and an embedded board view"
status: "pending"
priority: "medium"
type: "feature"
dependencies: ["E001-T03"]
epic: "E001"
points: 8
importance: "Medium"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/record-table.ts", "types/canvas.ts", "types/board.ts", "lib/record-tables.ts", "app/board/[boardId]/_components/record-table.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "store/use-board-store.ts", "tests/record-tables.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", "package.json", "package-lock.json"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T19] add typed record tables and an embedded board view"
completion: "No"
execution: "not-dispatched"
phase: 3
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T19: Add typed record tables and an embedded board view

## Outcome

Create a stable dataset model and editable embedded grid, distinct from a rich-text table.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `types/board.ts`
- `store/use-board-store.ts`
- `package.json`

## Bounds and proposed write scope

First field slice/library remain explicit choices. No formulas, relations, multi-user system or arbitrary screenshot columns as automatic requirements. Proposed package paths do not authorize installation.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Rows/columns have stable IDs, typed values and persistent order; edits round-trip through SQLite without duplicating the underlying dataset.
- [ ] Implement the reviewed first slice of text/number/date/single-choice fields and validation; keep unselected field types explicitly unsupported.
- [ ] Use a reviewed grid/table library suitable for record datasets, not a rich-text table mistaken for a record database.
- [ ] Embedded editing, undo/redo and reload preserve values/order; existing drawing remains usable and lock enforcement is integrated when available.
- [ ] Assignee, if selected, is a personal label; it does not restore accounts/collaboration.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/record-tables.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 model/version first. T20 supplies the second view; T17 imports only actually supported table semantics.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
