---
formatVersion: 1
id: "E001-T07"
title: "Implement zoom, pan, neutral grid and measured board capacity"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T03"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t07-impl (Herdr w2G, claude)"
write_set: ["types/canvas.ts", "types/board.ts", "lib/utils.ts", "store/use-board-store.ts", "app/board/[boardId]/_components/canvas.tsx", "app/board/[boardId]/_components/selection-tools.tsx", "app/board/[boardId]/_components/reset-camera.tsx", "tests/navigation-capacity.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T07] implement zoom, pan, neutral grid and measured board capacity"
completion: "Yes"
execution: "dispatched 2026-11-08 by dm-miro"
phase: 3
completed_at: "2026-11-08"
commits: ["a57a98b", "b70d771", "47a2661", "2910cca"]
verification_evidence: ["implementer: just check run 1 exit 1 (critical parent failed on one net::ERR_CONNECTION_REFUSED around restart; retained), isolated reruns 9/9 x3, then just check 0; locked container-check 0; after rebase onto T16/T24/T04 just check 0 (critical 10/10, navigation 10/10, board-store 4/4) and locked container-check 0 (3/3, 10/10)", "verifier t07-verify round 1: code criteria PASS (PNG export at DPR != 1 NOT_CHECKED); independent screenshot review 1440x900 and 390x844 at DPR 1/1.25, zoom 25/100/200, hover + focus-visible: FAIL V1 Medium/2p (refusal message overflow at 390 px)", "round 2 on the fix: V1 and V3 closed with new screenshots at 390/1440 px; just check 0"]
evidence: ["Browser measurement before code (tests/capacity/measure-capacity.cjs, just measure-capacity), results in ARCH", "PO accepted: 5000-object cap; ~210 ms undo/drag frame at 2000 objects as known limit -> T25; out-of-write_set paths (document-version, use-local-board, selection-box, info, page, new modules); DESIGN rows accepted after visual PASS", "Open Low (to BACKLOG via PO): N1 Save failed state overflows at 390 px; N2 italic title last glyph clipped in truncate span; N3 409 over-limit sentence lacks period/differs from DESIGN wording; V2 app-wide red text contrast ~3.8:1; selection handles at zoom != 100% NOT_CHECKED"]
---
# E001-T07: Implement zoom, pan, neutral grid and measured board capacity

## Outcome

Replace translation-only navigation and the fixed 100-layer cap with accurate zoom-aware interactions and measured large-board limits.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `app/board/[boardId]/_components/canvas.tsx:51`
- `app/board/[boardId]/_components/canvas.tsx:278`
- `lib/utils.ts:32`
- `types/board.ts:22`
- `app/board/[boardId]/_components/selection-tools.tsx:88`

## Bounds and proposed write scope

Snapping remains optional/proposed. Do not remove all safety limits or invent acceptable performance without measurements. DESIGN records visual decisions before code.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Before changing rendering, measure the browser baseline for the T01 workload matrix (100/2000/10000 objects, three viewports, DPR 1/1.25/2, seven zoom levels) with a committed measurement script; propose numeric limits for PO acceptance. Correct the rounding in the ARCH cost table (T01 verifier F1).
- [ ] Plain `z` no longer moves the selection (`canvas.tsx:498-511`), and the camera-reset control appears whenever either camera coordinate is non-zero (`canvas.tsx:548`); browser tests cover both.

- [ ] Pan/zoom about the intended anchor preserve world coordinates; pointer selection, dragging, resizing and export map correctly across zoom and DPR.
- [ ] Render a subtle gray grid that supports navigation without becoming authored document content or changing exported geometry.
- [ ] Replace both client and validator 100-layer constraints coherently with reviewed measured bounds and a visible refusal for excessive workloads.
- [ ] Existing document coordinates, drawing, undo/redo, camera reset and reload continue to work on legacy fixtures and generated larger boards.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/navigation-capacity.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Carried from E001-T03 (PO, 2026-11-08)

- The board page shows a generic "Unable to load board." for HTTP 409 (document saved by a newer app version).
  Show an understandable message, e.g. "This board was saved by a newer version of the app", with the way back
  to the board list. Source: app/board/[boardId]/page.tsx.

## Known gating and evidence

T03 schema first; capacity/workload targets need T01 review. Shared camera/validator paths overlap multiple workstreams; serialize ownership.

Current state: done 2026-11-08; independently verified PASS (two rounds incl. visual review) and integrated on main as a57a98b..2910cca.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
