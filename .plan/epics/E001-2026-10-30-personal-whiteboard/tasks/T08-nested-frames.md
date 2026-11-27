---
formatVersion: 1
id: "E001-T08"
title: "Add named nested frames with stable child geometry"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T03", "E001-T07"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t08-impl (Herdr w5P:p4)"
write_set: ["types/canvas.ts", "types/board.ts", "lib/document-version.ts", "store/use-board-store.ts", "lib/utils.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/frame.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "tests/frames.test.cjs", "tests/critical-editor.test.cjs", "tests/document-model.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T08] add named nested frames with stable child geometry"
completion: "Yes"
execution: "Same logical author completed the accepted correction batch in .plan/worktrees/e001-t08. ROOT independently accepted the stable source; the existing focused document-model test and full just check passed. The reviewed candidate was fast-forward integrated to main and pushed to origin."
phase: 4
completed_at: "2026-11-27"
commits: ["57eeea5", "15880f2", "dd47a50", "580ef41", "5d1cbe5", "708c4c9", "41beeae"]
verification_evidence: ["ROOT independent source review PASS of complete tests/document-model.test.cjs and exact correction diff; previous T08 whole-source review remains applicable to unchanged files", "Focused node --test --test-concurrency=1 tests/document-model.test.cjs output: 8 PASS, 0 FAIL, 0 SKIP; shell exit marker was empty due caller expansion, so no numeric focused exit claimed", "Final owning just check: exit 0; production artifact .plan/worktrees/e001-t08/.next/standalone/server.js (4,607 bytes); existing lint warning at components/custom-color-picker.tsx:39 remains", "Previously retained actual wide/narrow frame screenshots independently accepted; reviewed T08 source and image evidence unchanged by final legacy-expectation correction"]
evidence: ["Seven T08 commits fast-forward integrated to main at 41beeae and pushed to configured origin main; push exited 0", "Full check generated unrelated tracked T05 wide/narrow PNG changes; these were excluded from the T08 commit and preserved in the checkout"]
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

Do not treat screenshot labels/assets as fixtures or accepted pixel layouts. Frame resizing follows PO decision 1 and the T01 clarification (2026-11-08): change only the frame bounds; do not scale descendants or reparent them when shrinking. Frames do not clip descendants and paint below them. Frames are the only persistent containment type; common lock enforcement is T09.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [x] Create/name outer and inner frames; assign/reassign children without coordinate jumps and reject cycles.
- [x] Moving an outer frame moves all descendants once, without losing relative geometry or duplicating a descendant's transform.
- [x] Undo/redo and reload preserve nesting, names, geometry and layer ordering.
- [x] Resizing a frame changes only its own bounds; descendants keep absolute geometry, are not scaled, and are not reparented when left outside (PO decision 1 and T01 clarification, 2026-11-08).
- [x] Frames do not clip: a descendant outside the boundary stays visible and selectable; a frame paints below its descendants after create, assign, reassign, undo/redo and reload.
- [x] No group type is added; frames are the only persistent containment.
- [x] Legacy v1-v4 `parentId` values upgrade to inactive `legacyParentId`; opening keeps the stored payload unchanged until an accepted save, and the board remains readable.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/frames.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Resolved from E001-T03 verification by PO disposition (2026-11-26)

- v1-v4 documents can contain `parentId` values to any layer, including
  dangling or cyclic relationships. The v4-to-v5 upgrade moves each value to
  inactive `legacyParentId`, leaves the layer at root, and preserves IDs,
  geometry, order, locks and the stored bytes until the next accepted save.
- In schema 5, only a Frame may be the target of active `parentId`; legacy
  references are retained but never traversed as containment. This keeps old
  boards readable without silently dropping their source relationships.

## Known gating and evidence

T03 parent model and T07 coordinate mapping first. Use generated nested fixtures; preserve unknown source relationships for later migration reporting.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
