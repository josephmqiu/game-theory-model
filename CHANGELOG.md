# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
