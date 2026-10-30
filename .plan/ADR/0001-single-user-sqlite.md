# ADR 0001: Single-user local SQLite architecture

Date: 2026-10-30; records the local rewrite delivered on 2026-10-29.
Status: Accepted architecture. Future capabilities and cleanup remain proposed.

## Context

The upstream tutorial application uses Clerk for identity, Convex for board
metadata and Liveblocks for collaboration/editor storage. This fork serves one
person replacing paid Miro with a self-hosted board. Its future functions follow
migration of a representative board, rather than full upstream feature parity.

## Decision

Keep Next.js/React, the existing SVG editor and drawing libraries. Use Node's
built-in SQLite API for local board metadata/documents. Remove hosted identity
and collaboration from active paths; maintain one local persistence contract.
Keep the full-dependency `next start` layout used by the delivered Dockerfile.
Dependency cleanup or standalone packaging requires separate source review.

Publish only selected portable purpose, vision, architecture, roadmap and ADR
files under `.plan`. Default-ignore all other working material. Private exports,
BACKLOG/STATE, operational notes, databases and credentials stay untracked.

## Breaking changes

Clerk accounts/organizations, Convex IDs/storage and Liveblocks rooms/history
are no longer the application's identity or persistence contract. Hosted data
is not automatically converted. Multiple users, collaboration and concurrent
editor tabs are unsupported. API consumers must use the local board routes.

Board documents persist in SQLite; undo/redo history is session-local. Preserve
the database consistently with its WAL state. PNG export is a rendered image,
not a restorable editable board backup. Future assets will need coordinated
backup with the database; that asset pipeline is not implemented.

## Alternatives

Keeping the hosted architecture conflicts with the accepted personal self-hosted
scope. A runtime dual-backend switch would retain two identity/persistence
contracts and a larger test matrix without a current product requirement.

## Consequences

No account configuration or paid backend is required for active application
paths. Authentication is absent, so the application belongs in a trusted
environment. The same-origin guard does not replace access control. Legacy SDK
packages/files remain until a separately reviewed cleanup. Container packaging
is available; a built image does not establish a deployed service.

The 100-layer limit and the lack of image/link/frame/connector models constrain
migration today. Discovery and loss reporting precede any claim of editable
fidelity or source-service replacement.
