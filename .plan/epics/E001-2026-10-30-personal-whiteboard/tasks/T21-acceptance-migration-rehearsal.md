---
formatVersion: 1
id: "E001-T21"
title: "Independently accept the integrated board and rehearse migration"
status: "pending"
priority: "high"
type: "improvement"
dependencies: ["E001-T02", "E001-T06", "E001-T08", "E001-T09", "E001-T10", "E001-T11", "E001-T12", "E001-T14", "E001-T17", "E001-T18", "E001-T20"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "verifier"
executor: "unassigned"
write_set: ["tests/critical-editor.test.cjs", "tests/acceptance-rehearsal.test.cjs", "tests/fixtures/migration/synthetic-source.json", "justfile", "docs/migration.md", "docs/backup.md", "CHANGELOG.md", ".plan/epics/E001-2026-10-30-personal-whiteboard/JOURNAL.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "test(whiteboard): [E001-T21] independently accept the integrated board and rehearse migration"
completion: "No"
execution: "not-dispatched"
phase: 7
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T21: Independently accept the integrated board and rehearse migration

## Outcome

Independently verify the integrated feature outcome, performance and migration/restore evidence before release coordination.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `tests/critical-editor.test.cjs:88`
- `justfile`
- `.plan/FEATURE-MAP.md`
- `.plan/ARCH.md`

## Bounds and proposed write scope

Use existing tools only, no self-mirroring assertion factory. This verifier may improve focused tests/docs, but confirmed product defects return to the owning implementation task. No production acceptance is claimed here.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Existing just check exercises all delivered critical flows through the existing Node/CDP stack, including real image paste/upload, frame movement, accepted lock inheritance, rich text/code, record-table two-view edits and failure recovery.
- [ ] Independent review inspects actual source and outputs, not just implementer summaries; no task certifies its own source.
- [ ] On generated representative boards, record network/request/memory observations against agreed bounds, synthetic migration losses/idempotency, and a nonempty backup restore.
- [ ] Retain every earlier FAIL and resolution separately; a fixture does not prove actual external integration or real-board fidelity.
- [ ] An authorized real sample is compared only when source access exists; otherwise explicitly hold that portion NOT_CHECKED with owner/input recorded. Do not cancel subscriptions or remove originals.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/critical-editor.test.cjs`, `tests/acceptance-rehearsal.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

All listed implementation dependencies must have independent evidence; actual external integration and any real-sample access are distinct prerequisites. T22 owns final URL/replacement acceptance.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
