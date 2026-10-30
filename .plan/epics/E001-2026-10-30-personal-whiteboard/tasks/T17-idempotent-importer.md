---
formatVersion: 1
id: "E001-T17"
title: "Import packages idempotently into new boards"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T16", "E001-T06", "E001-T08", "E001-T09", "E001-T12", "E001-T18"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["lib/migration/import.ts", "scripts/migration/import.mjs", "types/migration.ts", "lib/boards.ts", "lib/assets.ts", "lib/sqlite.ts", "tests/migration-import.test.cjs", "tests/critical-editor.test.cjs", "docs/migration.md", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T17] import packages idempotently into new boards"
completion: "No"
execution: "not-dispatched"
phase: 7
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T17: Import packages idempotently into new boards

## Outcome

Apply reviewed migration packages to new boards with stable source mapping, durable assets and no duplicate items on retry.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `lib/boards.ts`
- `lib/sqlite.ts`
- `types/board.ts`
- `types/migration.ts (planned in T16)`
- `docs/migration.md (planned in T15)`

## Bounds and proposed write scope

First representative migration prioritizes links/images and explicitly accepted loss reporting. T10/T11/T19 are NOT prerequisites: retain/report unsupported raw records, including code/text/table variants. No claim of support before a model is delivered; no merge-overwrite or perfect-fidelity assumption.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] A committed script imports into an explicitly new synthetic board; the same package/retry reuses mapping without duplicate objects or assets.
- [ ] For types whose models/validators/renderers have actually been delivered, preserve parent/child geometry, accepted own/inherited locks, URLs and local assets through save/reload. Do not claim code, rich-text or record-table support before those models exist.
- [ ] Unknown/unsupported records remain in the package/report, with exact source accounting; unsupported connectors or table variants are not silently dropped.
- [ ] Interrupted file/DB work rolls back or resumes with explicit recovery; no merge-overwrite of existing local edits.
- [ ] Use T18 backup/restore proof on a disposable target before real import; no live target operation occurs without separately authorized source/target scope and a fresh backup.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/migration-import.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

Needs the feature/model and backup dependencies plus a reviewed loss report. Real-source absence holds fidelity acceptance, not synthetic importer tests.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
