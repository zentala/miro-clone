---
formatVersion: 1
id: "E001-T05"
title: "Paste, upload and render image layers"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T04"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t05-impl (w57:pB); independent verification by t05-verifier (w57:pG) and ROOT rounds 1-3"
write_set: ["types/canvas.ts", "types/board.ts", "types/asset.ts", "store/use-board-store.ts", "lib/assets.ts", "app/board/[boardId]/_components/canvas.tsx", "lib/same-origin.ts", "app/api/boards/**", "app/board/[boardId]/_components/layer-preview.tsx", "app/board/[boardId]/_components/image.tsx", "app/board/[boardId]/_components/toolbar.tsx", "tests/image-workflow.test.cjs", "tests/critical-editor.test.cjs", "tests/assets.test.cjs", "tests/capacity-steps.cjs", "justfile", "DESIGN.md", "lib/document-version.ts", "lib/document-migrations.ts", "tests/document-model.test.cjs", "app/board/[boardId]/_components/canvas/**", "tests/packaging.test.cjs"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T05] paste, upload and render image layers"
completion: "Yes"
execution: "Accepted, integrated and pushed to main on 2026-11-25 after rebasing on 37fdb2c and passing the fresh integrated just check"
phase: 4
completed_at: "2026-11-25"
commits: ["c6bb99022b2cf5001fb9bf27e4555c804f38c6ba", "38abc40ee07e26c65a1efefed08c0af7737d3c3d", "1d362f5332b96805b19af7c2a023a92687c6a3dd", "440ba23ecaff7d0631223876b04eb081d4195bbc"]
verification_evidence: ["Independent review campaign: .plan/reports/2026-11-25-t05/appointed-verifier-round2.md preserves round 1 F1 and round 2 F2 FAILs; .plan/reports/2026-11-25-t05/root-independent-rounds-1-3.md records independent round 3 PASS", "ROOT independently verified zero-size image API rejection, unchanged SQLite, vector zero-size compatibility and v1/v2/future-version behavior; focused model and real-browser image tests passed 19/19", "After rebase on main 37fdb2c, just check passed on the integrated candidate and produced .next/standalone/server.js; main is 440ba23 and pushed to origin/main", "Wide and narrow actual-app screenshots inspected against DESIGN.md at 1280x900 and 390x844; centered selected-image states pass"]
evidence: ["Feature source is preserved across four separate commits, including the independent resize and document-boundary corrections", "Earlier F1/F2 failures and the brittle first assertion failure remain in the same review campaign; the inherited viewport-sized export note remains Low/2p and nonblocking", "No live data was read or changed; all zero-size image examples were synthetic and T05 schema v3 was unreleased at review time"]
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

### Scope note — 2026-11-25

The DM records `types/asset.ts` as an accepted path: GIF originals require
`image/gif` in `AssetMediaType`. `tests/assets.test.cjs` is also in scope for
updating the obsolete T04 GIF-refusal expectation while preserving all other
media validation assertions. `tests/capacity-steps.cjs` is in scope for the
minimal current-schema expectation update. These are necessary path additions
under the PO's standing rules for missed implementation paths and current
schema expectations; no separate release is required.

## Acceptance criteria

- [x] Every mutating API route (boards and assets) uses the single same-origin guard in `lib/same-origin.ts`; the two copies in the board routes are removed and their tests still pass (T04 review N2).

- [x] GIF (including animated) is accepted: original bytes stored through the T04 asset store, dimensions read from the GIF header without a decoder, rendered as the original file. T04's GIF refusal is lifted here (PO, 2026-11-08).

- [x] Real browser clipboard-image and file-upload actions create an image object with correct aspect ratio and a local stored original.
- [x] Select, move, resize, duplicate and remove an image with existing interaction/history behavior; undo/redo and reload retain the correct reference/geometry.
- [x] PNG export includes the image after assets decode, with no missing cross-origin content or silent blank export.
- [x] Unsupported/oversized inputs produce visible errors without corrupting the board or leaking partially committed references.

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

Current state: accepted and delivered 2026-11-25. Points estimate scope, not a
numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

## Delivery — 2026-11-25

- Source was rebased onto current main `37fdb2c`, fast-forwarded to `main` at
  `440ba23ecaff7d0631223876b04eb081d4195bbc`, and pushed to `origin/main`.
- The post-rebase integrated `just check` exited 0. TypeScript and lint passed;
  lint retained the existing `components/custom-color-picker.tsx:39`
  `lastUsedColor` warning. The production build succeeded at
  `miro-clone/.next/standalone/server.js`; the packaging test skipped its
  explicitly opt-in container-only case.
- The integrated image workflow passed 12 TAP tests, including the API
  zero-size rejection, upload, clipboard, resize/collapse/crossing, history,
  export pixels and 390x844 layout. `document-model.test.cjs` passed 7;
  `critical-editor.test.cjs` passed 10; all other `just check` recipes passed.
- The independent review campaign preserves round 1 F1 and round 2 F2 FAILs.
  ROOT round 3 independently confirmed the document/API boundary correction,
  vector compatibility, actual browser outcome and pictured screenshots. The
  low-point inherited viewport-sized export observation remains nonblocking.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
