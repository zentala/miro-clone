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
| 2026-11-08 | Fonts bundled locally: Inter, Kalam, Source Serif 4, JetBrains Mono (all OFL) | `next/font/google`, build-time download | PO decision 5; no runtime or build-time font CDN | Accepted by PO 2026-11-08 |
| 2026-11-08 | Board title uses Inter (local file) | Poppins via Google | Smaller font set | Accepted by PO 2026-11-08 |
| 2026-11-08 | Board grid: SVG dot pattern in neutral-300 on the neutral-100 workspace, scaled with zoom, faded out below 0.25 | Plain neutral-100 | Required gray grid; keeps the existing workspace colour | Accepted by PO; visual review in T07 |
| 2026-11-08 | Frames: white fill, neutral-300 1px border, title label above the top-left corner in Inter 12px neutral-600 | No frames | Reads as a surface on the grid without new colours | Accepted by PO; visual review in T08 |
| 2026-11-08 | Developer tool pages under `tools/` (e.g. `tools/miro-export/index.html`) keep their own minimal styling (accent #2563eb) and are outside the app's visual system | None | They run inside third-party panels, not in the board UI | Accepted by PO 2026-11-08 |
| 2026-11-08 | Lock: lucide `Lock` icon badge at the selection's top-right; lock toggle as a 40px icon button in the selection panel; locked selection outline neutral-400 instead of blue | No lock state | Visible, distinct from normal selection, reuses existing controls | Accepted by PO; visual review in T09 |
| 2026-11-08 | Text and code toolbars reuse the white rounded selection panel (`selection-tools.tsx:93`) and 40px buttons/inputs | Colour, order, duplicate, delete only | One panel style for every object | Accepted by PO; visual review in T10/T11 |
| 2026-11-08 | Refused lock operations show the reason as readable text in the existing save-status area | Silent refusal (`canvas.tsx:96-98` pattern) | PO decision 2 requires a visible reason | Accepted by PO; visual review in T09 |
| 2026-11-08 | Grid details: neutral-300 dots of 1 px radius every 24 world units, drawn as a CSS `radial-gradient` background of the workspace behind the SVG (not an SVG pattern); hidden below 25 % zoom, opacity 1/3 at 25 % rising to full at 50 % | Plain neutral-100 | Same look as the accepted dot grid; outside the SVG scene it cannot be saved, hit or exported | Proposed by T07; PO review |
| 2026-11-08 | Zoom panel bottom-right: white rounded `h-12` panel like Info, 40px `board` icon buttons (lucide Minus/Plus) around a 64px percentage button that resets to 100 %; reset-camera panel sits to its left and appears whenever pan or zoom differs from the default | Reset-camera panel alone at bottom-right, shown only when both x and y were non-zero | Zoom needs visible controls; reuses existing panel and button scale | Proposed by T07; PO review |
| 2026-11-08 | Selection outline, net and resize handles keep their screen size at every zoom (6px handles, 1px non-scaling strokes) | Sizes in world units | Handles stay usable at 5 % and 400 % | Proposed by T07; PO review |
| 2026-11-08 | Board capacity refusal: `text-xs text-destructive` text with `role="alert"` beside the save status in the Info panel | Silent refusal at 100 layers | Visible reason, same place as lock refusals (T09) | Proposed by T07; PO review |
| 2026-11-08 | A board this version cannot open (HTTP 409) shows a readable sentence (`role="alert"`) and the existing "Back to boards" link | Generic "Unable to load board." | Carried from T03 review | Proposed by T07; PO review |

## Implementation evidence
The dashboard now lists local boards; editor toolbar, shapes, selection tools,
fonts, and PNG rendering still use the existing components. A compact save
status/retry action uses the existing panel and button scale. No rendered
geometry or browser workflow checks have been performed.
