---
formatVersion: 1
id: "E001-T12"
title: "Add local website and product cards independent of extraction"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T05"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "types/extraction.ts", "app/board/[boardId]/_components/product-card.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/canvas.tsx", "store/use-board-store.ts", "tests/product-cards.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T12] add local website and product cards independent of extraction"
completion: "No"
execution: "not-dispatched"
phase: 5
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T12: Add local website and product cards independent of extraction

## Outcome

Render durable URL/product cards with local images and manual fallback so unavailable extraction does not block board editing.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `types/board.ts`
- `app/board/[boardId]/_components/image.tsx (planned in T05)`
- `lib/assets.ts (planned in T04)`

## Bounds and proposed write scope

UI can use explicit synthetic metadata fixtures, but must not claim real extraction integration. Full scraper/browser runtime and arbitrary account-session capture are excluded.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Pasting a previously unknown URL can create a usable card with exact source URL and a readable raw-URL fallback, without any saved extension item.
- [ ] Store thumbnail/screenshot assets locally where permitted; retain product variant/source mapping through reload/undo/redo.
- [ ] Retry/refresh and manual title/image editing follow an explicit merge policy that does not overwrite user edits silently.
- [ ] Pending/offline/unsupported extraction is visible; moving, editing and exporting the rest of the board still works.
- [ ] Integrate shared lock checks present after T09 without creating a second card-specific protection rule.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/product-cards.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T05 image ingestion first. T13 formalizes the consumer contract and T14 proves actual external integration.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
