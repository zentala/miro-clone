# Repository instructions

Goal: a lightweight personal, self-hosted replacement for paid Miro; no auth,
collaboration or required SaaS. Future scope follows a representative board migration.
Read [purpose](.plan/PURPOSE.md), [vision](.plan/VISION.md),
[architecture](.plan/ARCH.md), [roadmap](.plan/ROADMAP.md),
[feature map](.plan/FEATURE-MAP.md) and the
[SQLite decision](.plan/ADR/0001-single-user-sqlite.md). Future requests are
not implemented capabilities or approval for real-account access.

Read [DESIGN.md](DESIGN.md) before UI changes. Preserve the existing drawing
editor and visual direction. This application is a single-user local workspace;
active application paths must not require hosted identity or collaboration.

## Critical workflows
Create a board, draw freehand and shapes, undo, redo, export PNG, then reload
and verify the saved board title, layer order, content and geometry survive
from SQLite. Also verify rename/delete, failed saves, and grouped drag history.

## Verification
`just check` runs TypeScript, existing ESLint, a production build, and
`node --test --test-concurrency=1 tests/critical-editor.test.cjs`.
The browser test uses Node builtins and existing system Chromium, without
framework packages. It must exercise UI creation, real pointer drawing,
undo/redo, a downloaded PNG, reload and a full application process restart.
It uses a newly created temporary SQLite file, Chromium profile and downloads,
a loopback-only disposable server, finite waits and owned-process cleanup.
Never run the acceptance test against the user's database or browser profile.
Do not add dependencies or widen source paths without approval.

Rename/delete, failed-save recovery, all shape types and grouped drag history
remain outside the focused automated flow; report their coverage separately.

### Verification history
- Initial static `just check`: exit 2, pointer-event type mismatch.
- After the source correction: static `just check` exit 0 (TypeScript/lint).
  This result did not establish behavioral acceptance.
- First extended `just check`: exit 1. Browser create failed with HTTP 403;
  subsequent dependent steps failed and do not establish coverage. The Origin
  guard used Next.js's internal request origin instead of the browser Host.
- First Host-based correction: extended `just check` exit 0; all six browser
  steps passed. Review then required exact synthetic request-authority evidence
  and careful authority validation before final acceptance.
- Controlled reproduction of the original Origin guard: extended `just check`
  exit 1 in 16.109 seconds. UI create failed with HTTP 403; five dependent
  steps were skipped. This was intentional diagnostic reproduction, separate
  from the earlier six-step browser pass. Synthetic evidence: browser Origin
  `http://127.0.0.1:44123`, Host `127.0.0.1:44123`, Request URL authority
  `localhost:44123`; Forwarded absent, X-Forwarded-Host `127.0.0.1:44123`,
  X-Forwarded-Proto `http`, X-Forwarded-Port `44123`, X-Forwarded-For `127.0.0.1`.
- Accepted correction restores comparison with the actual incoming Host and
  validates the Request URL protocol as HTTP or HTTPS. Forwarded host headers
  are not trusted. Reproduction-only logging was removed. The single corrected
  candidate check passed all six browser steps, including cleanup; independent
  source review accepted the correction. That candidate's one-run restriction
  is historical and does not prohibit checks for later accepted work.

## Persistence
Node.js >=22.13 is required for built-in `node:sqlite`. Keep `data/miro.sqlite`
and its WAL/SHM files out of Git. `MIRO_SQLITE_PATH`, when set, must be an
absolute path; the acceptance test sets it to its own disposable database.
No secrets or external accounts are required.

## Portable product documents

Only the six explicitly selected product documents under `.plan` are public:
PURPOSE, VISION, ARCH, ROADMAP, FEATURE-MAP and ADR/0001-single-user-sqlite. The committed
`.gitignore` defaults all other `.plan` material to private, including BACKLOG,
STATE, archives, exports and operational notes. Never bulk-add `.plan` or force
ignored files into the index. Publish only the explicit reviewed document list.

## Feature planning boundary

Epic directions are owner-accepted; detailed behavior/estimates and execution
order await alignment in FEATURE-MAP and ROADMAP. Distinguish explicit requests
from reference UI observations and PROPOSED additions. ACCEPTED requirements:
a frame lock protects all contained descendants; unlocking it preserves
individual child locks. These are not implemented. Mixed-selection, unlock
gestures and other detailed semantics remain PROPOSED.
Screenshots/raw boards/private notes stay untracked;
never copy them into product documentation or treat them as delivered UI.
This map creates no second queue, new worker or implementation authorization.

The prior unchanged-app `just check` on 2026-10-30 exited 0 (seven TAP passes:
one parent and six critical browser steps, plus cleanup). A later planning-only
prose update must not be described as a new app test run. Preserve the earlier
failure history above; validate documentation links and privacy separately.
