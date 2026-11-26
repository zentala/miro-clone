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

## 2026-11-25 — E001-T18 integrated verification

- PO accepted T18 after independent review. The two T18 commits were rebased
  onto T23-integrated main without source conflicts; fresh `just check` exited 0
  with 88 passes and one expected skip. The successful build artifact was
  produced in the T18 worktree at `.next`.
- A later rebase included only the already-delivered T23 journal and task-record
  commit; no product source paths changed, so the T18 gate remains applicable.
  T18 is now fast-forwarded onto main after T23.

## 2026-11-25 — E001-T05 current-version gate failures

- The first T05 full `just check` exited 1 because `tests/critical-editor.test.cjs`
  still expected current saved documents to use schema v2 after the accepted
  v3 migration. The current-version assertions were corrected without changing
  the legacy input or unsupported-future-version cases; focused editor/model
  tests then passed 18/18.
- The next full `just check` also exited 1 at
  `tests/packaging.test.cjs:171`: a synthetic v2 request is correctly persisted
  as v3, but the packaging assertion still compares the stored row to the
  un-upgraded request. The failure is preserved; no packaging-test change has
  been made pending the owning PO's path disposition.
- PO then accepted the minimal current-schema assertion update in the packaging
  test and reaffirmed the standing rule for existing current-schema expectations
  in other suites. The T05 author reports the focused affected suites passed
  (35 pass, one expected skip) and the next full `just check` exited 0 with a
  production build. The original v2 input fixtures and future-version rejection
  checks remain in scope; independent review and the final rebase gate remain
  pending.

## 2026-11-25 — E001-T25 final verification

- The final candidate passed independent source and browser verification after
  rebasing onto the T18-integrated main. Full `just check` exited 0: 90 tests,
  89 passed and one expected container-only skip; the production build passed.
- At 2,000 objects, undo improved from 263.1 ms to 32.9 ms and drag p95 from
  216.6 ms to 16.7 ms; each run sent one patch. Both candidate measures meet
  the 100 ms target.
- Browser checks passed selector changes across rectangle, path, clear and a
  second rectangle, plus paint-order changes, insert, duplicate, delete, undo
  and reload. The selector bounds and handles updated immediately.
- The selection-panel overlap with the left toolbar was reproduced with the
  same geometry on baseline and candidate at 390 px and 768 px. This is a
  pre-existing narrow-layout issue and did not block T25 delivery.

## 2026-11-25 — E001-T05 phase-two implementation note

- The first search for the export handler in `toolbar.tsx` returned no match
  after T25 split the canvas into modules. The author continued by inspecting
  the split action modules; this search result did not establish a product
  failure.
- The first focused GIF asset run, `node --test --test-concurrency=1
  tests/assets.test.cjs`, exited 1: the new animated-GIF preservation case
  passed, while the existing T04 case still expected GIF to be unsupported.
  The accepted T05 behavior makes that expectation stale; other media-type
  rejection assertions remain required.
- An interim `just check` exited 0 after the phase-two type changes, but the
  image workflow test still only exercises the same-origin guard and the recipe
  does not run it. This is build/source evidence only, not image acceptance;
  the browser image flow and owning check coverage remain to be completed.
- A referenced local role detail was unavailable. It is already dispositioned
  nonblocking; no Harness repair or additional search is in scope.
- During later source discovery, image-layer and resize-symbol searches returned
  exit 2 and exit 1. These search results did not establish product behavior;
  the author continued by inspecting the current source modules and existing
  browser harness.
- Independent synthetic-browser WIP checks also passed file upload, pointer
  move, aspect-ratio-preserving resize, duplicate/delete, undo and reload, with
  the stored image reference intact. A separate narrow 390 px view showed the
  selected image and controls fitting. These are supplemental probes, not the
  final stable-source acceptance; redo and final independent checks remain.
- A later existing-harness scratch run also passed Ctrl+Shift+Z redo and exact
  asset-reference preservation through the edit/history/reload sequence. The
  author may adapt its selectors into the durable image browser test; the
  scratch run is not final-source acceptance.
- The first attempt to read that scratch used a stale result filename and
  exited 1. DM relayed the exact existing filename; no extra test run or
  product operation followed from the failed read.
- The first narrow image fixture resized the viewport after placing the image
  at wide-layout coordinates, leaving it offscreen. This is a fixture issue,
  not evidence of a responsive product defect. The narrow review uses a fresh
  390 px board with normal centered image insertion and retains actual layout
  assertions; the separately recorded baseline toolbar overlap remains intact.
- The first focused `node --test --test-concurrency=1
  tests/image-workflow.test.cjs` run exited 1 at that narrow-fixture step after
  the wide-position board stayed at its prior coordinates. The author is
  correcting the fixture to create and populate a fresh 390 px board.
- The corrected focused image workflow now passes `node --check` and
  `node --test --test-concurrency=1 tests/image-workflow.test.cjs`. The author
  reports coverage for upload/paste, durable original/reference, move/resize,
  copy/delete, undo/redo, reload and decoded export pixels. The fresh 390 px
  fixture reports a visible 200×100 image and handles; final visual review and
  full gate are still pending.
- The first headed-browser visual attempt exited 1 because no display server
  was available. A replacement browser service was then started but is outside
  the accepted route and will not be used. The author is stopping only the
  processes it started and returning to `Page.captureScreenshot` in the
  existing Node/CDP harness.

- Independent browser review found a reproducible image-resize failure: dragging
  the bottom-right handle to the top-left saves a zero-by-zero image; dragging
  the collapsed handle again produces a non-finite height and a visible save
  failure. This is limited to image geometry; existing vector behavior must stay
  unchanged. The T05 candidate is not accepted until the author adds finite,
  positive aspect-preserving resize behavior and a browser regression.

- The first focused image-workflow run after the resize correction,
  `node --test --test-concurrency=1 tests/image-workflow.test.cjs`, exited 1
  with four dependent browser steps skipped. The preceding `npm run build`
  exited 0. The detailed failed assertion is still being recovered from the
  worker's test output; this failed run remains separate from any correction or
  later passing retry.

- The exact first local F1-regression assertion failure was recovered: the test
  expected a 20 px edge but observed 21 px because the minimum-handle constraint
  and aspect ratio affect the rendered geometry. The author replaced the brittle
  pixel expectation with positive finite ratio/crossing invariants; this first
  failed run remains retained separately from the later passing run.

- The first DM lookup for the T06 task used a stale filename and returned
  `No such file or directory`; the canonical record is `tasks/T06-progressive-images.md`.
  No product files were changed by this failed read.

- Independent T05 verification startup recorded one generic `SKILL.md` read
  returning exit 1; the designated review-loop and design-review instructions
  were subsequently read, and review proceeded. No product code was involved.

- The independent T05 verifier's first focused image-workflow run exited 1
  because the clean verifier worktree had no production `.next` artifact; the
  shared-origin guard test passed but browser app startup failed. The verifier
  retained this result, ran the owning full `just check` to build the candidate,
  then reran the focused test. This setup-order failure remains distinct from
  the product regression and later results.

- Independent T05 round 2 found F2 at the document/API boundary: the validator
  still accepts a zero-width or zero-height ImageLayer, and a stored invalid
  image cannot recover through a later resize. The current evidence contains no
  released T05 v3 image documents; the existing live backup predates image
  support, and zero-size examples so far are disposable synthetic review data.
  Correct only image geometry validation and its API/document regression. Keep
  v1/v2 vector documents and zero-size vector geometry compatible; do not bump
  the schema or migrate production data for this unreleased synthetic case.

- T05 F2 correction rejects zero width or height for image layers and leaves
  zero-size vector geometry valid. The author reports the API returns 400
  `invalid-schema` without changing SQLite; v2/current-v3/future-version tests
  remain. The original 0c33c83 feature and separate 347bf6f resize correction
  remain intact; F2 is separate commit 5d58db8.
- ROOT's independent round 3 on the clean 5d58db8 candidate passed the source,
  document/API, browser and screenshot checks. The focused model/image run
  passed 19 tests; the author separately reports full `just check` exit 0 and
  build artifact `.next/standalone/server.js`. Round 2 FAIL F2 stays preserved
  in its report history. T05 still needs rebase on current main, a fresh integrated
  `just check`, and normal push before task completion.

## 2026-11-25 — E001-T05 accepted and delivered

- The image-layer implementation and both confirmed corrections are integrated
  on main through commits `c6bb990`, `38abc40`, `1d362f5` and `440ba23`; the
  source push to `origin/main` succeeded. Earlier F1/F2 FAILs remain recorded in
  the same independent-review campaign, and the separate correction commits
  preserve their history.
- The post-rebase integrated `just check` exited 0 and produced
  `.next/standalone/server.js`. The existing color-picker lint warning remains;
  the packaging recipe skipped its explicitly opt-in container-only test.
- ROOT round 3 independently passed the image-only document/API boundary,
  zero-size vector compatibility, browser regression and screenshots. The
  round-3 focused model/image run passed 19 tests. The authored visual assets
  remain at the tracked wide and narrow paths; screenshots regenerated by the
  final check were restored to their reviewed versions.
- No T05 v3 live image document was released or known; the existing backup
  predates image support. Zero-size image samples were synthetic. No live data
  was read or changed.
- The inherited viewport-sized PNG export observation remains Low/2p and
  nonblocking. T05 is marked done; next ready authoring is T06/T10 on disjoint
  worktree paths, with their shared check/docs/package paths serialized.

- The initial root worktree-config check ran `cat .giter.yaml` and exited 1
  because this repository has no root config file. No worktree was created by
  that command; use the installed `wt-add` default placement helper.

- T06's first visible Codex launch showed the default model instead of the
  required delivery profile. Its preflight completed without product edits and
  reported a shell working-directory variable expansion during instruction
  lookup, contrary to the no-variable-read instruction. The initial session is
  held; relaunch with the required explicit role flags and literal paths before
  any edit release.

- T10 preflight used an unnecessarily broad file-name search outside the
  owning repository, contrary to bounded source discovery. No unrelated file
  contents or product files were read or changed; the author has been told to
  keep further discovery inside this repository.

- T06 WIP review found an EXIF orientation mismatch in generated image
  variants: a synthetic orientation-6 JPEG changes from portrait to landscape
  between the original and resized WebP. The original remains byte-preserved;
  the author is correcting oriented dimensions/metadata and adding a regression
  with the existing image library. This is not a final review verdict.

- The host roster briefly rose above its ceiling during concurrent work. DM
  interrupted only the newly started T10 source turn before edits; T10's
  worktree remained clean and foreign sessions were untouched. A fresh roster
  briefly returned within the stated limit, but later concurrent starts raised
  it again. The latest observed roster is 13 active agents plus ROOT, above the
  host ceiling; further own worker turns wait for an observed slot.

- During T06 work, an unnecessary agent-routing detour called
  `codex_tui.list_threads`; the tool returned `limit must be between 1 and 50`.
  DM interrupted the detour and redirected the author to the existing `dm-miro`
  Herdr route. No new agent or hidden delegation was started.

- The first T06 browser-test attempt could not load the existing Next.js
  dependency because the task worktree has no installed `node_modules` yet.
  `node --test --test-concurrency=1 tests/critical-editor.test.cjs` exited 1.
  The worktree has a local `node_modules` directory, not a symlink, but Next.js
  is absent; `.next` is absent too. This first setup/test failure is retained.

- DM ran `npm ci` in the owned T06 worktree using its existing committed
  lockfile. It exited 0 and installed 423 packages; the local `node_modules`
  path was not a shared link. No product manifest changed. ROOT now owns the
  bounded draft build/browser check, so DM is not running a concurrent Miro
  build or gate.

- T06's first `node --test --test-concurrency=1 tests/progressive-images.test.cjs`
  exited 1 because the new orientation test loader stub omitted the oriented-
  dimensions export. The author corrected the mock in the same test file; a
  later focused run passed. Keep that first test failure separate from the
  missing-Next browser-test failure.

- ROOT's independent build of a stable T06 draft passed and produced the
  standalone server. The real `critical-editor` run exited 1 with 9 passes and
  2 failures: the zoom network step and EXIF upload/original-byte assertions
  passed, but the final asset-report assertion still expected the old single
  reference and an empty unused-assets list. The new zoom asset is referenced;
  the EXIF fixture is intentionally unused. ROOT found no dangling, missing or
  unregistered entries. Preserve this test FAIL and correct only the fixture
  expectation when author work resumes; it is not evidence of corrupted product
  data. ROOT's existing `image-workflow` run exited 0 with 12 passes; its actual
  wide and narrow screenshots passed for the pictured states. Its 20-image
  sample transferred 14,006,463 bytes and observed 8 positive-transfer
  concurrent requests. ResourceTiming's raw peak 12 includes eight aborted
  zero-byte intervals; decoded memory remains NOT_CHECKED. This is sample
  evidence, not complete T06 workload acceptance. ROOT's temporary checks are
  complete; DM ran no concurrent build or gate.

- The first DM handoff submission to the restored T06 author did not run:
  Bash reported `unexpected EOF while looking for matching \"` because the
  shell-quoted Python command contained an apostrophe. Herdr received no prompt;
  the accepted handoff is being resubmitted through a safe argv call.

- W2 image measurement is traced to the existing ARCH representative workload
  and independent ROOT review, not a new operator decision. The task note now
  records that source; existing proposed thresholds and PO dispositions remain
  unchanged.

- Independent source review of the T10 draft found Bold, Italic and Done controls
  wired only to mouse-down, so native keyboard activation does not perform the
  action. The focused rich-text unit test passed 3/3 but does not cover this
  browser behavior. Keep the finding open for mouse/keyboard regression and
  canvas-shortcut isolation; no build or runtime acceptance has been claimed.

- T06's first W2 image-slice test exited 1 before fixture generation because the
  disposable SQLite database had not initialized its `assets` table. The author
  added initialization through the existing boards API before the retry. Retain
  the initial failure separately from any later result; no application database
  was used.

- Independent ROOT review of the active T06 W2 measurement found its 800 images
  are all 490,000 pixels each, below ARCH's 0.3–24 MP representative range; report
  this reduced source-size coverage and actual bytes without claiming 24 MP.
  The 250 ms fit and 500 ms final snapshots can pass while visible requests remain
  outstanding, so they do not establish completed preview bytes or stable cache
  behavior. After the active run finishes, retain loaded/rendered/failed and
  active/pending counts at bounded checkpoints, distinguish cancellations from
  failures, and correct the measurement if the preview is still outstanding.
  This is an existing-criterion measurement correction, not a new threshold.

- The next T06 W2 measurement run exited 1 after fixture generation: its rendered-
  object assertion waited for 2,000 `<g>` groups, but 1,200 of the synthetic
  non-image objects render as `<rect>`. This was a test selector mismatch, not an
  application result. Preserve the failed run; the author is correcting the
  selector and reducing deterministic fixture-generation cost before a retry.

- The corrected T06 W2 image-slice test passed 1/1 with 800 image sources among
  2,000 objects. Sources were 490,000 pixels each and totaled 786,757,308 bytes,
  below ARCH's source-size range; the report does not claim 24 MP coverage. At
  the manually selected 10% camera scale, the 250 ms snapshot had 73 requests
  started and 8 active, but did not count loaded/rendered previews. Across later
  zoom, pan and DPR changes, the run saw 175 requests, 108 complete bodies, 67
  cancellations and final active=0; those totals do not establish first-view
  completion. Decoded memory remains NOT_CHECKED. ROOT is independently checking
  actual SVG image loads at the first-view checkpoint before the next scoped test
  correction; no full W2 or whole-task acceptance is claimed.

- ROOT's independent full-fit run then observed all 800 SVG images loaded with
  zero errors and zero active requests. At width 160, first-view bodies were
  15,051,756 bytes, Resource Timing transfer was 15.29 MB, and the full preview
  took about 5.1 seconds. This exceeds the existing proposed W2 bounds of 8 MB
  and 4 seconds. The current minimum preview is too large; T06 remains open for
  a smaller real preview and a durable first-fit checkpoint. Do not change the
  thresholds or accept the task on the passing diagnostic exit alone.

- Resume check: `herdr agent list --workspace w57` returned usage because this
  command accepts no workspace option; the unfiltered list worked and was
  filtered locally. `herdr agent get t06-impl` returned `agent_not_found`; no old
  worker history was opened. The preserved T06 worktree is unchanged and will be
  resumed in a new visible session after its filesystem preflight.

- T06 resumed in its preserved isolated worktree after a fresh compatible
  filesystem preflight. The prior author binding was no longer live; no old
  history or task source was discarded. The current author received the scoped
  correction for the undersized first preview and a real first-fit 800-image
  load/bytes/time checkpoint. Existing limits, original bytes, orientation, GIF
  behavior and prior measurements remain in force; independent verification is
  still pending.
- 2026-11-26 DM integration preflight: `git fetch origin` succeeded. The
  combined lookup `git rev-parse --short HEAD origin/main` exited nonzero
  (`fatal: Needed a single revision`) because it passed two revisions to one
  single-revision command. No repository state changed; retry with separate
  lookups and keep this command error in the record.
- 2026-11-26 T06 final gate: `just check` ran in the clean candidate worktree
  at `3590bc4`. Build output completed and produced
  `.next/standalone/server.js`; critical editor passed 11/11, image workflow
  12/12, progressive images 5/5, navigation/capacity 10/10, exporter 16/16,
  document model 7/7, board store 4/4, and remaining reported suites passed.
  The packaging suite had its existing container-only test skipped. The final
  selector regression reported PASS. After process completion,
  `write_stdin` returned `Unknown process id 8346` while retrieving the closed
  session, so the shell exit code was not separately surfaced. No test failure
  appeared in the completed output.
- 2026-11-26 T10 capacity preflight: the first `herdr agent list | jq` filter
  failed to compile (`jq: error: syntax error, unexpected INVALID_CHARACTER`)
  because the `select(...)` expression lacked a closing parenthesis. No agent
  was started and no repository state changed; rerun the read with a corrected
  filter before any model start.
- 2026-11-26 T10 capacity preflight retry: the second `jq` expression printed
  `6` for its first count, then failed on the second expression with
  `Cannot index array with string "result"` due to filter precedence. No
  agent was started. Preserve this parser error and obtain a single correctly
  composed JSON count before starting.
- 2026-11-26 T10 worker preflight: the worker's initial read command also ran
  `hostname`, which the brief did not include in its explicit preflight
  allowlist. No product edits were reported. A `herdr agent read ... --source
  recent --lines 60` attempt while the worker was active returned
  `agent_not_idle`; this is a tool lifecycle restriction, not a worker failure.
  Wait for the existing preflight to finish, preserve its exact receipt, and
  do not release source edits until effective mode and roots are confirmed.

- 2026-11-26 T06 accepted delivery: PO accepted candidate 3590bc4 after ROOT's
  fresh-build and 17-pass independent focused review (first fit 633,468 B /
  2,030.5 ms; 800/800 loaded, no errors/pending/original fetches; peak 8;
  scoped wide/narrow visual PASS). Earlier 15,051,756 B / ~5.1 s and fixture
  failures remain as historical findings, resolved for this candidate. The
  candidate was a clean fast-forward over origin/main, integrated on main and
  pushed to origin/main. Coverage limits remain 490,000-pixel sources from 9
  templates, decoded memory NOT_CHECKED and full mixed W2 NOT_MEASURED.
- 2026-11-26 T10 preflight receipt: author reported UID 1000, correct worktree
  Git root and branch, preserved dirty files, and a successful in-worktree
  touch/check/remove probe. Runtime reported `permission_profile=disabled` and
  `file_system=unrestricted`, with the required worktree as workspace root;
  this is compatible with the released paths. The extra `hostname` invocation
  was disclosed, with no product edit. DM released only local-font and
  keyboard-action corrections; the author is active in visible tab `w5F:t3`,
  worktree `.plan/worktrees/e001-t10`, and has been told to preserve WIP, use
  focused T10 checks only, and wait for explicit release before any build/full
  `just check`.
- 2026-11-26 JOURNAL patch attempts: two context-based `apply_patch` attempts
  failed without changing the file because their expected trailing context did
  not match. The receipts above were then appended directly.
