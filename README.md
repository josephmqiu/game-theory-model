# Game Theory Analyzer

A desktop application for AI-assisted game-theoretic analysis of real-world events. Discuss situations with AI through chat, and watch structured analysis materialize as an interactive entity graph on a canvas.

<!-- TODO: Add screenshot here -->
<!-- ![Game Theory Analyzer screenshot](docs/screenshot.png) -->

## What It Does

Game Theory Analyzer helps you model real-world strategic interactions — negotiations, competitions, policy decisions — using formal game-theory frameworks. You chat with AI about a situation, and the system runs structured multi-phase analysis that produces:

- **Players** with defined strategies, goals, and constraints
- **Payoff structures** showing outcomes for each strategy combination
- **Equilibrium analysis** identifying stable outcomes (Nash, dominant strategies, etc.)
- **Strategic recommendations** grounded in the analytical methodology

All analysis is visualized as an entity graph on a canvas — the primary workspace, not just a chat window.

## Features

- AI-powered game-theoretic analysis via Claude and Codex runtimes
- Interactive canvas with entity graph visualization (Skia/CanvasKit)
- Multi-phase analytical methodology (situation framing through meta-analysis)
- Web search integration for evidence-backed modeling
- Desktop app (Electron) with web fallback
- Local-first — your data stays on your machine
- `.gta` file format for saving and sharing analyses

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Node.js](https://nodejs.org) (v20+)
- A Claude API key or local Claude agent setup

### Install & Run

```bash
# Clone the repository
git clone https://github.com/josephmqiu/game-theory-model.git
cd game-theory-model

# Install dependencies
bun install

# Start the dev server (web)
bun run dev
# Opens at http://localhost:3000

# Or run as a desktop app
bun run electron:dev
```

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
bun run build                      # Vite client build (frontend only)
bun run test                       # Run tests
bun run typecheck                  # TypeScript check
bun run electron:dev               # Electron dev mode
bun run electron:build:mac-arm64   # Full production build (client + server + MCP + DMG)
```

> **Note:** `bun run build` only builds the frontend. Server-side changes (Nitro, codex-adapter, MCP server) require the full Electron build to take effect in the desktop app.

### Project Structure

```
src/                   # React frontend (renderer)
  canvas/              # Skia canvas engine
  components/          # React components
  services/            # Domain services
  stores/              # Zustand state stores
server/                # Node.js backend (AI pipeline, evals)
electron/              # Electron main process
public/                # Static assets
```

### Architecture Notes

- **Runtime boundary**: Code in `src/` runs in the browser. Code in `server/` runs in Node.js. Never import Node.js APIs from `src/`.
- **Canvas is the product**: The entity graph canvas is the primary analysis surface. Chat is the control panel, not the workspace.
- **AI integration**: Uses tool-based local runtimes (Claude Agent SDK, Codex JSON-RPC), not direct provider API calls.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

[MIT](LICENSE) &copy; josephmqiu
