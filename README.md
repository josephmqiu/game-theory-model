# Game Theory Analyzer

A desktop application for AI-assisted game-theoretic analysis of real-world events. Discuss situations with AI through chat, and watch structured analysis materialize as an interactive entity graph on a canvas.

<!-- TODO: Add screenshot here -->
<!-- ![Game Theory Analyzer screenshot](docs/screenshot.png) -->

## What It Does

Game Theory Analyzer helps you model real-world strategic interactions — negotiations, competitions, policy decisions — using formal game-theory frameworks. You chat with AI about a situation, and the system runs structured multi-phase analysis that produces structured findings such as:

- **Players, objectives, and strategies** captured as first-class analysis entities
- **Game structures, payoff estimates, and equilibrium results** when the methodology reaches formal modeling
- **Scenario branches, central theses, and meta-check findings** that can be inspected and challenged on the canvas

All analysis is visualized as an entity graph on a canvas — the primary workspace, not just a chat window.

## Features

- AI-powered game-theoretic analysis via Claude and Codex runtimes
- Interactive canvas with entity graph visualization (Skia/CanvasKit)
- Multi-phase analytical methodology (situation framing through meta-analysis)
- Web search integration for evidence-backed modeling
- Desktop app (Electron) as the live product, with a browser dev surface for renderer work
- Local-first workspace state, with documented outbound network dependencies
- `.gta` file format for saving and sharing analyses

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Node.js](https://nodejs.org) (v20+)

For live AI runtime features, also install and authenticate one or both of:

- Claude Code
- Codex CLI

### Install & Run

```bash
# Clone the repository
git clone https://github.com/josephmqiu/game-theory-model.git
cd game-theory-model

# Install dependencies
bun install

# Preferred: run the desktop app
bun run electron:dev

# Renderer-only development surface
bun run dev
# Opens at http://localhost:3000
```

> **Note:** The live product is the desktop app. `bun run dev` is useful for renderer development, but Electron is the canonical runtime path for product behavior.

## Docker Support

Docker is supported as a secondary Nitro/runtime surface. It is useful for headless runs and runtime validation, but it is not the canonical desktop delivery path.

Available image targets:

- `base` - plain Nitro runtime
- `with-claude` - includes Claude Code CLI
- `with-codex` - includes Codex CLI

Minimal examples:

```bash
docker build --target base -t gta-base .
docker run --rm -p 3000:3000 gta-base

docker build --target with-claude -t gta-with-claude .
docker run --rm -p 3000:3000 \
  -v "$HOME/.claude:/root/.claude" \
  gta-with-claude

docker build --target with-codex -t gta-with-codex .
docker run --rm -p 3000:3000 \
  -v "$HOME/.codex:/root/.codex" \
  gta-with-codex
```

The mounted `~/.claude` and `~/.codex` directories carry the local auth and config state that the CLI-based runtimes expect. Docker does not replace that local setup.

The app's in-process MCP HTTP server stays container-internal by default; the examples above expose only the Nitro app port.

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Framework      | React 19, TanStack Router          |
| State          | Zustand                            |
| Styling        | Tailwind CSS v4                    |
| Canvas         | CanvasKit (Skia)                   |
| Desktop        | Electron 35                        |
| Runtime        | Bun                                |
| Testing        | Vitest                             |
| AI Integration | Claude Agent SDK, Codex (JSON-RPC) |

## Development

### Commands

```bash
bun run dev                        # Dev server on port 3000
bun run build                      # Build the Nitro-backed app into .output
bun run test                       # Run tests
bun run typecheck                  # TypeScript check
bun run electron:dev               # Electron dev mode
bun run electron:build:mac-arm64   # Full production build (client + server + MCP + DMG)
```

> **Note:** `bun run build` emits the Nitro-backed runtime under `.output`. Electron packaging still uses the `electron:build:*` commands for desktop artifacts.

## Network Access

Game Theory Analyzer stores its workspace data locally, but some features make outbound network requests:

- AI runtime calls send prompts and relevant context to the configured Claude/Codex-compatible runtime or provider path.
- Evidence-backed analysis may use web search providers during research steps.
- The UI fetches icon metadata from `https://api.iconify.design`.
- The canvas font loader may fetch font CSS and font files from `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, and `https://fonts.font.im`.

If you need a stricter offline posture, review these integrations before running the app in a network-restricted environment.

### Project Structure

```
src/                   # React frontend (renderer)
  canvas/              # Canvas layout engine and Skia rendering
  components/          # React components
  services/            # Domain services (analysis client, etc.)
  stores/              # Zustand state stores
server/                # Node.js backend (AI pipeline, MCP, services)
  api/ai/              # AI HTTP route handlers (analyze, entity, connect, state, abort)
  mcp/                 # MCP server and product tools
  services/            # Runtime status, revalidation, entity graph
electron/              # Electron main process + persistence
smoke-tests/           # Integration smoke tests (runtime, MCP, desktop)
public/                # Static assets
```

### Architecture Notes

- **Runtime boundary**: Code in `src/` runs in the browser. Code in `server/` runs in Node.js. Never import Node.js APIs from `src/`.
- **Canvas is the product**: The entity graph canvas is the primary analysis surface. Chat is the control panel, not the workspace.
- **AI integration**: Uses tool-based local runtimes (Claude Agent SDK, Codex JSON-RPC), not direct provider API calls.

## Documentation

| Document                           | Purpose                 |
| ---------------------------------- | ----------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute       |
| [CHANGELOG.md](CHANGELOG.md)       | Release history         |
| [SECURITY.md](SECURITY.md)         | Vulnerability reporting |

## License

[MIT](LICENSE) &copy; josephmqiu
