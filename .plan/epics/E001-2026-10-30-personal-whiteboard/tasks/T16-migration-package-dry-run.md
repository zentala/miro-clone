---
formatVersion: 1
id: "E001-T16"
title: "Normalize structural packages and report dry-run losses"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T15"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/migration.ts", "lib/migration/normalize.ts", "lib/migration/report.ts", "scripts/migration/dry-run.mjs", "tests/migration-normalize.test.cjs", "tests/fixtures/migration/synthetic-source.json", "docs/migration.md", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T16] normalize structural packages and report dry-run losses"
completion: "No"
execution: "not-dispatched"
phase: 3
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T16: Normalize structural packages and report dry-run losses

## Outcome

Convert structural exports into a versioned portable package with complete accounting and no destination mutations.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/board.ts`
- `docs/migration.md (planned in T15)`
- `tools/miro-export/export.js (planned in T15)`

## Bounds and proposed write scope

Do not silently coerce all Miro types into the five old layer types. No real data import, account work, opaque RTB parser promise or deletion of originals.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Retain original records/assets, string IDs, geometry, parents/groups and exact URLs; document screen/world/relative-to-parent conversions.
- [ ] Every input record is accounted for as supported, transformed, unknown or failed; images, connectors and frames have explicit loss entries.
- [ ] A dry run validates the package and produces a human-readable loss report without opening or changing a destination board.
- [ ] Malformed parent cycles, duplicate IDs and missing assets produce actionable errors; unsupported records remain recoverable.
- [ ] Repeat normalization yields stable mapping/content; synthetic visual geometry comparison is distinguishable from an unperformed real-source fidelity check.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/migration-normalize.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T15 structural contract first. Real representative source remains external; report the exact limitation rather than label synthetic coverage full fidelity.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
