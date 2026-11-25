---
formatVersion: 1
id: "E001-T25"
title: "Redraw only changed layers and split the canvas component"
status: "done"
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
completion: "Yes"
execution: "accepted candidate rebased onto main 21fff87, independently verified and fast-forward integrated; delivery record and push pending"
phase: 4
completed_at: "2026-11-25"
commits: ["866ef7b", "7d625f7"]
verification_evidence: [".plan/reports/2026-11-25-t25-verification-round1.md — final round 2 PASS on rebased candidate 7d625f70f50d50b4560e42eb1991d323bf546e99"]
evidence: ["Integrated candidate passed full just check: exit 0, 90 tests, 89 passed, one expected container-only skip; Next production build succeeded", "Independent 2000-object T07 comparison at 1280x900 DPR1 zoom1: baseline undo 263.1 ms and drag p95 216.6 ms; candidate undo 32.9 ms and drag p95/max 16.7 ms; one PATCH each", "Real-browser F1 rectangle-to-path-to-clear-to-different-rectangle selector transitions updated bounds/handles immediately", "Real-browser F2 repeated front/back ordering, geometry edit, insert, duplicate, delete, undo and reload preserved rendered order", "Retained wide and narrow screenshots passed for pictured states", "Alternate-position selection-panel/toolbar overlap was reproduced identically on baseline and candidate at 390px and 768px and dispositioned pre-existing; no T25 change claimed", "Earlier probe failures and corrections remain in the same verification report"]
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
