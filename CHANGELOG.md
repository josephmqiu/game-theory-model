# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-03-23

### Added

- Workspace runtime transport streams analysis state, phase progress, entity graph changes, and chat events to the renderer over one WebSocket channel family
- Runtime-status service tracks analysis lifecycle server-side — the renderer now projects server-owned state from workspace runtime events instead of polling or owning it directly
- Run-status store in the renderer projects server-owned analysis state for UI components
- MCP product tools run in-process with Nitro for Claude; Codex gets a dedicated stdio proxy
- Dismiss API (`POST /api/ai/dismiss`) lets the renderer acknowledge and clear completed analysis runs
- Smoke test suite covering runtime transport boot, MCP tool execution, desktop launch, and live provider connectivity
- Integration test suite for the analysis pipeline, orchestrator, revalidation service, workspace runtime transport, and MCP product tools
- Electron persistence layer for durable prefs/settings writes across app restarts

### Fixed

- Hardened Electron persistence so prefs/settings writes are less likely to lose state on failure or overlap
- Added runtime request validation to AI routes so malformed bodies fail with `400` instead of partial mutation or server exceptions
- Codex runtime failures that were previously swallowed now surface in logs for easier debugging
- Revalidation no longer drops queued entity IDs when the runtime is busy — all pending work is preserved

### Changed

- Removed confirmed orphaned files, dead store symbols, and clearly unused dependencies from the live product path
- Realigned public docs, issue templates, and PR guidance around the desktop-first product and renderer-dev distinction
- Refreshed the macOS release build for the patch release artifacts

## [0.4.0] - 2026-03-21

### Added

- Multi-phase AI analysis pipeline with 10-phase game-theory methodology
- Interactive entity graph canvas (Skia/CanvasKit) as primary analysis surface
- Entity types: players, games, strategies, payoffs, equilibria, and 20+ more
- Relationship edges between entities with type-based rendering
- Phase sidebar with filtering and search
- Entity overlay cards for detail inspection
- Claude Agent SDK and Codex JSON-RPC integration
- `.gta` file format for saving and loading analyses
- Auto-updater with graceful handling of pre-release state
- Evaluation harness with 20 fixtures across difficulty tiers

### Changed

- Rebranded from OpenPencil fork to Game Theory Analyzer
- Canvas is now the primary workspace; chat is the control panel

## [0.1.0] - 2026-03-15

### Added

- Initial fork from OpenPencil with game-theory analysis direction
- Basic project structure with Electron + React + Vite + Bun
