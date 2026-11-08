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
