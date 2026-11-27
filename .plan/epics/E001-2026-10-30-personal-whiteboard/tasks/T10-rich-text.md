---
formatVersion: 1
id: "E001-T10"
title: "Add durable rich text and font controls"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T03"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "codex-ts-dev (Herdr w5P, T10 finalize worktree)"
write_set: ["types/canvas.ts", "types/board.ts", "lib/rich-text.ts", "app/board/[boardId]/_components/text.tsx", "app/board/[boardId]/_components/note.tsx", "app/board/[boardId]/_components/rich-text-editor.tsx", "app/board/[boardId]/_components/canvas.tsx", "app/layout.tsx", "app/board/[boardId]/_components/info.tsx", "store/use-board-store.ts", "tests/rich-text.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", "package.json", "package-lock.json", "public/fonts/**"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): add rich text editor"
completion: "Yes"
execution: >-
  Completed after independent source review and the final integrated gate.
  Original feature commit 5e28285 is on main; reviewed keyboard-selection
  correction cde7955 is based on main 3c86789 and is pushed to origin/main.
  Final just check in the correction worktree exited 0. Focused rich-text
  suite exited 0 (5/5); critical-editor suite exited 0 (13/13). Production
  artifact: miro-clone/.plan/worktrees/e001-t10-finalize/.next/standalone/server.js
  (4,616 bytes). Earlier syntax, focus, selection, paste-fixture and build
  failures remain in verification_evidence/JOURNAL; affected final scenarios
  passed. Existing lint warning at components/custom-color-picker.tsx:39
  remains. npm ci reported 20 existing advisories; no audit fix was run.
  Post-check generated T05 PNGs were reset in the task worktree by the worker;
  the root's foreign dirty T05 PNGs were preserved. No plan notes or PNGs were
  included in either source commit.
completed_at: "2026-11-27"
phase: 3
commits: ["5e28285", "cde7955"]
verification_evidence: ["npm run build in miro-clone/.plan/worktrees/e001-t10: exit 0; log /tmp/miro-e001-t10-fresh-build-20261126.log, sibling exit file /tmp/miro-e001-t10-fresh-build-20261126.exit; artifact miro-clone/.plan/worktrees/e001-t10/.next/standalone/server.js (4,607 bytes)", "node --test --test-concurrency=1 tests/rich-text.test.cjs: exit 1, 4 pass / 1 fail; test-side SyntaxError at rich-text.test.cjs:86 while evaluating the nested Pen selector; product editor behavior after setup is NOT_CHECKED. Log /tmp/miro-e001-t10-rich-text-browser-20261126.log and sibling exit file /tmp/miro-e001-t10-rich-text-browser-20261126.exit.", "Final correction commit cde7955 based on main 3c86789; independent source review PASS. node --test tests/rich-text.test.cjs exit 0 (5/5); node --test tests/critical-editor.test.cjs exit 0 (13/13); final just check exit 0. Artifact miro-clone/.plan/worktrees/e001-t10-finalize/.next/standalone/server.js (4,616 bytes). Commit pushed to origin/main and fetch verified local main equals origin/main at cde7955.", "Root dirty T10 record contained duplicate completed_at fields and WIP narrative; reconciled here while retaining historical failures and ROOT's unrelated dirty files. Worker reset post-check generated T05 PNGs only inside the T10 finalize worktree; root dirty T05 PNGs remain preserved."]
evidence: ["Historical selector SyntaxError, focus/setup, selection and paste-fixture failures remain preserved as separate receipts; final focused suites and integrated just check passed after the reviewed correction", "T10 complete on main at cde7955 (original feature 5e28285); final just check exit 0, rich-text 5/5, critical-editor 13/13; artifact 4,616 bytes. origin/main verified synchronized. Existing lint warning and 20 npm advisories reported."]
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

DM scope note, 2026-11-25: local-font migration may minimally edit
`app/layout.tsx` and `app/board/[boardId]/_components/info.tsx` in addition to
the listed font/editor paths. Keep T06's exclusive `tests/critical-editor.test.cjs`,
`justfile`, and `DESIGN.md` window serialized.

## Acceptance criteria

- [ ] No `next/font/google` import remains: every font (Inter, Kalam, Source Serif 4, JetBrains Mono) loads from local files, so `just build` and the image build need no font download (observed retries on 2026-11-08).

- [ ] Stored text HTML is sanitized before rendering (`text.tsx:61`), including legacy documents; a test with a script/event-handler payload proves nothing executes.
- [ ] Before installing the editor, confirm the current maintained major (Tiptap 2 vs 3, T01 verifier F3) and its licence; bundle Inter (OFL) for board titles.

- [ ] Font family/size, bold, italic and text color work through real editing controls without losing the user's text or triggering canvas shortcuts while typing.
- [ ] On real default 100x100 note and text layers, editing remains usable and every toolbar control plus Done stays reachable; preserve the existing floating selection-panel direction and do not resize persisted objects to hide clipping.
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

Independent ROOT source finding, 2026-11-25 — F1 Medium/3p: Bold, Italic and
Done controls currently rely on `onMouseDown`, so native keyboard Enter/Space
activation does not perform the action. Preserve selection via `preventDefault`
while supporting mouse and keyboard activation exactly once. Verify actual
browser behavior and isolation from canvas shortcuts. **Resolved:** author moved
editor focus before the click action; reviewed browser tests confirm mouse,
Enter and Space each perform Bold/Italic/Done once, retain selection, and do not
trigger canvas shortcuts.

Current state: complete and integrated. Focused browser suites and final `just
check` passed after independent review; see verification_evidence above for
exact exits. Earlier failures remain recorded and were not counted as passes.
Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
