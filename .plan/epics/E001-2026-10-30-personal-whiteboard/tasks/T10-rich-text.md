---
formatVersion: 1
id: "E001-T10"
title: "Add durable rich text and font controls"
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
write_set: ["types/canvas.ts", "types/board.ts", "lib/rich-text.ts", "app/board/[boardId]/_components/text.tsx", "app/board/[boardId]/_components/note.tsx", "app/board/[boardId]/_components/rich-text-editor.tsx", "store/use-board-store.ts", "tests/rich-text.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", "package.json", "package-lock.json", "public/fonts/**"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T10] add durable rich text and font controls"
completion: "No"
execution: "not-dispatched"
phase: 3
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T10: Add durable rich text and font controls

## Outcome

Provide size/font/bold/italic/color controls with safe durable content while preserving legacy notes/text.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `app/board/[boardId]/_components/text.tsx`
- `app/board/[boardId]/_components/note.tsx`
- `types/canvas.ts:51`
- `package.json`

## Bounds and proposed write scope

Editor/font/library selection is not yet made; package edits are contingent proposals. No custom rich-text engine, silent remote font requirement or all-editor-instance-per-object design.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Font family/size, bold, italic and text color work through real editing controls without losing the user's text or triggering canvas shortcuts while typing.
- [ ] Legacy text/notes open with a plain-text fallback; the versioned representation retains supported formatting through save/reload and undo/redo.
- [ ] Sanitize pasted content without executable markup; unsupported formatting degrades visibly instead of disappearing.
- [ ] Use an accepted maintained editor, lazy mounting and licensed local font assets where selected; a network/font failure must not make existing content invisible.
- [ ] Differentiate text color from note/background fill; lists, links, alignment and highlight/opacity remain candidates unless explicitly selected.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/rich-text.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 versioned representation first. Coordinate T09 lock policy at integration; T11 needs a real reusable editing boundary from this task.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
