---
formatVersion: 1
id: "E001-T07"
title: "Implement zoom, pan, neutral grid and measured board capacity"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T03"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "lib/utils.ts", "store/use-board-store.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "app/board/[boardId]/_components/reset-camera.tsx", "tests/navigation-capacity.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T07] implement zoom, pan, neutral grid and measured board capacity"
completion: "No"
execution: "not-dispatched"
phase: 3
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T07: Implement zoom, pan, neutral grid and measured board capacity

## Outcome

Replace translation-only navigation and the fixed 100-layer cap with accurate zoom-aware interactions and measured large-board limits.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `app/board/[boardId]/_components/canvas.tsx:51`
- `app/board/[boardId]/_components/canvas.tsx:278`
- `lib/utils.ts:32`
- `types/board.ts:22`
- `app/board/[boardId]/_components/selection-tools.tsx:88`

## Bounds and proposed write scope

Snapping remains optional/proposed. Do not remove all safety limits or invent acceptable performance without measurements. DESIGN records visual decisions before code.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Pan/zoom about the intended anchor preserve world coordinates; pointer selection, dragging, resizing and export map correctly across zoom and DPR.
- [ ] Render a subtle gray grid that supports navigation without becoming authored document content or changing exported geometry.
- [ ] Replace both client and validator 100-layer constraints coherently with reviewed measured bounds and a visible refusal for excessive workloads.
- [ ] Existing document coordinates, drawing, undo/redo, camera reset and reload continue to work on legacy fixtures and generated larger boards.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/navigation-capacity.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 schema first; capacity/workload targets need T01 review. Shared camera/validator paths overlap multiple workstreams; serialize ownership.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
