# AGENTS.md

## Purpose

A desktop app (Electron + React + Vite + Bun) that began as a fork of OpenPencil (a design tool with Skia canvas, `.pen` files, and AI chat). The live product is now a local-first Game Theory Analyzer.

Its target architecture is a durable, T3-inspired runtime for structured game-theoretic analysis of real-world events:

1. SQLite-backed threads, runs, messages, activities, and domain events.
2. Prompt-pack-driven analysis and chat behavior, with bundled defaults and filesystem overrides.
3. Provider-agnostic orchestration across Claude Code, Codex app-server, and MCP/tool-based workflows.
4. Session resume, durable audit trails, and renderer state that projects canonical runtime state instead of competing with it.

The analytical methodology is 10 phases in total, with 9 runnable analysis phases plus an orthogonal revalidation loop.

## Current Product Direction

1. Prompt behavior should move toward prompt packs and config, not hardcoded module constants.
2. Canonical runtime state should live in durable server-side stores, not browser-memory-only paths.
3. Tool-based integrations should stay tool-based; do not collapse them into direct provider API assumptions.
4. WebSocket/evented runtime transport is the default direction for live product flows. Any remaining HTTP/SSE path is transitional unless explicitly justified.
5. Migration shims are acceptable only when they clearly reduce risk and come with a removal condition.

## Operating Principles

1. Build one app at a time.
2. Prefer stabilization over reinvention.
3. Prefer deletion over duplication.
4. Keep the architecture boring.
5. Make the truth visible in code, tests, and documentation.
6. Finish vertical slices before starting adjacent work.
7. Treat scope as a bug source.

## Non-Negotiable Rules

1. There is only one live product in this repo.
2. No second implementation of the same feature without explicit approval.
3. No rewrite from scratch unless a bounded refactor is clearly more expensive.
4. No placeholder success states for unfinished core workflows.
5. No silent failures in critical paths.
6. No “temporary” parallel systems that lack a removal plan.
7. Any migration shim must name the canonical target it is converging toward and the condition for removing the shim.
8. No claiming green unless the relevant checks were actually run.

## Rewrite Policy

Rewrites are the exception.

A rewrite is allowed only when all of the following are true:

1. The current system cannot be repaired with a bounded refactor.
2. The replacement has a narrower scope than the system it replaces.
3. Acceptance criteria are written before implementation starts.
4. A migration plan exists.
5. A rollback path exists.
6. The team agrees on what will be deliberately left out.

If those conditions are not met, the default move is to stabilize, simplify, and iterate.


## Architecture Guardrails

1. Every important behavior should have one clear home.
2. Product logic should not be spread across multiple competing layers.
3. UI code should stay thin and avoid owning business rules.
4. State should have one source of truth per concern.
5. Side effects should be isolated behind explicit boundaries.
6. Shared abstractions must solve a real duplication problem, not a hypothetical one.
7. New infrastructure must remove complexity elsewhere, not add a new permanent layer.

## Scope Guardrails

1. Start with the smallest useful version of a feature.
2. Ship the path users actually need before adding alternate modes.
3. Hide or defer unfinished branches instead of exposing confusing half-work.
4. New feature work should not begin while core flows are failing.
5. If a task expands, split it into smaller deliverables instead of silently widening the change.

## File And Folder Rules

1. The root of the repo is for the live product.
2. `legacy/` is read-only reference material unless explicitly promoted back into the product.
3. Forked or vendored upstream code must be clearly identified.
4. Do not keep nested apps or nested repos in active product paths without an explicit reason.
5. Generated files should stay out of hand-edited areas whenever possible.

## Repository Language And Structure

Use the naming style that makes OpenPencil readable: stable domain words plus a clear role or action.

1. Use stable product domains as the primary vocabulary for the repo.
2. Prefer one canonical term per concept across folders, files, types, stores, components, and APIs.
3. Name folders by durable product areas, not by project phase, migration step, or experiment history.
4. Name files by `domain-role` or `domain-action`.
5. Let symbol names mirror file names and reuse the same domain language.
6. Keep planning labels in docs and tickets, not in shipping code names.

### Naming Patterns

1. Components use noun-role names such as `ai-chat-panel`, `top-bar`, or `provider-settings-dialog`.
2. Hooks use `use-<domain>-<behavior>` names such as `use-mcp-sync`.
3. Stores use `<domain>-store` names such as `document-store` or `agent-settings-store`.
4. Store extensions use `<domain>-store-<subarea>` names such as `document-store-pages`.
5. Services use `<domain>-<job>` names such as `design-parser`, `icon-resolver`, or `provider-registry`.
6. Types use `<domain>` or `<domain>-<concept>` names such as `pen` or `agent-settings`.
7. Utilities use narrow action names tied to a real domain such as `normalize-pen-file` or `resolve-variables`.

### Structure Patterns

1. Top-level folders should reflect technical zones such as `components`, `services`, `stores`, `types`, `hooks`, `server`, and `electron`.
2. Inside those zones, group by stable product domains such as `ai`, `mcp`, `editor`, `document`, or `providers`.
3. Create a new folder only for a durable domain, not because one file feels temporarily awkward.
4. Avoid broad dumping-ground names when a domain-specific folder would be clearer.
5. Keep upstream OpenPencil structure where it is still serving the product well, and only move files when the new structure is clearly simpler.

## Change Workflow

For any non-trivial task:

1. State the problem in one or two sentences.
2. Define the acceptance criteria before coding.
3. Identify the smallest slice that delivers user value.
4. Change the minimum number of files needed.
5. Verify behavior with the appropriate checks.
6. Remove dead code created by the change.
7. Record any follow-up work as an explicit, scoped decision.

## Implementation Standards

1. Prefer explicit code over clever code.
2. Prefer existing patterns over one-off inventions.
3. Prefer composition over branching conditionals.
4. Prefer direct data flow over hidden coupling.
5. Prefer typed boundaries at I/O edges.
6. Prefer visible errors over swallowed exceptions.
7. Prefer narrow interfaces over broad shared utilities.
8. For vendor-specific API or SDK work, reference the official vendor docs before changing behavior or policy (for example, Codex CLI docs and Claude SDK docs).
9. Distinguish tool-based integration from direct model API integration.
   For vendor-specific AI work, first confirm which layer this product is actually using:
   Claude Code, Codex CLI, app-server, MCP, SDK wrapper around a local tool, or direct provider HTTP API.
   Do not collapse those into the same thing.
10. Do not assume direct API auth when the product is built on a local tool or MCP path.
    If the app is meant to operate through Claude Code, Codex CLI, MCP servers, or an app-server protocol, do not treat `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or similar variables as the intended auth path unless the code is explicitly calling the provider API directly.
11. Before changing auth, connection, model routing, or provider error handling, verify the official vendor docs for the exact integration mode in use.
    Identify whether the failure is in local tool startup, CLI login/session, MCP transport, app-server protocol, SDK wrapper behavior, or direct API auth before proposing a fix.
12. Do not “fix” a tool-based integration by introducing direct API assumptions.
    Do not add direct API credentials, direct API messaging, or direct API fallback behavior unless that architectural change is explicit, approved, and reflected in the code.
13. When environment variables can override the intended tool-based path, treat that as an integration risk.
    Call it out explicitly and verify whether the app should sanitize, ignore, or narrowly control those variables to preserve the intended Claude Code, Codex, or MCP behavior.
14. Use precise language in code, tests, and explanations.
    Say “Claude Code auth/session,” “Codex app-server protocol,” or “MCP transport” when that is the real layer.
    Do not describe those failures as “Anthropic API” or “OpenAI API” failures unless the code is actually making direct provider API requests.
15. Never import Node.js APIs (`child_process`, `node:fs`, Agent SDK, `global`) from renderer code (`src/`). AI adapters, orchestrators, and services that need Node.js must live in `server/` and be reached via HTTP/WebSocket boundaries. If an HTTP/SSE endpoint remains, treat it as a transitional path and say so explicitly. Mocked unit tests cannot catch this — verify by running the app in the browser.

## Testing Standards

1. Tests should protect real behavior, not implementation trivia.
2. Broken tests are product work, not cleanup for later.
3. If behavior changes, tests should change with it.
4. If a check is flaky, either fix it or quarantine it explicitly.
5. Do not describe the repo as stable while checks are failing.

## Agent Behavior

Agents working in this repo should:

1. Make incremental changes.
2. Preserve user work they did not create.
3. Avoid broad refactors unless the task requires them.
4. Call out tradeoffs before making irreversible structural decisions.
5. Use the simplest change that keeps future work possible.
6. Leave the repo in a more truthful state than they found it.

Agents should not:

1. Introduce duplicate systems.
2. Hide uncertainty behind confident language.
3. Leave placeholder implementations in core flows.
4. Keep dead files “just in case.”
5. Expand scope without saying so.
6. Recommend another rebuild as the default answer to complexity.

## Definition Of Done

Work is done when:

1. The target behavior exists and is usable.
2. The change fits the architecture guardrails above.
3. Relevant tests and verification steps were run.
4. The code no longer depends on deprecated parallel paths.
5. Any remaining compromise is explicit and bounded.

## Final Standard

The repo should get simpler as it gets more capable.

If a change adds power but also adds confusion, it is not finished yet.
