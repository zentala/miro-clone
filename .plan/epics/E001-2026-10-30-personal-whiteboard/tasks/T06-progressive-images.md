---
formatVersion: 1
id: "E001-T06"
title: "Generate variants and bound viewport image loading"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T05", "E001-T07"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t06-impl (candidate author; Herdr w57:pN)"
write_set: ["lib/image-variants.ts", "lib/assets.ts", "types/asset.ts", "hooks/use-visible-assets.ts", "app/api/assets/[assetId]/route.ts", "app/board/[boardId]/_components/image.tsx", "app/board/[boardId]/_components/canvas/board-surface.tsx", "tests/progressive-images.test.cjs", "tests/critical-editor.test.cjs", "justfile", "DESIGN.md", ".plan/ARCH.md", "package.json", "package-lock.json"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(images): cache fitted image previews (3590bc4)"
completion: "Yes"
execution: "PO accepted 3590bc4 after independent source, build, progressive/image workflow, full-fit measurement and scoped visual review; fast-forward integrated and pushed to origin/main. Full just check completed with all reported checks/tests passing; the closed command session did not separately expose its shell exit code. Preserve that limitation and all earlier failures."
phase: 5
completed_at: "2026-11-26"
commits: ["3590bc4"]
verification_evidence: ["/tmp/miro-resume-20261125/ROOT-T06-3590-INDEPENDENT-REVIEW.md: fresh build exit 0 with .next/standalone/server.js; focused progressive/image workflow exit 0, 17 passed; real 800/800 image fit, 633468 B in 2030.5 ms, 0 errors/pending/original fetches, peak concurrency 8; EXIF orientation 6, original bytes, GIF, geometry, export and reload passed; wide 1280 and narrow 390 scoped visual review passed", "Final owning just check ran against this unchanged source tree: build produced .next/standalone/server.js; critical editor 11/11, image workflow 12/12, progressive images 5/5, navigation/capacity 10/10, exporter 16/16, document model 7/7, board store 4/4 and remaining visible suites passed; packaging container-only test skipped by its existing opt-in; final selector regression PASS. Session closed before shell exit code could be queried, so the aggregate exit code is not separately observed."]
evidence: ["PO acceptance 2026-11-26; old 15,051,756 B / ~5.1 s first-fit failure is closed on this candidate and retained above as history", "Fast-forward integrated commit 3590bc4 and pushed origin/main", "Limits: synthetic images are 490,000 pixels from 9 templates; decoded memory NOT_CHECKED; full mixed W2 workload not measured"]
---
# E001-T06: Generate variants and bound viewport image loading

## Outcome

Make image-heavy boards load gradient, preview and appropriate variants with bounded network/decoded memory as zoom and DPR change.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/ARCH.md:58`
- `app/board/[boardId]/_components/image.tsx (planned in T05)`
- `lib/assets.ts (planned in T04)`
- `lib/utils.ts:32`

## Bounds and proposed write scope

Variant sizes, budgets and processing library remain T01/T06 proposals, not fixed invented thresholds. Any new image-processing dependency requires accepted scope before install; no new test framework.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

DM scope note, 2026-11-25: `app/board/[boardId]/_components/canvas/board-surface.tsx`
is included only for a minimal post-commit camera-zoom context handoff to image
consumers. Preserve T25's stable layer selector/callback behavior; shared T10
paths remain serialized as recorded in the DM brief.

## Acceptance criteria

- [ ] GIF gets no generated variants (the `@napi-rs/image` binary has no GIF decoder): placeholder from header dimensions, then the original; documented as a known limit, not a failure.

- [ ] Generate variants with the PO-accepted `@napi-rs/image` (MIT); re-check bundled native binary licences at installation; `sharp` is rejected.

- [ ] Generated variants preserve aspect ratio and never upscale beyond original pixels; originals remain byte-identical.
- [ ] Visible images progress from gradient to preview to a variant selected from actual CSS display dimensions times DPR; zoom is not multiplied twice.
- [ ] Off-screen culling, cancellation and bounded requests/cache apply during rapid pan/zoom. Immediate zoom jumps do not fetch every intermediate size in sequence.
- [ ] Measure transferred bytes, chosen dimensions, request concurrency and browser decoded-memory behavior on the T01 generated workload; meet the reviewed bounds with exact observations.
- [ ] PNG/export may intentionally request adequate resolution without forcing full originals during ordinary navigation.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/progressive-images.test.cjs`, `tests/critical-editor.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

Needs T05 assets and T07 real screen/world/zoom mapping. If memory measurement API is unavailable, report the actual measurable bound and limitation rather than PASS.

Independent ROOT review of the existing measurement criterion, 2026-11-25: ARCH's W2 representative workload contains 2,000 objects and 800 images; T01 W1 contains 100 objects and zero images, so it does not provide T06's image-heavy measurement. Measure the synthetic image portion of W2 with deterministic dimensions/layout, visible and off-screen cases, and fit/pan/zoom/DPR transitions. Record transferred bytes, selected variant dimensions, cancellations and request concurrency. This is the existing representative-workload criterion, not a new framework, admission gate, or operator decision. Keep ARCH's existing PROPOSED/PO dispositions for thresholds unchanged. W2 portions for frames, code and tables remain NOT_CHECKED and are not implied by this image-only run. If browser decoded-memory measurement is unavailable, report NOT_CHECKED and the measurable limitation.

Independent ROOT review of the active W2 measurement, 2026-11-25 — F1 High/3p under the existing T06 criterion: the 800 generated images are each 490,000 pixels, below ARCH's 0.3–24 MP representative range; report this reduced source-size coverage and actual total bytes, without claiming 24 MP. The 250 ms fit and 500 ms final snapshots do not establish completed previews or total bytes/cache if visible requests remain outstanding. At bounded checkpoints, record loaded/rendered/failed and active/pending counts; distinguish cancelled requests from HTTP/decoder failures. If the preview has not settled within the existing finite harness deadline, report that limitation rather than treating partial renders as complete. Keep this within the existing test/harness paths and do not change thresholds or add a gate/framework.

W2 measurement attempts, 2026-11-25: first test run exited 1 before fixture generation because the disposable SQLite database had no `assets` table; setup was amended to initialize through the existing boards API. The next run exited 1 after fixture generation because the test waited for 2,000 `<g>` groups while 1,200 synthetic non-image objects render as `<rect>`. This is a test selector mismatch, not a product verdict. Preserve both failures and report the corrected retry separately.

W2 image-slice receipt, 2026-11-25: the corrected existing-harness test passed 1/1; `node --check tests/progressive-images.test.cjs` passed. The fixture had 2,000 objects (800 images plus 1,200 rectangle placeholders), with 800 deterministic 490,000-pixel sources (267 PNG, 267 JPEG, 266 WebP; 1:1, 1:4 and 4:1 aspect ratios), totaling 786,757,308 B. This is below ARCH's per-image 0.3–24 MP range; do not claim the 24 MP end or the full ARCH source-size mix. At a manually selected 10% camera scale, the 250 ms snapshot showed 800 images geometrically visible, 73 requests started, and 8 active; actual loaded/rendered preview count was not measured. Across the later 200% zoom, pan and DPR change, there were 175 request attempts, 118 HTTP 200 headers, 108 complete bodies, 67 cancellations (10 after headers), 0 non-cancelled network errors, and 0 browser exceptions. The final 0-active count followed those later camera/DPR steps, not the first 10% view. Complete-body bytes were 9,658,998 B and Resource Timing transfer sizes totaled 9,832,626 B across all scenarios; neither number is first-view-only. Started widths were 160:102, 320:8, 640:39, 1280:26; fetch concurrency peak was 8. Resource Timing raw peak was 16 with zero-transfer entries at that instant; positive-transfer overlap peak was 8. Decoded memory is NOT_CHECKED. These author measurements do not establish 800 loaded previews, first-view total bytes/cache behavior, or full W2 (frames, cards, text, code, tables remain NOT_CHECKED).

Independent ROOT full-fit W2 check, 2026-11-25 — F2 High/5p: against a source-identical scratch build, ROOT observed 800/800 SVG images loaded, 0 errors and 0 active requests at full fit. The current minimum width-160 previews alone transferred 15,051,756 B in response bodies (15.29 MB by Resource Timing) and took about 5.1 s from fit; other widths transferred 0 B in that first-fit interval. This exceeds the existing proposed W2 bounds of 8 MB/4 s. Preserve the existing thresholds/PO dispositions; correct the product's overlarge minimum preview variant and add a bounded actual SVG-load/byte/time checkpoint to the existing W2 test before zoom, so later-view idle cannot substitute for first-view completion. The 490,000-pixel fixture remains reduced source-size coverage, not 24 MP coverage; decoded memory and non-image W2 content remain NOT_CHECKED. Do not accept T06 until the existing performance bounds are met and independently checked.

The full-fit observation closes the earlier unknown preview-load count for that source-identical run (800/800, 0 errors), but its 15,051,756 B / ~5.1 s result exceeded the existing bounds. Preserve this finding as history; it is resolved by the accepted candidate below, not erased.

Independent ROOT acceptance review, 2026-11-26: candidate 3590bc4 contains the orientation correction and remains source-identical through acceptance. A fresh production build passed and produced `.next/standalone/server.js`; focused progressive/image workflow checks exited 0 with 17 passes. The fresh real-browser W2 image slice loaded 800/800 previews with 0 errors or pending requests, transferred 633,468 B at first fit in 2,030.5 ms, fetched 0 originals, and peaked at 8 concurrent requests. DPR, direct zoom to 1280, cancellation, original bytes, EXIF orientation 6, GIF without variants, geometry, export and reload passed. ROOT visually inspected the actual 1280px wide and 390px narrow states and marked the scoped visual review PASS. PO accepted the candidate. Preserve limits: 490,000-pixel images drawn from 9 templates; decoded memory NOT_CHECKED; the full mixed W2 board (frames/cards/text/code/tables) was not measured.

Final gate and delivery, 2026-11-26: the owning `just check` ran in the candidate worktree before fast-forward integration, whose source tree was unchanged. Build output produced `.next/standalone/server.js`; all visible test suites and the final selector regression reported PASS. Packaging's existing container-only test remained skipped unless `just container-check` is explicitly selected. The command session closed before its aggregate shell exit code could be queried; this limitation is recorded in JOURNAL and the verification evidence. Commit 3590bc4 was fast-forwarded to main and pushed to origin/main.

Current state: done and PO-accepted on 2026-11-26. Earlier failed runs and the
15,051,756 B / ~5.1 s measurement remain in this record as history. Points are
estimates, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
