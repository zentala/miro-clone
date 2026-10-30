# Feature map and acceptance questions

Planning update: 2026-10-30. The owner accepts the epic directions and requests a wider plan before feature implementation. No capability below becomes implemented merely by appearing here.

## Evidence and requirement levels

Nine private owner-supplied reference screenshots, inspected by the reviewer, show: a protected/locked toolbar with long-press unlock; full-page and embedded table views; named/nested frames on a gray grid; a text toolbar; a font picker; text and background/highlight palettes; and a code toolbar with language, font size, line-number and lock controls. They are interaction references, not permission to copy Miro assets or a requirement for pixel-identical UI. Screenshots and private board exports remain outside public Git.

Use three distinct labels: **required** means explicitly requested behavior;
**observed** means visible in reference material but not automatically requested;
**proposed** means an additional candidate or unsettled design to align with the
owner. Acceptance of broad directions does not accept every detail below.

## Implemented source baseline

The actual source currently models only rectangles, ellipses, freehand paths,
text and notes. It has local SQLite document saves, session-local undo/redo,
selection/multiselection, duplication, layer ordering and save/status/retry UI.
The canvas wheel handler translates the camera; this is not a completed zoom
model. The editor and validator cap documents at 100 layers. There are no
frame, lock, image, product-card, code-block or record-table layer types. Basic
text/notes use the existing editable content and calculated font size, not the
requested richer controls. Reference screenshots do not demonstrate features
in this fork. See [current architecture](ARCH.md#implemented-baseline).


## Common object behavior

### Required: lock/unlock

Frames, code blocks and other individual elements can be locked. Lock is a local editing protection, not authentication, encryption or access control.

**PROPOSED default semantics — none of these details is settled:**
- A locked object remains visible and may be intentionally selected for inspection/unlock; ordinary editing gestures cannot move, resize, rotate, edit, delete or replace it.
- Enforce the same rule through mouse, touch, keyboard, context menu and future API actions; disabling only toolbar buttons is insufficient.
- Lock/unlock and persisted lock state participate in undo/redo and survive reload.
- **PROPOSED inherited lock:** a locked frame protects its descendants as an effective inherited lock. Child-specific locks remain when the parent is unlocked. A locked child cannot bypass protection by reparenting or through a multi-selection transform.
- A mixed locked/unlocked selection must not partially mutate without a clear rule; propose refusal of the whole geometry operation, with the reason visible.
- Selecting through/around locked frames should remain possible so a background frame does not obstruct unrelated work.
- Show an obvious lock indicator and an intentional unlock action. Long-press unlock is observed; provide a keyboard-accessible alternative rather than relying exclusively on a timed gesture.

Proposed future acceptance scenarios cover move/resize/delete/text edit, mixed
selection, locked parent/unlocked child, nested frames, unlock, undo/redo and
save/reload. The expected results depend on aligning the semantics first.
Do not assume the upstream data model can be copied directly.

### Proposed common capabilities to evaluate

Multi-selection, duplication and layer ordering already exist; proposed work
would refine/test their interaction with new object types and locks. Additional
**PROPOSED** candidates: internal copy/paste preserving relative positions,
grouping distinct from frames, alignment/distribution, optional snapping,
object hyperlinks and stable links to a frame, find text/URL, fit-to-content
and frame navigation. None is automatically part of the first migration.

## Required: frames and board navigation

Frames contain elements and move with their contents; nesting is required.
**Observed:** named outer/inner frames alongside a separate named frame.
**Proposed model constraints:** explicit parent-child relations, coordinate
preservation on reparenting and cycle rejection. Naming/title interactions and
frame model details still require alignment; private board labels are omitted.

Required supporting behavior: nested frames, gray background grid, persistent geometry, reliable undo/redo and zoom/pan usable on image-heavy boards. The current 100-layer cap in both editor and validation is a known migration blocker.

Proposed details to align: resizing a frame changes only its boundary by default (does not silently scale children); optional clipping; frame title editing; frame list/outline; fit selected frame; distinguish group from frame. These details are not settled solely by screenshots.

## Required: rich text and notes

Font family, font size, bold, italic and text color are requested. Reference toolbars additionally show alignment, lists, hyperlinks and a background/highlight palette; include these as observed candidates for alignment. Do not mistake background fill for text color. Opacity is visible in a palette but the exact target still needs confirmation.

**Proposed engineering approach:** structured content, sanitized pasted markup,
formatting persistence/migration where supported, a plain-text fallback, and
reuse of an established editor instead of custom rich-text selection logic.
These design details and the library require alignment; no dependency is selected.

Questions: which fonts are essential; which fonts can be locally bundled under compatible licenses; whether formatting applies to a selection or whole object; whether notes and standalone text use the same controls. Load editor and fonts lazily; do not mount a full editor for every distant object.

## Required: code blocks

- Editable source text preserving whitespace and indentation.
- Existing-library syntax highlighting; do not implement a lexer.
- Per-block font-size control.
- Per-block show/hide line numbers.
- Per-block lock/unlock using the common object behavior.
- Preserve source text through editing; detailed persistence/history behavior for new controls remains to align, following the existing durable-board direction.

**Observed:** language selector and size control. **Proposed persistence contract:** retain source, language and display settings through save/reload and undo/redo. **Additional PROPOSED candidates:** language selection/auto-detection with override, copy raw code, wrapping toggle, tab/indent settings and light/dark presentation. Auto-detection must not rewrite the source. A code block displays/edits code; it does not execute arbitrary code.

Choose the smallest existing solution matching the editing requirement. A rich-text editor code extension may suffice; a dedicated editor is an option if needed. Neither a library nor a theme is selected yet. Syntax-only display and full code editing are different scopes; avoid adding a full IDE unnecessarily. Load only required languages and mount the interactive editor when editing.

## Required: tables as shared records with two views

The private reference shows an embedded record table and an expanded page-like view with a return-to-canvas control. Both must edit one underlying dataset and retain a stable table identity, not divergent copies.

Observed columns: Title, Description, Status, Assignee, Start Date, End Date, Estimate and Priority. Toolbar icons suggest filtering, sorting, column/view settings and search. Their exact behavior is not established by a screenshot.

Proposed phased scope:
1. Editable rows, configurable columns, text/number/date/single-choice types, persistent order and an expanded view; return to the same board viewport.
2. Filter, sort, search, column visibility/width and CSV interchange if needed.
3. Additional view types, formulas and relations only after demonstrated use.

Assignee does not imply restoring user accounts or collaboration: a personal label may suffice. Choose a ready grid/table library after distinguishing a record-oriented table from a rich-text table. An editor table extension alone may not meet this reference. The relative priority and first table slice remain to align; screenshot detail alone does not set an execution order.

## Required: images, website and product cards

Progressive images: metadata gradient, small preview, appropriate resolution for actual displayed dimensions and DPR; cull off-screen objects and bound requests/decoded memory. No needless originals. Capture URL metadata even when the extension has no previously saved card. Reuse extraction functions/schema and choose execution separately: normal fetch, extension capture, or a justified bounded shared browser worker.

The existing direction retains exact URLs/product variants and local asset
copies where permitted. **Proposed additional metadata:** source/capture
timestamps. **Additional PROPOSED fallbacks:** raw clickable URL while extraction is pending, retry on error, manual title/thumbnail, and deliberate refresh of captured metadata without overwriting user edits. Unavailable extraction must not block board editing.

## Required migration and operational foundation

Inspect -> authorized structural export -> normalization -> dry run -> new-board import -> comparison. Preserve IDs as strings, geometry, parents, URLs, formatting where supported and assets. Explicitly report unknown types and losses; never silently discard them. Test retry idempotency and backup/restore of both SQLite and files before real import.

Save status and retry UI already exist. **Additional PROPOSED foundations:**
schema versions/forward migrations, portable editable board export/reimport,
broader recovery behavior, extended keyboard/accessibility coverage,
large-board search, asset deduplication and deliberate orphan cleanup. Any cleanup of real data requires its own safe script and scope. No recurring job, browser service or integration is authorized solely by this map.

## Wider epic directions and dependencies

Acceptance of directions is distinct from ready implementation. Final estimates remain unknown until bounded tasks are refined; earlier 65 points do not cover expanded work. Importance values in the table remain proposals for alignment. Every future task carries Importance and Points and existing independent review/check requirements. Do not invent a total or dispatch route while scope is unknown.

| Epic direction | Scope / dependency | Importance | Points | Execution | Done |
|---|---|---|---|---|---|
| Lean local foundation | Accepted Docker slimming/legacy cleanup direction; measure build/runtime and preserve behavior | High | ? | Direction accepted; details pending | No |
| Shared object model and editing protection | Common lock direction accepted; inherited locks, schema versions and detailed history rules PROPOSED | High | ? | Direction accepted; details pending | No |
| Efficient assets | File storage, variants, viewport-aware loading, backup/restore | High | ? | Direction accepted; details pending | No |
| Canvas navigation and frames | Grid, zoom/pan, nested frames, movement; depends on object relations | High | ? | Direction accepted; details pending | No |
| Rich text and code | Ready editors, font controls, line numbers, persistent settings; depends on lock model | High | ? | Direction accepted; details pending | No |
| Website/product capture | Shared extraction contract and card UI; depends on asset storage, not prior saved cards | High | ? | Direction accepted; details pending | No |
| Record tables and expanded view | Two views of one dataset, then optional filtering/search; exact first slice to align | Medium | ? | Direction accepted; details pending | No |
| Repeatable migration | Structural discovery can start independently; importer depends on actual object coverage | High | ? | Direction accepted; details pending | No |
| Daily usability and recovery | Candidate search/grouping/alignment/shortcuts and portable export; select by actual use | Medium | ? | Proposed expansion | No |

Next alignment questions: confirm inherited frame-lock semantics, choose the first essential rich-text controls, and confirm the first table slice. Source exporters and the shared object model can be planned without treating every observed toolbar icon as a requirement. Product implementation remains undispatched.

## Planning boundary

This map refines [the existing roadmap](ROADMAP.md); it creates no parallel
execution queue, ready task handoff, dependency selection, new service or
account permission. The [purpose](PURPOSE.md) and [vision](VISION.md) remain
personal self-hosting without authentication/collaboration/SaaS. Raw boards,
reference screenshots and private working notes remain untracked. Future
implementation must first resolve the questions above against representative
migration needs; no product code is changed by this planning update.
