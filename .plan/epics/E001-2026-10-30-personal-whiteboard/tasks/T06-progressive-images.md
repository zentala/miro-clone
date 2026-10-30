---
formatVersion: 1
id: "E001-T06"
title: "Generate variants and bound viewport image loading"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T05", "E001-T07"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["lib/image-variants.ts", "lib/assets.ts", "types/asset.ts", "hooks/use-visible-assets.ts", "app/api/assets/[assetId]/route.ts", "app/board/[boardId]/_components/image.tsx", "tests/progressive-images.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", ".plan/ARCH.md", "package.json", "package-lock.json"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T06] generate variants and bound viewport image loading"
completion: "No"
execution: "not-dispatched"
phase: 5
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T06: Generate variants and bound viewport image loading

## Outcome

Make image-heavy boards load gradient, preview and appropriate variants with bounded network/decoded memory as zoom and DPR change.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/ARCH.md:58`
- `app/board/[boardId]/_components/image.tsx (planned in T05)`
- `lib/assets.ts (planned in T04)`
- `lib/utils.ts:32`

## Bounds and proposed write scope

Variant sizes, budgets and processing library remain T01/T06 proposals, not fixed invented thresholds. Any new image-processing dependency requires accepted scope before install; no new test framework.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Generated variants preserve aspect ratio and never upscale beyond original pixels; originals remain byte-identical.
- [ ] Visible images progress from gradient to preview to a variant selected from actual CSS display dimensions times DPR; zoom is not multiplied twice.
- [ ] Off-screen culling, cancellation and bounded requests/cache apply during rapid pan/zoom. Immediate zoom jumps do not fetch every intermediate size in sequence.
- [ ] Measure transferred bytes, chosen dimensions, request concurrency and browser decoded-memory behavior on the T01 generated workload; meet the reviewed bounds with exact observations.
- [ ] PNG/export may intentionally request adequate resolution without forcing full originals during ordinary navigation.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/progressive-images.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

Needs T05 assets and T07 real screen/world/zoom mapping. If memory measurement API is unavailable, report the actual measurable bound and limitation rather than PASS.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
