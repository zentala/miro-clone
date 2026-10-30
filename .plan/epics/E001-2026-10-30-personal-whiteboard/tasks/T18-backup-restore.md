---
formatVersion: 1
id: "E001-T18"
title: "Coordinate SQLite and asset backup with verified restore"
status: "pending"
priority: "high"
type: "improvement"
dependencies: ["E001-T04"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "unassigned"
write_set: ["scripts/backup.mjs", "scripts/restore-test.mjs", "tests/backup-restore.test.cjs", "justfile", "docs/backup.md", "docs/migration.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(backup): [E001-T18] coordinate SQLite and asset backup with verified restore"
completion: "No"
execution: "not-dispatched"
phase: 4
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T18: Coordinate SQLite and asset backup with verified restore

## Outcome

Deliver repository-owned backups/restores that preserve SQLite and durable assets consistently without touching real data during tests.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `lib/sqlite.ts:16`
- `Dockerfile:16`
- `lib/assets.ts (planned in T04)`
- `justfile`

## Bounds and proposed write scope

No hand-run live data cleanup, scheduler/deployment or blind SQLite+WAL file copy. If using another repo's retention helper, verify availability/license and reference its owner rather than silently vendoring code.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Reuse the owning backup procedure/pattern rather than create a new service; database and referenced asset files form one recoverable snapshot.
- [ ] Repeated unchanged input does not create a redundant copy; retention behavior follows the existing backup contract when configured.
- [ ] Restore to a newly created dated disposable target, verify nonempty key tables and all referenced asset bytes, then remove only the owned test target.
- [ ] Reject a production/live target before destructive test cleanup; failed/empty backup never replaces a known good copy.
- [ ] Record fresh-backup verification required before any later real migration or replacement; configured destination alone is not proof of a backup.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/backup-restore.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T04 file/DB consistency first. Existing backup skill/procedure must be read at dispatch. Off-box access/destination remains separate accepted infrastructure scope.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
