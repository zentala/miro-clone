---
formatVersion: 1
id: "E001-T05"
title: "Paste, upload and render image layers"
status: "pending"
priority: "high"
type: "feature"
dependencies: ["E001-T04"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "unassigned"
write_set: ["types/canvas.ts", "types/board.ts", "store/use-board-store.ts", "lib/assets.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/image.tsx", "app/board/[boardId]/_components/toolbar.tsx", "tests/image-workflow.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T05] paste, upload and render image layers"
completion: "No"
execution: "not-dispatched"
phase: 4
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T05: Paste, upload and render image layers

## Outcome

Let the user paste/upload an image as an editable board object using local originals and persistent asset references.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `types/canvas.ts:12`
- `app/board/[boardId]/_components/canvas.tsx`
- `app/board/[boardId]/_components/layer-preview.tsx`
- `lib/assets.ts (planned in T04)`

## Bounds and proposed write scope

Selective upstream adaptation requires license/source review, otherwise use standard browser APIs. Do not copy private reference images or a different product wholesale; no progressive pipeline is claimed yet.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Real browser clipboard-image and file-upload actions create an image object with correct aspect ratio and a local stored original.
- [ ] Select, move, resize, duplicate and remove an image with existing interaction/history behavior; undo/redo and reload retain the correct reference/geometry.
- [ ] PNG export includes the image after assets decode, with no missing cross-origin content or silent blank export.
- [ ] Unsupported/oversized inputs produce visible errors without corrupting the board or leaking partially committed references.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/image-workflow.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T04 durable storage first. Use generated image fixtures and a synthetic clipboard; browser/OS clipboard access must not read the user's clipboard.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
