# Contributing to Game Theory Analyzer

Thanks for your interest in contributing! This document covers the process and standards for contributing to this project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Node.js](https://nodejs.org) (v20+)
- Git

### Setup

```bash
git clone https://github.com/josephmqiu/game-theory-model.git
cd game-theory-model
bun install
bun run electron:dev
```

Use `bun run dev` when you only need the renderer/browser development surface. Use `bun run electron:dev` for the actual desktop product path.

### Verify your setup

```bash
bun run typecheck   # Should pass with no errors
bun run test        # Should pass all tests
```

If your change touches Custom API/BYOK behavior, prepare a built server and run the live custom-provider smoke against a real or local OpenAI-compatible endpoint:

```bash
bun run test:smoke:prepare
CUSTOM_BASE_URL=https://example.com/v1 \
CUSTOM_MODEL=model-id \
CUSTOM_API_KEY=replace-me \
bun run test:live:custom
```

`CUSTOM_API_KEY` is optional for keyless local endpoints. Do not commit real keys or paste them into issues.

## How to Contribute

### Reporting Bugs

Use the [bug report template](https://github.com/josephmqiu/game-theory-model/issues/new?template=bug_report.yml). Include:

- App version (from `package.json`, the packaged app version, or the macOS native About panel if applicable)
- Platform (macOS, Windows, Linux, or renderer dev server if the bug is development-only)
- Steps to reproduce
- Expected vs actual behavior

### Suggesting Features

Use the [feature request template](https://github.com/josephmqiu/game-theory-model/issues/new?template=feature_request.yml).

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run checks: `bun run typecheck && bun run test`
5. Submit a pull request

### Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Follow existing code conventions (see below)
- Include tests for new behavior
- Fill out the [PR template](.github/pull_request_template.md)

## Code Standards

### Naming

- Files: `domain-role` pattern (e.g., `canvas-store.ts`, `entity-layout.ts`)
- Stores: `<domain>-store` (e.g., `canvas-store`, `document-store`)
- Services: `<domain>-<job>` (e.g., `entity-layout`, `design-screenshot`)

### Runtime Boundary

This is the most important architectural rule:

- `src/` runs in the **browser** (via Vite). No Node.js APIs allowed.
- `server/` runs in **Node.js**. Node.js APIs are fine here.
- Communication between them: HTTP/SSE only.
- Mocked unit tests cannot catch boundary violations — test in the browser.

### Testing

- Tests protect real behavior, not implementation details
- Run `bun run typecheck && bun run test` before submitting
- Build/typecheck/test passing is necessary but not sufficient — verify runtime behavior too
- If your change affects desktop-only behavior, verify it in `bun run electron:dev`
- If your change affects packaging, signing, or secret storage, verify a packaged build with `bun run electron:build:mac-arm64` and `bun run test:smoke:packaged`
- If your change affects Custom API/BYOK behavior, run `bun run test:live:custom` or explain why no real endpoint was available

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.
