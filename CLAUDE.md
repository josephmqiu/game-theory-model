# CLAUDE.md

## What This Is

A locally-deployed desktop app (Electron + React + Vite + Bun) forked from OpenPencil for AI-assisted game-theoretic analysis of real-world events. Data stays on the user's machine; core analytical functions require internet. The user chats with AI to discuss situations, and the AI runs structured analysis that materializes as an entity graph on a canvas. The canvas is the main analysis surface; chat is the interaction layer. The analytical methodology in `docs/game-theory-analytical-methodology.md` is the domain spec.

## Stack

React 19, TanStack Router, Zustand, Tailwind v4, Skia (CanvasKit), Vitest, Electron 35, Bun.

## Commands

- `bun run dev` — dev server on port 3000
- `bun run build` — Vite client build only (frontend assets)
- `bun run test` — vitest
- `bun run typecheck` — tsc --noEmit
- `bun run electron:dev` — electron dev mode
- `bun run electron:build:mac-arm64` — full Electron production build (client + server + MCP + DMG)

### Build distinction

`bun run build` only builds the Vite frontend. Server code (Nitro, codex-adapter, MCP server) is NOT rebuilt by this command alone. For a full production build that includes server changes, use `bun run electron:build:mac-arm64`. The full chain is: `vite build` → `electron:compile` → `mcp:compile` → `electron-builder`.

## Rules

### Runtime boundary

Code that imports Node.js APIs (`child_process`, `node:fs`, Agent SDK, `global`) must live in `server/`, never in `src/`. The renderer runs in a browser via Vite — Node.js imports cause immediate crashes. Communicate across the boundary via HTTP/SSE only. Unit tests with mocks cannot catch boundary violations; verify by running the app in the browser.

### Integration modes

This app integrates with AI through tool-based local runtimes, not direct provider APIs:

- Claude via Agent SDK (local session/runtime)
- Codex via app-server (JSON-RPC protocol)
- MCP for product tool access

Do not conflate these with direct Anthropic/OpenAI API calls. Do not "fix" tool-based integration issues by introducing direct API behavior. Reference vendor docs before changing auth, connection, or error handling.

### Product rules

- One live product. `legacy/` is read-only archive.
- The canvas is the main analysis surface. Chat is the interaction layer, not the workspace.
- The methodology doc is the domain spec for what the AI pipeline should do.
- Analytical state should be server-owned. Renderer state is a projection.
- Prefer stabilization over reinvention. Deletion over duplication.
- Smallest useful slice first. No placeholder success states.
- The repo should get simpler as it gets more capable.

### Code rules

- Files: `domain-role` naming. Stores: `<domain>-store`. Services: `<domain>-<job>`.
- Tests protect real behavior. No claiming green without running checks.
- Build/typecheck/test passing is necessary but not sufficient — verify runtime behavior too.
- For vendor-specific SDK work, reference the official vendor docs before changing behavior.

## Key References

- Architecture contract: `docs/architecture/architecture-contract.md` (canonical target architecture)
- Analytical methodology: `docs/game-theory-analytical-methodology.md`
- Design system: `DESIGN.md`
- Agent rules (Codex): `AGENTS.md`

## Design System

Read `DESIGN.md` before making any visual or UI decisions. All font choices, colors, spacing, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA mode, flag any code that doesn't match DESIGN.md.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/retro`, `/debug`, `/document-release`.
