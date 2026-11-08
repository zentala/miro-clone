---
formatVersion: 1
id: "E001-T15"
title: "Implement a minimal read-only structural export tool"
status: "done"
priority: "high"
type: "feature"
dependencies: ["E001-T01"]
epic: "E001"
points: 8
importance: "High"
effort: "large"
role: "implementer"
executor: "t15-impl (Herdr w2G, claude)"
write_set: ["tools/miro-export/index.html", "tools/miro-export/export.js", "docs/migration.md", "tests/miro-export.test.cjs", "tests/fixtures/migration/synthetic-source.json", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "feat(whiteboard): [E001-T15] implement a minimal read-only structural export tool"
completion: "Yes"
execution: "dispatched 2026-11-08 by dm-miro"
phase: 2
completed_at: "2026-11-08"
commits: ["c0059b7", "25c7cf0", "c3edccc"]
verification_evidence: ["implementer just check in nested worktree exit 1 (ESLint config cascade; retained)", "isolated-copy just check exit 0 (7/7 critical, 13/13 exporter)", "verifier t15-verify round 1: PASS 5/5, just check exit 0 (7/7, 13/13), main-checkout lint identical to candidate lint (exit 0, one pre-existing warning)", "verifier round 2 on c3edccc: F1 closed, just check exit 0 (7/7, 14/14)"]
evidence: ["PO accepted eslint root:true as existing-tool repair (separate commit 25c7cf0)", "F1 Medium/2p URL extraction fixed in c3edccc", "Open Low: F2 tools/ and tests JS not covered by next lint; F3 tools/miro-export/index.html not covered by DESIGN.md; export.js at 249/250 lines must be split on next change", "NOT_CHECKED (accepted by PO): real Miro board, panel inside Miro iframe, live SDK object shapes"]
---
# E001-T15: Implement a minimal read-only structural export tool

## Outcome

Create a minimal board-read exporter and synthetic fixture path that preserve structural records, especially link previews, without importing a real account by default.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `.plan/ARCH.md`
- `.plan/FEATURE-MAP.md`
- `types/canvas.ts:12`
- `types/board.ts`

## Bounds and proposed write scope

No credentials, private screenshots or real export fixtures in Git. Installing/authorizing the source app or reading a real board requires separate explicit source access. SDK coverage does not promise all Miro fidelity.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Describe and implement the smallest official Web SDK board-read surface with boards:read; no write permission, account mutation or shared-link changes.
- [ ] Preserve exact string IDs, type/raw unknown records, geometry with coordinate convention, parent/group relations, URLs and asset mapping.
- [ ] Include previews and compare export capability to official REST/Web SDK support; record unsupported/opaque items, connectors and frames explicitly.
- [ ] Exercise exporter logic on generated fixtures before any live source use. Real-source fidelity remains NOT_CHECKED until separately authorized access exists.
- [ ] Retain original exports and give loss/coverage context; PDF/SVG appearance and CSV/RTB limitations are not mistaken for editable structural equivalence.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/miro-export.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

T01 discovery first. Synthetic implementation can proceed without Miro; only the real-board validation portion waits for authorized access.

Current state: done 2026-11-08; independently verified PASS (two rounds) and integrated on main as c0059b7..c3edccc. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
