---
formatVersion: 1
id: "E001-T16"
title: "Normalize structural packages and report dry-run losses"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T15"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t16-impl (Herdr w2G, claude)"
write_set: ["types/migration.ts", "lib/migration/normalize.ts", "lib/migration/report.ts", "scripts/migration/dry-run.mjs", "tests/migration-normalize.test.cjs", "tests/fixtures/migration/synthetic-source.json", "docs/migration.md", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T16] normalize structural packages and report dry-run losses"
completion: "Yes"
execution: "dispatched 2026-11-08 by dm-miro"
phase: 3
completed_at: "2026-11-08"
commits: ["c5e27af", "fc540b9", "dec932b", "e9f877e"]
verification_evidence: ["verifier t16-verify round 1: PASS all criteria; just check 0 (migration-normalize 10/10); container-check 0; Node in image v22.23.4; clean-clone dry-run works, writes nothing", "round 2: F1-F3 closed end-to-end; exporter split byte-identical; just check 0 (critical 9/9, export 16/16, packaging 2+1 skip, model 6/6, normalize 12/12)", "round 2 container-check attempt 1 exit 1 (ERR_CONNECTION_RESET in container test while other worktrees ran container-check; retained, cause unproven), diagnostic rerun 0, PO-required run under flock lock 0 (3/3, 9/9)"]
evidence: ["PO accepted write_set extensions: lib/migration/geometry.ts, tsconfig allowImportingTsExtensions, package.json engines node >=22.18, AGENTS/README Node 22.18, tools/miro-export split", "Findings fixed in T16: F1 Medium/2p null geometry accounted, F2 Low/2p failed parent keeps id -> parent-unresolved, F3 Low/1p rotation loss propagated", "Accepted explicit losses until real board (DECIDE #1): y axis down, REST groups/tags unverified, parent rotation ignored", "NOT_CHECKED: real Miro export, axis direction on a live board, rendering after import (T17)"]
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

- [ ] Records carrying text markup are flagged in the package and loss report as requiring sanitization at import; T16 renders nothing and adds no sanitizer (sanitizing happens in T17 with the T10 sanitizer).

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

## Open questions carried from E001-T15 (PO, 2026-11-08)

- Axis direction of Miro Web SDK coordinates was not confirmed on a live board; normalization must state its assumption and report it as a loss/uncertainty until real-source evidence exists.
- Miro REST rows for groups and tags were marked "not reverified" in the T15 capability table; confirm or keep them as explicit unknowns.

## Known gating and evidence

T15 structural contract first. Real representative source remains external; report the exact limitation rather than label synthetic coverage full fidelity.

Current state: done 2026-11-08; independently verified PASS (two rounds) and integrated on main as c5e27af..e9f877e.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
