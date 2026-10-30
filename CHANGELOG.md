# Changelog

## Unreleased

### Documentation

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
