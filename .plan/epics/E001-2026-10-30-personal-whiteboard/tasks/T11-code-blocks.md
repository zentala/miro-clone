---
formatVersion: 1
id: "E001-T11"
title: "Add syntax-highlighted code with size, line numbers and locks"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T09", "E001-T10"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "e001_t11_author (Herdr w5P:pK)"
write_set: ["types/canvas.ts", "types/board.ts", "lib/document-version.ts", "app/board/[boardId]/_components/code.tsx", "app/board/[boardId]/_components/code-editor.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "store/use-board-store.ts", "tests/code-blocks.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", "package.json", "package-lock.json"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T11] add syntax-highlighted code with size, line numbers and locks"
completion: "Yes"
execution: "completed"
phase: 5
completed_at: "2026-11-28"
commits: ["3a38b0f", "af0105e", "8d9af33"]
verification_evidence: ["2026-11-27 bounded package research under accepted PO condition f5270b9: npm registry reports codemirror 6.0.2 MIT; Bundlephobia full package graph 118750 bytes minified+gzip / 373186 minified. @codemirror/lang-javascript 6.2.5 MIT; graph 128676 gzip / 384023 minified. @codemirror/lang-json 6.0.2 MIT; graph 83551 gzip / 259862 minified. The graphs overlap and are not additive. Sources: https://registry.npmjs.org/codemirror/latest, https://registry.npmjs.org/@codemirror%2flang-javascript/latest, https://registry.npmjs.org/@codemirror%2flang-json/latest, https://bundlephobia.com/api/size?package=codemirror@6.0.2, https://bundlephobia.com/api/size?package=@codemirror/lang-javascript@6.2.5, https://bundlephobia.com/api/size?package=@codemirror/lang-json@6.0.2.", "Initial 2026-11-27 research found no task-specified language set and left the combined bundle NOT_CHECKED; no package was installed in that phase. ROOT clarified the existing accepted task authorizes a minimal reversible technical default: one @codemirror/lang-javascript grammar for JavaScript/TypeScript, with no language picker or autodetection. For codemirror@6.0.2 plus @codemirror/lang-javascript@6.2.5, both MIT, the conservative sum of the separately measured full package graphs is 247426 bytes minified+gzip, below the one-language 2x T01 lower threshold of 260000 bytes. The graphs overlap, so this upper bound is not the final deduplicated application bundle; measure the actual lazy-loaded bundle using the existing production build before acceptance. The existing PO condition permits installation for this exact set."]
evidence: ["2026-11-27 PO-accepted research selected the exact MIT CodeMirror 6.0.2 and @codemirror/lang-javascript 6.2.5 packages under the existing size condition. The 2026-11-28 final deduplicated lazy application bundle is 171245 gzip bytes across three chunks, below the 260000-byte limit; no picker, autodetection or extra grammar."]
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

No full IDE, execution engine or hand-written lexer. Under the existing PO condition,
the accepted dependency is CodeMirror 6.0.2 with the single MIT
`@codemirror/lang-javascript` 6.2.5 grammar for JavaScript and TypeScript.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [x] Code preserves whitespace/indentation through editing, reload, undo and redo.
- [x] Per-block font size, show/hide line numbers and common lock/unlock operate visibly and persist according to the reviewed history policy.
- [x] The accepted JavaScript grammar supplies JavaScript/TypeScript highlighting; it loads lazily with the editor on demand.
- [x] Code obeys accepted inherited frame protection; unlocking an ancestor preserves the code object's own lock.
- [x] Source is never executed. Language override/auto-detection, wrap, copy and themes remain out of scope.

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

Current state: delivered. ROOT selected the minimal reversible JavaScript/TypeScript
default through the single JavaScript grammar under existing T11 scope because this
repository's editor and application are already implemented in TypeScript/JavaScript;
one grammar covers both without adding language-picker state or autodetection rules.
This is a reversible technical default, not a new product-language choice. The
existing PO package/license/size condition permits installation for the exact
MIT packages recorded above. Final deduplicated lazy application bundle measured
171245 gzip bytes across three unique chunks against the 260000-byte threshold;
integrated acceptance passed. No picker, autodetection or extra grammar.
Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.

Final delivery, 2026-11-28: commits `3a38b0f`, `af0105e` and `8d9af33` are on `main`
and verified synchronized with configured `origin/main` at `8d9af33`. No private plan,
JOURNAL or transcript entered the product commits. Independent source review passed the
full diff `9fd5104..8d9af33`; ROOT inspected fresh narrow/wide captures, and no generated
screenshots entered Git. The final `just check` exited 0 in the clean review
worktree; TypeScript, lint, build and suites passed. Build artifact:
`.next/standalone/server.js` (4617 bytes); `/board/[boardId]` 41.5 kB / first load
191 kB. The existing `custom-color-picker.tsx:39` lint warning and packaging suite's
environment-dependent skip remain visible. Earlier missing-dependency, missing-worker
module and rich-text undo-timeout failures remain recorded in the same epic JOURNAL;
the isolated rich-text suite passed 5/5 and the subsequent complete check passed.
