---
formatVersion: 1
id: "E001-T25"
title: "Redraw only changed layers and split the canvas component"
status: "in-progress"
priority: "high"
type: "improvement"
dependencies: ["E001-T07"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "t25-impl-fresh (w57:p8); prior session retained at w57:p5"
write_set: ["app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/canvas/**", "app/board/[boardId]/_components/layer-preview.tsx", "hooks/use-local-board.ts", "store/use-board-store.ts", "tests/capacity/**", "tests/board-store.test.cjs", "providers/local-board-provider.tsx", "app/board/[boardId]/_components/info.tsx", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "perf(whiteboard): [E001-T25] redraw only changed layers"
completion: "No"
execution: "candidate 62d0df7 plus accepted check-recipe commit 20b480a; independent review active; rebase on T18-integrated main and final gate pending"
phase: 4
completed_at: null
commits: ["62d0df7", "20b480a"]
verification_evidence: []
evidence: ["Author-reported just check exit 0 on 20b480a, including node tests/capacity/selector-regression.cjs; Next production build succeeded", "Author-reported selector-bounds and z-order browser regression PASS", "T07 2000-object measurement self-report: undo 38.4 ms, drag p95/max 16.7 ms, one PATCH; independent rerun pending", "DM reviewed the retained wide and 390px narrow screenshots: pictured states are legible and the selection panel does not overlap the left toolbar", "ROOT separately reported an earlier alternate-position 390px overlap; the author repositioned the fixture. Whether that state is reproducible and pre-existing remains under independent review; fixture repositioning is not a product fix"]
---
# E001-T25: Redraw only changed layers and split the canvas component

## Outcome

Undo and drag frames stay fast on large boards. T07 measured about 210 ms per
undo/drag frame at 2000 objects (target 100 ms or less) because every edit
redraws all layers. Added by PO on 2026-11-08 from the T07 report.

## Acceptance criteria

- [ ] An edit, undo or drag frame re-renders only the changed layers (memoized layer components keyed by stable ID); the T07 capacity test at 2000 objects measures undo and drag frame at 100 ms or less, measured in the browser with the T07 script.
- [ ] `canvas.tsx` (610 lines) is split into modules of at most 250 lines without behaviour change; existing critical, navigation and capacity tests pass unchanged.
- [ ] No new dependencies.

## Independent verification

An independent verifier reruns the T07 capacity measurement before and after.
