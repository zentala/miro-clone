---
formatVersion: 1
id: "E001-T24"
title: "Remove hosted-SDK remnants, unused packages and unused public assets"
status: "done"
priority: "medium"
type: "chore"
dependencies: ["E001-T02"]
epic: "E001"
points: 3
importance: "Medium"
effort: "small"
role: "implementer"
executor: "t24-impl (Herdr w2G, claude)"
write_set: [".env.example", "components/auth/**", "lib/utils.ts", "package.json", "package-lock.json", "public/**", "README.md"]
handoff_ref: "../HANDOFF.md"
verification: ["just check", "just container-check"]
commit: "chore(cleanup): [E001-T24] remove hosted-SDK remnants and unused assets"
completion: "Yes"
execution: "dispatched 2026-11-08 by dm-miro"
phase: 2
completed_at: "2026-11-08"
commits: ["37994cd"]
verification_evidence: ["implementer: just check 0; container-check 0 (3/3, 7/7); first manual container probe failed on a wrong tmpfs option (retained)", "verifier t24-verify round 1: PASS all criteria except write_set (components/ui/avatar.tsx, Low) -> accepted by PO; image 267,136,593 -> 254,580,813 B; /app/public 12,729,424 -> 185,469 B; remaining assets render in browser probe", "round 2 after rebase onto T16: just check 0 (critical 9/9, export 14/14, packaging 2+1 skip, model 6/6, normalize 12/12); locked container-check 0 (3/3, 9/9)"]
evidence: ["PO accepted removal of components/ui/avatar.tsx (dead file, only importer of @radix-ui/react-avatar)", "Open Low: lockfile root entry lacks engines >=22.18 that package.json has (from T16); next npm install adds it", "Out of scope: next/font downloads Google fonts at image build -> T10 criterion (1787c74)"]
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
