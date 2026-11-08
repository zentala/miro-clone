---
formatVersion: 1
id: "E001-T24"
title: "Remove hosted-SDK remnants, unused packages and unused public assets"
status: "pending"
priority: "medium"
type: "chore"
dependencies: ["E001-T02"]
epic: "E001"
points: 3
importance: "Medium"
effort: "small"
role: "implementer"
executor: "unassigned"
write_set: [".env.example", "components/auth/**", "lib/utils.ts", "package.json", "package-lock.json", "public/**", "README.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check", "just container-check"]
commit: "chore(cleanup): [E001-T24] remove hosted-SDK remnants and unused assets"
completion: "No"
execution: "not-dispatched"
phase: 2
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T24: Remove hosted-SDK remnants, unused packages and unused public assets

## Outcome

Finish the T02 cleanup: no configuration, code or package left over from the
retired hosted services, and a container image without unused files. Added by
PO on 2026-11-08 from the T02 implementer's report.

## Acceptance criteria

- [ ] `.env.example` lists no Clerk/Convex/Liveblocks keys; the app needs no secret to start.
- [ ] Trace every import before deleting: `components/auth/loading.tsx`, `connectionIdToColor` in `lib/utils.ts`, and the packages `date-fns`, `query-string`, `usehooks-ts`, `@radix-ui/react-avatar` are removed only if no active code uses them; report each verdict.
- [ ] Unused files in `public/` (about 12.5 MB of SVG, including the 8 MB `note.svg`) are removed only after a grep over source and CSS shows no reference; report image size before and after.
- [ ] `just check` and `just container-check` pass; the six UI steps still pass.
- [ ] No new dependencies.

## Independent verification

An independent verifier re-runs the import trace and both checks. The
implementer does not certify its own diff.
