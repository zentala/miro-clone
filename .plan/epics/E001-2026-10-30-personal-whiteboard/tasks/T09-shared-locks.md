---
formatVersion: 1
id: "E001-T09"
title: "Enforce shared locks and accepted frame inheritance"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T03", "E001-T08"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "lib/object-locks.ts", "store/use-board-store.ts", "hooks/use-delete-layers.ts", "hooks/use-local-board.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "app/board/[boardId]/_components/frame.tsx", "app/board/[boardId]/_components/toolbar.tsx", "tests/locks.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T09] enforce shared locks and accepted frame inheritance"
completion: "No"
execution: "not-dispatched"
phase: 5
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T09: Enforce shared locks and accepted frame inheritance

## Outcome

Protect all descendants of a locked frame and preserve individually locked children after parent unlock across the shared mutation paths.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/FEATURE-MAP.md`
- `store/use-board-store.ts:77`
- `hooks/use-delete-layers.ts`
- `app/board/[boardId]/_components/canvas.tsx`
- `app/board/[boardId]/_components/selection-tools.tsx`

## Bounds and proposed write scope

Accepted parent/individual semantics are fixed. Mixed-selection refusal, history exceptions, selection-through rules and long-press/other gestures remain proposals requiring alignment. Lock is editing protection, not auth/security.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Locking a frame protects ALL contained descendants, including nested frames and their contents; an unprotected child cannot escape the ancestor's effective protection.
- [ ] Unlocking a frame removes only inherited protection; each child's own independent lock remains set and effective.
- [ ] Reviewed move/resize/edit/delete/reparent/multi-select policies are enforced centrally across pointer, keyboard, menus and consumer mutation actions, not just disabled buttons.
- [ ] Expose a visible lock/unlock action with an accessible alternative; verify selected policy for undo/redo, intentional unlock and save/reload.
- [ ] Exercise parent-locked/child-unlocked, parent-locked/child-own-locked, ancestor unlock and nested ancestor cases with persisted state.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/locks.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 representation and T08 containment first. T01 selects reviewable defaults without silently accepting additional screenshot behavior.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
