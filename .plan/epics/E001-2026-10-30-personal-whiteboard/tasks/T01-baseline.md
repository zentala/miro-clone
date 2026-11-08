---
formatVersion: 1
id: "E001-T01"
title: "Establish source baseline, design decisions and workload"
status: "done"
priority: "high"
type: "improvement"
dependencies: []
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "t01-impl (Herdr w2G:p3, claude)"
write_set: ["DESIGN.md", ".plan/ARCH.md", ".plan/FEATURE-MAP.md", ".plan/epics/E001-2026-10-30-personal-whiteboard/PLAN.md", ".plan/epics/E001-2026-10-30-personal-whiteboard/HANDOFF.md"]
handoff_ref: "../HANDOFF.md"
verification: ["git diff --check"]
commit: "docs(plan): [E001-T01] establish source baseline, design decisions and workload"
completion: "Yes"
execution: "dispatched 2026-11-08 by dm-miro"
phase: 1
completed_at: "2026-11-08"
commits: ["7c06a69"]
verification_evidence: ["git diff --check exit 0 (implementer and verifier)", "independent verifier t01-verify: PASS 5/5 criteria, 35 path:line citations checked, synthetic store-cost measurement reproduced (~30 ms/MiB)"]
evidence: ["PO po-miro accepted 2026-11-08: @napi-rs/image (MIT) over sharp; workload matrix accepted as measurement plan, numeric thresholds set by T07 after browser measurement; Inter font; frame/lock clarifications 1-3 accepted", "Verifier findings: F1 Low/1p -> T07, F2 Medium/2p -> T07 entry criterion, F3 Low/1p -> T10, F4 Low/1p -> PO"]
---
# E001-T01: Establish source baseline, design decisions and workload

## Outcome

Give later executors a measured source baseline, reviewed design/default choices and a synthetic representative-workload specification before changing the model.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `types/board.ts:19`
- `lib/sqlite.ts:16`
- `DESIGN.md`
- `package.json:11`
- `tests/critical-editor.test.cjs:88`

## Bounds and proposed write scope

Source and design discovery only; no real board access, no package installation and no feature code. Library/default recommendations remain proposals until accepted. Do not add a new validation framework.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Record existing five layer types, both 100-layer limits, snapshot-save/history behavior and missing models with source references.
- [ ] Compare only minimal patches against a coherent shared-model extension within the accepted React/SVG/SQLite fork. Recommend the shared extension boundary with source evidence; replacing the renderer, editor, product or stack is explicitly out of scope.
- [ ] Record proposed editor/highlighter/table/image-processing library choices and license/bundle implications; selecting a dependency does not install it.
- [ ] Define generated image-heavy workload counts, viewport/DPR/zoom cases, baseline measurements and target bounds before performance implementation. Leave thresholds explicitly proposed until agreed.
- [ ] Resolve or carry explicit owner choices for frame resize, mixed selection, unlock gestures, first table slice and essential fonts. Do not reopen accepted all-descendant lock inheritance or preserved individual locks.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: inspect source references, reviewed defaults/library options and workload design;
documentation-only output does not require an unchanged app build or prove behavior.

## Known gating and evidence

No external data prerequisite for this task. Decisions needing owner alignment hold only dependent behavior; source discovery continues. Runtime availability and dependency choices are not proven by this plan.

Current state: done 2026-11-08; independently verified PASS and accepted by PO; integrated as 7c06a69. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
