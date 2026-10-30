---
formatVersion: 1
id: "E001-T04"
title: "Add durable file assets and SQLite references"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T03"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["lib/assets.ts", "types/asset.ts", "lib/sqlite.ts", "lib/boards.ts", "app/api/assets/route.ts", "app/api/assets/[assetId]/route.ts", "Dockerfile", "tests/assets.test.cjs", "tests/critical-editor.test.cjs", "justfile", ".plan/ARCH.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T04] add durable file assets and SQLite references"
completion: "No"
execution: "not-dispatched"
phase: 3
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T04: Add durable file assets and SQLite references

## Outcome

Provide recoverable local original-asset storage whose metadata references integrate with SQLite instead of inflating document snapshots.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `lib/sqlite.ts:11`
- `lib/boards.ts`
- `types/board.ts`
- `Dockerfile:16`
- `.dockerignore`

## Bounds and proposed write scope

Storage API/config names and any SQL asset table/index are proposals until reviewed. Reuse existing Node/Next/SQLite, not a new storage service. Package file edits require separate confirmed dependency scope.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Asset bytes live in durable application data storage, under the container's data volume; documents contain stable references, not repeated base64 image bodies.
- [ ] Validate media type, size and canonical paths; reject traversal/unsafe serving and keep original bytes unchanged.
- [ ] Coordinate temporary-file writes, rename, metadata publication and recovery so interrupted ingestion never exposes a successful reference to missing data.
- [ ] Serve a stored asset after app restart with the same synthetic data root and verify referential consistency.
- [ ] Document recovery for interrupted file/DB operations and distinguish unused data from deletable data; no automatic destructive orphan cleanup.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/assets.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T03 version boundary first; T18 adds coordinated backup/restore. Test directories and data are disposable only.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
