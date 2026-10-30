---
formatVersion: 1
id: "E001-T11"
title: "Add syntax-highlighted code with size, line numbers and locks"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T09", "E001-T10"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "app/board/[boardId]/_components/code.tsx", "app/board/[boardId]/_components/code-editor.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "store/use-board-store.ts", "tests/code-blocks.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", "package.json", "package-lock.json"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T11] add syntax-highlighted code with size, line numbers and locks"
completion: "No"
execution: "not-dispatched"
phase: 5
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T11: Add syntax-highlighted code with size, line numbers and locks

## Outcome

Provide an editable code object with the explicitly requested per-block controls, using a reviewed library rather than a custom lexer.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `.plan/FEATURE-MAP.md`
- `app/board/[boardId]/_components/rich-text-editor.tsx (planned in T10)`
- `lib/object-locks.ts (planned in T09)`

## Bounds and proposed write scope

No full IDE, execution engine or hand-written lexer. No editor/highlighter package is selected by this record; accept dependency scope before installation.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Code preserves whitespace/indentation through editing, reload, undo and redo.
- [ ] Per-block font size, show/hide line numbers and common lock/unlock operate visibly and persist according to the reviewed history policy.
- [ ] An accepted library supplies syntax highlighting; load only selected languages and mount the interactive editor on demand.
- [ ] Code obeys accepted inherited frame protection; unlocking an ancestor preserves the code object's own lock.
- [ ] Source is never executed. Language override/auto-detection, wrap, copy and themes are additional candidates, not blanket accepted scope.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/code-blocks.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T09 common enforcement and T10 editor boundary first; verify new object type is accepted consistently by server validator and migration version handling.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
