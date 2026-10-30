---
formatVersion: 1
id: "E001-T15"
title: "Implement a minimal read-only structural export tool"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T01"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["tools/miro-export/index.html", "tools/miro-export/export.js", "docs/migration.md", "tests/miro-export.test.cjs", "tests/fixtures/migration/synthetic-source.json", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T15] implement a minimal read-only structural export tool"
completion: "No"
execution: "not-dispatched"
phase: 2
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T15: Implement a minimal read-only structural export tool

## Outcome

Create a minimal board-read exporter and synthetic fixture path that preserve structural records, especially link previews, without importing a real account by default.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/ARCH.md`
- `.plan/FEATURE-MAP.md`
- `types/canvas.ts:12`
- `types/board.ts`

## Bounds and proposed write scope

No credentials, private screenshots or real export fixtures in Git. Installing/authorizing the source app or reading a real board requires separate explicit source access. SDK coverage does not promise all Miro fidelity.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Describe and implement the smallest official Web SDK board-read surface with boards:read; no write permission, account mutation or shared-link changes.
- [ ] Preserve exact string IDs, type/raw unknown records, geometry with coordinate convention, parent/group relations, URLs and asset mapping.
- [ ] Include previews and compare export capability to official REST/Web SDK support; record unsupported/opaque items, connectors and frames explicitly.
- [ ] Exercise exporter logic on generated fixtures before any live source use. Real-source fidelity remains NOT_CHECKED until separately authorized access exists.
- [ ] Retain original exports and give loss/coverage context; PDF/SVG appearance and CSV/RTB limitations are not mistaken for editable structural equivalence.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/miro-export.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T01 discovery first. Synthetic implementation can proceed without Miro; only the real-board validation portion waits for authorized access.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
