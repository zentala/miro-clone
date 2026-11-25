---
formatVersion: 1
id: "E001-T18"
title: "Coordinate SQLite and asset backup with verified restore"
status: "done"
priority: "high"
type: "improvement"
dependencies: ["E001-T04"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "t18-impl; t18-verifier (w57:p6)"
write_set: ["scripts/backup.mjs", "scripts/restore-test.mjs", "tests/backup-restore.test.cjs", "justfile", "docs/backup.md", "docs/migration.md", "lib/assets.ts", "scripts/backup-retention.mjs", "scripts/backup-retention.test.mjs"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(backup): [E001-T18] coordinate SQLite and asset backup with verified restore"
completion: "No"
execution: "PO accepted independent PASS; rebased after T23; fresh just check passed; integrated on main"
completed_at: "2026-11-25"
phase: 4
completed_at: null
commits: ["b50aa20", "cbd270c"]
verification_evidence: [".plan/reports/2026-11-25-t18-verification-round1.md: independent PASS; F1/F2, corrupt prior archive and same-second collision covered", "Fresh just check on T23-integrated source: exit 0, 88 pass, 1 expected skip; build artifact .plan/worktrees/e001-t18/.next", "T18 was rebased after a docs-only T23 delivery commit; source-tree paths were unchanged, so the successful fresh gate remains applicable to the integrated product source"]
evidence: ["PO accepted candidate 13ad777 on the independent report before integration", "T18 commits rebased onto T23 and fast-forwarded to main", "Earlier failed runs and F1/F2 reproductions/corrections are retained in the independent review campaign and JOURNAL"]
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

- [ ] After the asset rename, fsync the parent `assets/` directory so a published file survives power loss (T04 review N3); covered by a test that checks the call order.

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

## Carried from E001-T04 (PO, 2026-11-08)

- Add one sentence to the asset documentation describing both states: `unused` = a registered asset no board references; `unregistered` = an intact file on disk without a database row (e.g. after an interrupted upload). Neither is an error or deletable.

## PO decision on the shared retention script (2026-11-25)

The backup skill asks each app to copy `backup-retention.mjs` and its test.
Copy both unchanged from the Harness repository, `skills/backup/`, revision
58be8c9 (2026-10-18), into `scripts/`. Add one provenance comment below the
shebang naming that repository, path and revision; the owner of this app wrote
the script, so no third-party licence applies. No host path, no import from
another checkout. Run the copied test in `just check`. Do not edit the copied
logic; a needed change goes to the Harness owner. A systemd timer and off-box
copies stay out of this task; scheduling belongs to deployment (T22).

## PO clarification of "nonempty key tables" (2026-11-25)

The key table is `boards`. A backup with zero board rows is empty and fails.
Zero asset rows is valid when no saved board references an asset: text-only
and image-free boards must back up and restore. A board that references an
asset whose row or bytes are missing fails the backup. A database from before
T04 that has no `assets` table is read as zero assets, read-only, with no
schema change to the source. Tests cover: image-free boards with an empty
`assets` table, a pre-T04 database without the table, zero boards (refused)
and a referenced asset with missing bytes (refused).

## Known gating and evidence

T04 file/DB consistency first. Existing backup skill/procedure must be read at dispatch. Off-box access/destination remains separate accepted infrastructure scope.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
