# Design contract

## Accepted direction
Preserve the existing Miro-style whiteboard. This change replaces hosted storage
and identity with a single local workspace; it does not redesign the editor.
Source inspection only; rendered appearance and accessibility are NOT_CHECKED.

## Source-grounded rules
- `app/globals.css` owns semantic HSL tokens: white background/card/popover,
  foreground `222.2 84% 4.9%`, border/input `214.3 31.8% 91.4%`, radius 0.5rem.
- `components/ui/button.tsx` owns controls: default/input rows use 40px height;
  icon buttons are 40px square. Preserve focus rings and disabled states.
- `canvas.tsx` uses a neutral-100 full-screen SVG workspace, white rounded
  floating panels, subtle shadows, blue selection and active tools.
- Preserve the left vertical toolbar, upper-left board actions, selection
  handles, contextual selection tools, and existing shape/text rendering.
- Dashboard uses white surfaces, a title and responsive board-card grid.
  Retain existing spacing, rounded cards and placeholder thumbnails.
- Existing Inter UI (`app/layout.tsx:7`) and Kalam authored text
  (`text.tsx:8`, `note.tsx:8`) remain; the board title uses Poppins
  (`info.tsx:21`). All three load through `next/font/google`. Chrome changes
  must not alter authored content, geometry, history, SVG rendering or PNG export.
- Reuse existing Radix primitives and project buttons/inputs. Errors and save
  status must be readable text, with keyboard-accessible actions.

## Decision ledger
| Date | Decision | Previous behavior | Reason | Status |
| --- | --- | --- | --- | --- |
| 2026-10-29 | One local board workspace, no organization/account controls | Clerk organization dashboard | Accepted single-user scope | Source implemented; browser NOT_CHECKED |
| 2026-10-29 | Preserve editor geometry and visual tokens | Existing editor | Persistence integration only | Source baseline |
| 2026-11-08 | Fonts bundled locally: Inter, Kalam, Source Serif 4, JetBrains Mono (all OFL) | `next/font/google`, build-time download | PO decision 5; no runtime or build-time font CDN | Proposed by T01; PO review |
| 2026-11-08 | Poppins board title: keep as a local file or switch to Inter | Poppins via Google | Smaller font set | Open for PO; T01 recommends Inter |
| 2026-11-08 | Board grid: SVG dot pattern in neutral-300 on the neutral-100 workspace, scaled with zoom, faded out below 0.25 | Plain neutral-100 | Required gray grid; keeps the existing workspace colour | Proposed by T01 |
| 2026-11-08 | Frames: white fill, neutral-300 1px border, title label above the top-left corner in Inter 12px neutral-600 | No frames | Reads as a surface on the grid without new colours | Proposed by T01 |
| 2026-11-08 | Lock: lucide `Lock` icon badge at the selection's top-right; lock toggle as a 40px icon button in the selection panel; locked selection outline neutral-400 instead of blue | No lock state | Visible, distinct from normal selection, reuses existing controls | Proposed by T01 |
| 2026-11-08 | Text and code toolbars reuse the white rounded selection panel (`selection-tools.tsx:93`) and 40px buttons/inputs | Colour, order, duplicate, delete only | One panel style for every object | Proposed by T01 |
| 2026-11-08 | Refused lock operations show the reason as readable text in the existing save-status area | Silent refusal (`canvas.tsx:96-98` pattern) | PO decision 2 requires a visible reason | Proposed by T01 |

## Implementation evidence
The dashboard now lists local boards; editor toolbar, shapes, selection tools,
fonts, and PNG rendering still use the existing components. A compact save
status/retry action uses the existing panel and button scale. No rendered
geometry or browser workflow checks have been performed.
