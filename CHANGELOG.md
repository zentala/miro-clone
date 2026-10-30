# Changelog

## Unreleased

### Documentation

- Add a feature map separating explicit requirements, observed reference UI and proposed additions; reference screenshots and raw boards remain private.
- Record acceptance of epic directions while detailed behavior, estimates and execution order remain open. Add explicit code font-size, line-number and common object-lock requirements.
- Record the owner-accepted requirements that frame locks protect all contained descendants and frame unlock preserves individual child locks. These are not implemented; mixed-selection, unlock gestures and other detailed behavior remain proposed.
- Distinguish record-table views from rich-text tables and existing editor behavior from future candidates. No product feature or dependency is added.
- Record the personal-whiteboard purpose, implemented local architecture, breaking backend change and proposed migration roadmap, with unimplemented requests marked explicitly.
- Distinguish delivered features from planned image loading, extraction, frames, richer text, tables and code blocks.

## 2026-10-29

### Changed — breaking

- Replace active Clerk identity, Convex persistence and Liveblocks collaboration with a single local workspace and server-side SQLite persistence.
- Store local board metadata and documents without hosted accounts or credentials.
- Hosted organization, board and room state is not automatically imported. Multi-user use and concurrent editing tabs are unsupported.

### Added

- Local board API, serialized autosave, save status and retry behavior.
- Non-root Node 22 container packaging with SQLite persistence under `/app/data`; no deployment is implied.
- Focused browser acceptance checks for creation, pointer drawing, undo/redo, downloaded PNG, reload and application restart persistence; foreign-Origin rejection for POST/PATCH/DELETE.

### Known limitations

- Legacy SDK dependencies remain until cleanup.
- Frames, image layers, product/link cards, richer text, syntax-highlighted code blocks and table views are not implemented in this release.
- The existing 100-layer editor and validation limit must be addressed before large-board migration.
- All-shape flows, rename/delete, failed-save recovery and grouped drag history are not covered by the focused browser test.
- No automated import or conversion from hosted backend state is provided.
