---
formatVersion: 1
id: "E001-T23"
title: "Split the editor browser test and lint tools/ and tests/"
status: "done"
priority: "medium"
type: "chore"
dependencies: ["E001-T02", "E001-T03"]
epic: "E001"
points: 3
importance: "Medium"
effort: "small"
role: "implementer"
executor: "t23-impl (w57:p4); t23-verifier (w57:p7)"
write_set: ["Dockerfile", "tests/critical-editor.test.cjs", "tests/critical-editor/**", "tests/fixtures/**", ".eslintrc.json", "package.json", "justfile", "AGENTS.md", "tests/navigation-steps.cjs", "tests/capacity-steps.cjs", "tests/document-model.test.cjs", "tests/navigation-capacity.test.cjs"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "test(editor): [E001-T23] split the editor browser test and lint tools and tests"
completion: "No"
execution: "accepted by PO; integrated on main; fresh just check and required container-check passed"
completed_at: "2026-11-25"
phase: 2
completed_at: null
commits: ["598bad6", "9c1de03", "7cbc8c2"]
verification_evidence: [".plan/reports/2026-11-25-t23-verification-round1.md: final round 2 PASS on 74eb580; cleanup fake-Podman regression preserved foreign image; all test/helper bodies under 50 lines", "main integrated just check: exit 0, 65 pass, 1 expected skip; production build succeeded at .next", "main just container-check: exit 0; packaging tests 2 pass, 1 expected skip; owned-tag cleanup recipe completed; no real shared-image deletion probe"]
evidence: ["PO accepted candidate and report before integration", "Rebased T23 commits and fast-forwarded ahead of T18/T25", "First integrated just check failure exit 2 due to missing installed @napi-rs/image was retained; npm ci from the existing lockfile then succeeded", "Existing ESLint warning in components/custom-color-picker.tsx remains unsuppressed"]
---
# E001-T23: Split the editor browser test and lint tools/ and tests/

## Outcome

Keep the verification gate readable and complete as tasks add steps: the
browser test stays under the 250-line file limit, and new JavaScript in
`tools/` and `tests/` is linted. Added by PO on 2026-11-08 from T03/T15 review
findings (T15 verifier F2; T03 test file at 341 lines).

## Acceptance criteria

- [ ] `tests/critical-editor.test.cjs` is split into files of at most 250 lines
      sharing one helper module; the same seven TAP steps still run and pass.
- [ ] The T03 legacy-document test reads a committed fixture instead of
      `git show <commit>`, so it passes in a shallow clone or container.
- [ ] `just lint` (and so `just check`) covers `tools/` and `tests/`; existing
      warnings are listed, not silenced.
- [ ] AGENTS.md "Verification" names every test file `just check` runs, including `tests/packaging.test.cjs`, and describes `just container-check`.
- [ ] `just container-check` builds the image once (T02 verifier F2) and removes the
      intermediate build-stage images it created, leaving foreign images untouched (T02 F3).
- [ ] Both Dockerfile stages pin a Node 22 minor of at least 22.18 (for example `node:22.23-bookworm-slim`), matching `engines`; `just container-check` reports the Node version (T16 verifier note).
- [ ] `just container-check` serializes itself with `flock` on a lock file under the system temp or repo `.plan/` directory, because parallel runs on the shared podman store failed twice on 2026-11-08 (`layer not known`, `ERR_CONNECTION_RESET`); a waiting run prints that it waits.
- [ ] Test functions stay under 50 lines: split `navigationSteps` (135), `capacitySteps` (58) and the main test (57) from T07 (verifier Q1).
- [ ] No new dependencies.

## Independent verification

An independent verifier runs `just check` and compares the TAP step list before
and after the split. The implementer does not certify its own diff.
