---
formatVersion: 1
id: "E001-T08"
title: "Add named nested frames with stable child geometry"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T03", "E001-T07"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "lib/document-version.ts", "store/use-board-store.ts", "lib/utils.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/frame.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "tests/frames.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T08] add named nested frames with stable child geometry"
completion: "No"
execution: "not-dispatched"
phase: 4
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T08: Add named nested frames with stable child geometry

## Outcome

Represent frame containment explicitly and allow a frame to move with every descendant while preserving geometry and history.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `store/use-board-store.ts`
- `app/board/[boardId]/_components/canvas.tsx:120`
- `lib/utils.ts:32`

## Bounds and proposed write scope

Do not treat screenshot labels/assets as fixtures or accepted pixel layouts. Frame boundary-resize default remains a proposal until aligned; common lock enforcement is T09.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Create/name outer and inner frames; assign/reassign children without coordinate jumps and reject cycles.
- [ ] Moving an outer frame moves all descendants once, without losing relative geometry or duplicating a descendant's transform.
- [ ] Undo/redo and reload preserve nesting, names, geometry and layer ordering.
- [ ] Resolve boundary resize, clipping and group-vs-frame semantics before testing them; proposed default is boundary-only resize without scaling children.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/frames.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 parent model and T07 coordinate mapping first. Use generated nested fixtures; preserve unknown source relationships for later migration reporting.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
