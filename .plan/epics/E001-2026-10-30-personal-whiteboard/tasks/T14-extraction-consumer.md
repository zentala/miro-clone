---
formatVersion: 1
id: "E001-T14"
title: "Integrate the delivered extraction interface into cards"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T13"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["lib/extraction-client.ts", "types/extraction.ts", "app/api/capture/route.ts", "app/board/[boardId]/_components/product-card.tsx", "lib/assets.ts", "tests/extraction-integration.test.cjs", "tests/critical-editor.test.cjs", "justfile", "docs/extraction-contract.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T14] integrate the delivered extraction interface into cards"
completion: "No"
execution: "not-dispatched"
phase: 6
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T14: Integrate the delivered extraction interface into cards

## Outcome

Wire the accepted external extraction capability into the board with local assets and honest offline/retry handling.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `docs/extraction-contract.md (planned in T13)`
- `types/extraction.ts (planned in T12/T13)`
- `app/board/[boardId]/_components/product-card.tsx (planned in T12)`

## Bounds and proposed write scope

No deployment, external-owner code changes or access broadening. If the actual external interface is absent, keep integrated behavior NOT_CHECKED rather than substitute another product or service.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Capture a new synthetic URL with no saved extension card through the actual delivered interface and map the result to the correct board object/variant.
- [ ] Persist permitted image results locally and preserve exact URLs; retry/offline/cancel/error behavior does not duplicate cards or erase edits.
- [ ] Use the accepted existing/on-demand mechanism; no browser instance per card, cloned profile or unbounded background capture.
- [ ] Record real external capability/version and owner delivery evidence separately from fixtures. A fake response may prove contract handling, never integrated PASS.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/extraction-integration.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T13 contract and external-owner receipt are necessary. Any real page/session access needs its own accepted scope; synthetic fixtures remain the default.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
