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
- Existing Inter UI and Kalam authored text remain; chrome changes must not
  alter authored content, geometry, history, SVG rendering or PNG export.
- Reuse existing Radix primitives and project buttons/inputs. Errors and save
  status must be readable text, with keyboard-accessible actions.

## Decision ledger
| Date | Decision | Previous behavior | Reason | Status |
| --- | --- | --- | --- | --- |
| 2026-10-29 | One local board workspace, no organization/account controls | Clerk organization dashboard | Accepted single-user scope | Source implemented; browser NOT_CHECKED |
| 2026-10-29 | Preserve editor geometry and visual tokens | Existing editor | Persistence integration only | Source baseline |

## Implementation evidence
The dashboard now lists local boards; editor toolbar, shapes, selection tools,
fonts, and PNG rendering still use the existing components. A compact save
status/retry action uses the existing panel and button scale. No rendered
geometry or browser workflow checks have been performed.
