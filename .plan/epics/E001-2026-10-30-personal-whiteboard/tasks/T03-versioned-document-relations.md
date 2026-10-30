---
formatVersion: 1
id: "E001-T03"
title: "Version board documents and establish shared object relations"
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
write_set: ["types/board.ts", "types/canvas.ts", "lib/document-version.ts", "lib/document-migrations.ts", "lib/boards.ts", "lib/sqlite.ts", "store/use-board-store.ts", "hooks/use-local-board.ts", "app/api/boards/route.ts", "app/api/boards/[boardId]/route.ts", "tests/document-model.test.cjs", "tests/critical-editor.test.cjs", "justfile", ".plan/ARCH.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T03] version board documents and establish shared object relations"
completion: "No"
execution: "not-dispatched"
phase: 2
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T03: Version board documents and establish shared object relations

## Outcome

Add a backward-compatible document version and shared IDs/relations/lock representation that specialized object types can extend.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `lib/sqlite.ts:16`
- `lib/boards.ts`
- `types/board.ts:3`
- `types/board.ts:19`
- `types/canvas.ts:12`
- `store/use-board-store.ts`

## Bounds and proposed write scope

Keep boards(id,title,created_at,updated_at,document) readable. Proposed JSON schemaVersion upgrades are preferred before SQL expansion. Any required SQL change needs inspected, committed, non-destructive migration and backup handling; no live reset/drop.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Open and save pre-version fixtures with the current five layer types without losing IDs, ordering, title, geometry or content.
- [ ] Introduce explicit version handling and migration/validation boundaries; reject unsupported future versions without rewriting their stored payload.
- [ ] Represent stable IDs, optional parents and own-lock state; effective inherited lock is computed over all ancestors, not copied into child own-lock bits.
- [ ] Validate references, duplicate IDs and cycles; distinguish missing references/unsupported records from accepted schema. Keep current board API identity stable.
- [ ] Run version upgrade and rollback/recovery scenarios on synthetic copies. No completed SQL migration is claimed merely from a design proposal.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/document-model.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T01 model/default review first. Introduce representation, not premature implementation of specialized lock gestures. Reconfirm write claims when other tasks touch the same store/validators.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
