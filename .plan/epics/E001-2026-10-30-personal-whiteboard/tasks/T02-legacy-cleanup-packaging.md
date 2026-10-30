---
formatVersion: 1
id: "E001-T02"
title: "Remove retired hosted SDKs and slim container packaging"
status: "pending"
priority: "high"
type: "chore"
dependencies: ["E001-T01"]
epic: "E001"
points: 5
importance: "High"
effort: "medium"
role: "implementer"
executor: "unassigned"
write_set: ["package.json", "package-lock.json", "next.config.mjs", "Dockerfile", ".dockerignore", "liveblocks.config.ts", "convex/**", "providers/convex-client-provider.tsx", "components/room.tsx", "hooks/use-api-mutation.ts", "app/(dashboard)/_components/**", "app/board/[boardId]/_components/participants.tsx", "app/board/[boardId]/_components/cursors-presence.tsx", "app/board/[boardId]/_components/cursor.tsx", "app/board/[boardId]/_components/user-avatar.tsx", "app/board/[boardId]/_components/loading.tsx", "app/api/liveblocks-auth/route.ts", "tests/critical-editor.test.cjs", "README.md", "CHANGELOG.md", "tests/packaging.test.cjs", "justfile"]
handoff_ref: "../HANDOFF.md"
verification: ["just check"]
commit: "build(container): [E001-T02] remove retired hosted SDKs and slim container packaging"
completion: "No"
execution: "not-dispatched"
phase: 2
completed_at: null
commits: []
verification_evidence: []
evidence: []
---
# E001-T02: Remove retired hosted SDKs and slim container packaging

## Outcome

Remove unused hosted-stack code/packages after usage review and deliver a smaller equivalent non-root container, without deploying it.

Serves [PURPOSE](../../../PURPOSE.md): replace paid Miro through a representative personal-board migration.

## Input and source evidence

Read [HANDOFF](../HANDOFF.md), [PLAN](../PLAN.md), [architecture](../../../ARCH.md),
[feature map](../../../FEATURE-MAP.md) and the completed dependency records first.
Current-source references are baseline evidence; entries marked planned do not exist yet.

- `package.json:11`
- `next.config.mjs:3`
- `Dockerfile:18`
- `liveblocks.config.ts`
- `convex/schema.ts`
- `providers/convex-client-provider.tsx`
- `components/room.tsx`

## Bounds and proposed write scope

No production deployment, publication, secret/config migration or broad UI rewrite. A configured standalone flag alone is not packaging acceptance.

The frontmatter write_set is a repo-relative proposal for this app only, not current
authorization. Confirm actual impacted paths, dependency results and compatible filesystem
permissions when dispatched. Add no foreign-repository paths. Serialize overlapping
writes to schema/store/canvas, package lockfiles, test gate and shared documents.

## Acceptance criteria

- [ ] Trace all imports before deleting legacy files; no active editor/UI helper is removed merely because its directory also contains old components.
- [ ] Remove inactive Clerk/Convex/Liveblocks packages and record the verified behavior of the retired endpoint; retain no runtime hosted-account dependency.
- [ ] Measure image bytes and dependency inventory before/after; evaluate standalone output against the current full-dependency layout, retaining working full layout if tracing cannot preserve runtime assets.
- [ ] An isolated disposable container runs as non-root, writes SQLite to the intended data mount and survives replacement with the same synthetic data; PNG/fonts/static assets and six existing UI steps still work.
- [ ] Keep normal Docker context privacy exclusions and report exact build/check outcomes, including any unresolved native/bundling issue.

## Independent verification

An independent verifier inspects the actual diff and observable results against the
criteria above. The implementer does not certify its own source. Preserve every FAIL,
command exit and correction; unknown/unperformed behavior stays NOT_CHECKED.

Tests: extend the existing Node 22 node:test/CDP approach at `tests/critical-editor.test.cjs`, `tests/packaging.test.cjs`.
Use disposable databases/assets and generated fixtures; connect meaningful assertions
to the acceptance criteria, include them in the existing just check where critical,
and do not introduce a new framework or tests that merely mirror implementation.

## Known gating and evidence

Container execution for disposable acceptance must be authorized at dispatch; ordinary source checks need no live deployment. Serialize package/lockfile and shared-test edits.

Current state: pending; completion No; no executor dispatched and no verification
evidence collected for this task. Points estimate scope, not a numeric time/token limit.
For real data, access or production, preserve separate existing approval/backup boundaries.

Delivery: actual changed paths, exact check results and failures, user-visible result,
limitations and independent review evidence. Attach accepted commits/evidence only after
verified integration. No unsupported PASS or automatic deployment claim.
