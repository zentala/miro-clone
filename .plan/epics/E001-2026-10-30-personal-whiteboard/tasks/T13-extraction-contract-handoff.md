---
formatVersion: 1
id: "E001-T13"
title: "Define extraction contract and hand off external-owner work"
status: "pending"
priority: "high"
type: "improvement"
dependencies: ["E001-T01", "E001-T12"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "unassigned"
write_set: ["types/extraction.ts", "docs/extraction-contract.md", ".plan/ARCH.md", ".plan/epics/E001-2026-10-30-personal-whiteboard/HANDOFF.md", "tests/extraction-contract.test.cjs", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "docs(extraction): [E001-T13] define extraction contract and hand off external-owner work"
completion: "No"
execution: "not-dispatched"
phase: 6
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T13: Define extraction contract and hand off external-owner work

## Outcome

Specify the app's extraction consumer schema and portable external-owner handoff without editing the extension repository.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/ARCH.md`
- `.plan/FEATURE-MAP.md`
- `types/extraction.ts (planned in T12)`
- `app/board/[boardId]/_components/product-card.tsx (planned in T12)`

## Bounds and proposed write scope

No external clone/edit/provider invocation, new browser daemon, user-profile copying or account access is authorized here. Do not create a duplicate queue in this app for the external implementation.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Define versioned request/result/error states, exact URL/product variant preservation and local-asset handoff for a URL with no previously saved record.
- [ ] Distinguish reusable extraction functions/schema from DOM-dependent execution; compare ordinary fetch, extension capture and only-if-justified bounded shared headless jobs.
- [ ] Give the existing zntl-chrome owner a bounded handoff with inputs, acceptance and expected delivery receipt; no path in its repository is in this task's write_set.
- [ ] Document access/network/session boundaries and fallback behavior; any challenge or unavailable source remains an explicit unsupported/offline result.
- [ ] Local contract work can finish while external implementation waits; T14 integrated PASS requires the owning external executor's actual capability/receipt.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/extraction-contract.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

External owner/capability is NOT_CHECKED during planning. Lack of external delivery holds actual integration, not this bounded consumer contract.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
