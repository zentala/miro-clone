---
formatVersion: 1
id: "E001-T09"
title: "Enforce shared locks and accepted frame inheritance"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T03", "E001-T08"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t09-impl"
write_set: ["types/canvas.ts", "types/board.ts", "lib/object-locks.ts", "store/use-board-store.ts", "hooks/use-delete-layers.ts", "hooks/use-local-board.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "app/board/[boardId]/_components/selection-box.tsx", "app/board/[boardId]/_components/frame.tsx", "app/board/[boardId]/_components/toolbar.tsx", "tests/locks.test.cjs", "tests/critical-editor.test.cjs", "tests/document-model.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): enforce shared object locks"
completion: "Yes"
execution: "completed"
phase: 5
completed_at: "2026-11-27"
commits: ["a930d747fe76c0f86fe4ea7fd0e1d9c85110a308", "8df8be95347ad4a91e6e010ed32b7bbefc62916e"]
verification_evidence: ["just check: exit 0; TypeScript, lint, production build, all configured suites, and selector regression passed. Existing custom-color-picker useMemo warning remains.", "node --test --test-concurrency=1 tests/document-model.test.cjs tests/locks.test.cjs tests/board-store.test.cjs: exit 0, 18/18 tests.", "node --test --test-concurrency=1 tests/critical-editor.test.cjs: exit 0, 13/13 tests, including lock visual states."]
evidence: ["Independent ROOT source review passed after corrections for unlocked z-order, clearing the optional lock field, the document-model locked-parent fixture, and accepted T09 visuals.", "Browser inspection confirmed hover/focus-visible styling, neutral-400 outline, lock badge position/size, and unchanged resize geometry.", "Build artifact: .next/standalone/server.js (4,607 bytes)."]
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

The controlling accepted outcomes are PO decisions 2–3 in [FEATURE-MAP](../../../FEATURE-MAP.md#po-decisions-on-defaults-and-t01-evidence-2026-11-08) and [PLAN](../PLAN.md#po-acceptance-of-t01-2026-11-08): effective frame locks protect all descendants; unlocking removes only inherited protection; geometry changes on a mixed locked/unlocked selection refuse with a reason; locked children cannot be reparented or multi-transformed and drops into locked frames are refused; effective locks block fill, z-order, text edits and deletion; selection, copy and export remain available; duplicates are unlocked copies; lock toggles appear in the object toolbar and context menu; lock changes are history entries; Ctrl+Shift+L is the accessible keyboard alternative. Long-press, selection-through and history exceptions beyond ordinary lock-change undo/redo remain proposals and are out of scope. Lock is editing protection, not auth/security.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [x] Locking a frame protects ALL contained descendants, including nested frames and their contents; an unprotected child cannot escape the ancestor's effective protection.
- [x] Unlocking a frame removes only inherited protection; each child's own independent lock remains set and effective.
- [x] Reviewed move/resize/edit/delete/reparent/multi-select policies are enforced centrally across pointer, keyboard, menus and consumer mutation actions, not just disabled buttons.
- [x] Expose a visible lock/unlock action with an accessible alternative; verify selected policy for undo/redo, intentional unlock and save/reload.
- [x] Exercise parent-locked/child-unlocked, parent-locked/child-own-locked, ancestor unlock and nested ancestor cases with persisted state.

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

Current state: delivered; completion Yes. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: locks now protect descendants through shared mutations. The selection toolbar,
context menu and Ctrl+Shift+L toggle locks; locked selections show the accepted neutral-400
outline and top-right Lock badge; lock changes participate in undo/redo, and duplicates are
unlocked. The final full check passed with the existing lint warning noted above. Earlier
failures and their corrections remain in the private epic journal; the focused rich-text
rerun and final full check both passed after intermittent rich-text timeouts.
