---
formatVersion: 1
id: "E001-T23"
title: "Split the editor browser test and lint tools/ and tests/"
status: "pending"
priority: "medium"
type: "chore"
dependencies: ["E001-T02", "E001-T03"]
epic: "E001"
points: 3
importance: "Medium"
effort: "small"
role: "implementer"
executor: "unassigned"
write_set: ["Dockerfile", "tests/critical-editor.test.cjs", "tests/critical-editor/**", "tests/fixtures/**", ".eslintrc.json", "package.json", "justfile", "AGENTS.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "test(editor): [E001-T23] split the editor browser test and lint tools and tests"
completion: "No"
execution: "not-dispatched"
phase: 2
completed_at: null
commits: []
verification_evidence: []
evidence: []
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
- [ ] No new dependencies.

## Independent verification

An independent verifier runs `just check` and compares the TAP step list before
and after the split. The implementer does not certify its own diff.
