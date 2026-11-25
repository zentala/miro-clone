# Planning journal

## 2026-10-30 — Scope and source review

Existing author session, documentation only. Read root instructions, purpose,
vision, architecture, accepted ADR/feature map and actual model/SQLite/store/
canvas/packaging/check sources. No product change, source account or runtime
operation. Earlier app failures/passes remain in AGENTS and are not new runs.

## 2026-10-30 — Record creation and author-side correction

Created one umbrella and 22 pending task records with no executor/evidence.
One author-side generation call failed with JavaScript SyntaxError:
Unexpected identifier 'zentala', before any filesystem command ran. Corrected
quoting and continued; no product test failed or runtime state was touched.

## 2026-10-30 — Early independent plan corrections

ROOT source review identified first-import dependencies as excessive (High,
3 points), commit subject convention (Medium, 1 point), table priority (Medium,
1 point), and missing early-value/phase semantics. Applied within planning:
T17 no longer hard-depends on T10/T11/T19, only imports actually supported
models and retains/reports unknown raw records. T21 still accepts all required
features. T19/T20 are Medium/medium; proposed subjects use conventional feat
or output-appropriate docs/build/test. Phases are groupings, not sibling barriers;
reviewed partial delivery may use the existing infrastructure owner under
separate authorization. Task count 22 and scope estimate 155 are unchanged.

## 2026-10-30 — Planning-only verification

Bounded ad hoc validation exited 0: 22 pending records, 155 points, acyclic
DAG, phase totals 5/21/40/26/32/13/13/5, 233 local links/anchors, 27 exact new
public plan paths, 12 ignored private-path examples, exact 31-path change set
and empty index. The check also verified the corrected importer prerequisites,
full-acceptance dependencies, Medium table priority and conventional subjects.
Git diff --check exited 0. No validator/framework is committed; no unchanged
app build/browser check was rerun. Earlier failures remain recorded separately.
Plan-content independent final review passed; content accepted. Runtime readiness
NOT_CHECKED, execution not dispatched, all task statuses pending/completion No.

## 2026-10-30 — Final independent format/scope corrections

ROOT requested the owning format's exact Schema impact heading and removal of
replacement-editor comparison from T01. Applied both: discovery compares only
minimal patches versus coherent model extension within the accepted stack.
Renderer/product/stack replacement remains excluded. No task/dependency/point
change or product edit follows from these corrections.

## 2026-11-08 — E001-T02 incident: worktree node_modules deleted during a mutation test

- What happened: while checking that new packaging tests catch regressions, the T02 implementer made a
  deliberately broken copy of its worktree whose node_modules was a symlink back to the worktree; removing
  the copy deleted the worktree's real node_modules.
- Impact: limited to the T02 worktree. Main checkout and the T03/T15 worktrees were checked and intact;
  sources unchanged; `npm ci` restored the dependencies; later copies got their own install.
- Rule since then (PO): never delete directories that contain symlinks; make test copies with `cp -a`
  without symlinking node_modules or other shared directories.

## 2026-11-08 — E001-T07 findings during baseline measurement

- Baseline A (unchanged code): 2000/10000-object boards are refused at read (HTTP 409,
  `invalid-schema`); a 100-object drag sends 20 full-document saves (609 KiB).
- Baseline B (only both 100-layer caps raised, renderer unchanged): 2000 objects pan at
  about 1 s per frame. Cause: `useStorage` built a full layer `Map` per call, once per
  layer component (quadratic), and every cursor move re-rendered all layers. 10000 objects
  did not finish one measurement case in 14 minutes; the run was stopped.
- Store work per edit was about 50 ms at 2000 objects (deep clone plus two full-document
  `JSON.stringify` per mutation). T07 replaced it with copy-on-write history.
- Drag on a large board landed further than the pointer: the translate offset came from
  render state, so pointer moves that arrived before a re-render repeated an offset.
  Fixed with a synchronously updated ref; the 2000-object browser step caught it.
- A plain SVG grid `<rect>` would have made an existing critical-test check
  (`svg.querySelector("rect")`) pass trivially, so the grid is a CSS background.
- Interrupted measurement runs leave Chromium singleton symlinks in their temp profile;
  they were unlinked before removing the directory (2026-11-08 rule).

## 2026-11-25 — T05 full-check result before version-guard correction

- `just check` exited 1. TypeScript, lint and production build completed; the
  critical browser flow failed at board creation because
  `tests/critical-editor.test.cjs` expected `schemaVersion: 2` while the API
  returned the current `schemaVersion: 3`. The eight dependent browser steps
  were skipped and owned-process cleanup completed. No image-layer browser
  behavior was exercised by this run.

## 2026-11-25 — Delivery resume diagnostics

- Herdr read of `po-miro` with `--source recent-unwrapped --lines 160` returned
  `agent_not_idle`: alternate-screen history could not be captured while PO was
  working. A supported `--source visible` read then succeeded and showed the PO
  release in progress. This was a read limitation, not an operation refusal.
- `cat .giter.yaml` exited nonzero because the repository has no `.giter.yaml`.
  The `wt-add` launcher resolves to the Harness helper; no worktree was created.
  Inspect the helper defaults and existing repository configuration before using
  its supported defaults.
- The first journal append patch failed because its context did not match the
  actual final line. The actual journal tail was read, and this entry records the
  observed diagnostics before proceeding with worktree creation.
- One attempted follow-up edit used stale context and failed before writing.
- T18 review found that root instructions reference expanded role-detail files
  unavailable in the worker context. PO confirmed the task's controlling
  sources and released T18 to proceed; PO will route the reference defect to
  Harness. It does not block this task.
- An initial lifecycle-skill lookup used a stale location and returned
  `No such file or directory`; no lifecycle operation was attempted. The
  installed owner skill was then located and read.

## 2026-11-25 — T18 independent review finding

- ROOT's synthetic review found that backup deduplication can miss an SQLite
  update committed to WAL and incorrectly return the older archive as unchanged.
  A keeper-connection update reproduced the false skip. The T18 implementer was
  asked to compare a consistent staged snapshot and assets, add a regression
  test, and preserve history. Prior-archive integrity before a skip and
  same-second destination collisions remain unverified; independent re-review
  and `just check` are still required.
- ROOT review also found T18 refusing backups when the registered-asset table
  is empty, which blocks valid image-free boards. PO clarified that `boards`
  must be nonempty; zero assets is valid when unreferenced, missing referenced
  rows or bytes fail, and a pre-T04 database without an assets table is read as
  zero assets without changing its schema. Synthetic cases cover each boundary;
  independent re-review and `just check` remain required.
- Before the PO's latest task-record update, T18 had begun work on its isolated
  branch from the previous main revision; its worktree contains uncommitted
  changes in `lib/assets.ts` and `scripts/backup.mjs`. T23's worktree is clean.
  Preserve T18's work and keep the required T23-first integration order.
- T18's initial fsync behavior test exited 1 because the existing committed
  `@napi-rs/image` dependency was not installed in that worktree. PO authorized
  `npm ci` from the existing lockfile in both owned worktrees. Keep the runtime
  fsync assertion meaningful; do not replace it with a source-text check. Retain
  this failure and rerun the test and full `just check` after installation and
  correction.
- A request to read 200 lines of T23's alternate-screen history while the agent
  was blocked returned `agent_not_idle`; Herdr allows only a visible read in
  that state. This is a read limitation, not an execution refusal.
- While traversing T23's queued questions, the visible responses appear to have
  been applied to the opposite question order: the test-path question shows
  `No`, and the JOURNAL-only question shows `Yes`. This conflicts with PO's
  explicit disposition. Pause T23 edits and verify/correct the native UI before
  resuming; keep JOURNAL DM-owned.
- T23 then wrote a JOURNAL entry in its isolated worktree under that reversed
  response, although PO reserved the shared journal for DM. Stop the write,
  inspect the exact T23 diff, and remove only the worker's unauthorized journal
  edit before resuming its accepted test task.
- During T23 implementation, the visible diff also showed a change to
  `tests/document-model.test.cjs`, outside the then-approved write set; the
  committed fixture itself is within `tests/fixtures/`. Pause further edits and
  route this necessary test-source path to PO before accepting it.
- ROOT's independent T23 review found that the proposed container-check cleanup
  removes every Podman image appearing after a global before/after listing,
  which can delete images owned by concurrent projects. This is High/3p; do not
  run that cleanup block. Restrict removal to positively owned build artifacts
  and prove a concurrently created foreign image is preserved with a fake
  Podman executable. No real shared-image deletion was attempted. Independent
  re-review and the required checks remain outstanding.
- ROOT reproduced the T23 cleanup defect with a fake Podman executable: the
  recipe exited 0 and issued `rmi --force foreign-concurrent`. No real image
  storage was touched. The source finding is now a reproduced behavior failure;
  preserve it and independently verify the owned-artifact-only correction.
- Independent round 2 closed this cleanup finding: the corrected fake-Podman
  run exited 0, preserved the foreign image, and removed only the unique
  task-owned tag. No real shared image storage was touched. Full T23 gates and
  final independent review remain pending.

## 2026-11-25 — E001-T23 integrated check

- PO accepted the final independent T23 round 2 report. The three verified
  commits were rebased on current main and fast-forwarded as the first epic
  integration; the changed task files were limited to the accepted T23 paths.
- The first integrated `just check` exited 2 before tests because TypeScript
  could not find the existing `@napi-rs/image` module imported by
  `lib/assets.ts`. This is retained as a failed dependency-setup run. Install
  from the existing package lock, then rerun the integrated gate; do not alter
  the source import or weaken tests.
- `npm ci` from the committed package lock completed successfully. The fresh
  integrated `just check` then exited 0: 65 tests passed, one packaging test was
  expectedly skipped, and the production build succeeded at `.next`. The
  existing `lastUsedColor` lint warning remains unsuppressed.
- The PO-required integrated `just container-check` ran once and exited 0. Its
  packaging tests passed 2/2 with one expected skip, and the critical editor
  browser test passed 10/10. The fake-Podman regression remains the evidence that
  foreign image tags are preserved; this run did not exercise a real shared-image
  deletion probe.
