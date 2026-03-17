# Codebase Cleanup Plan — 2026-03-17

## Summary
- **Scope**: Main app audit across `src/`, `shared/`, `server/`, `electron/`, and `tests/`
- **Excluded**: Generated/output paths, `src/routeTree.gen.ts`, and dirty gitlink `openpencil-example`
- **Categories audited**: dependency hygiene, dead code, reliability, type safety, pattern drift, structural complexity
- **Shortlisted findings**: 16 (4 high, 8 medium, 4 low)
- **Proposed for cleanup**: 10 findings
- **Deferred**: 6 findings
- **Status**: Draft plan pending user approval before execution

## Proposed Cleanup Order

Changes are ordered from safest/highest-leverage cleanup to the more judgment-heavy items.

### 1. Dependency And Dead-Code Cleanup

| # | File | Line | Finding | Severity | Confidence | Action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `package.json` | 29-45 | Unreferenced UI-kit and utility packages (`@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-toggle`, `@radix-ui/react-tooltip`, `class-variance-authority`, `nanoid`) and empty `src/components/ui/` directory suggest stale dependencies from an older UI layer | HIGH | HIGH | Remove stale packages if lockfile/build remain clean |
| 2 | `package.json` | 38 | `@tanstack/router-plugin` appears unused in the current Vite/TanStack Start setup | MEDIUM | MEDIUM | Verify against build and remove if not required |
| 3 | `src/components/panels/ai-chat-panel.tsx` | 19 | `MessageBubble` is exported but never imported | LOW | HIGH | Remove dead export |
| 4 | `src/services/app-command-runner.ts` | 40 | `sendChatCommand` is exported but only used internally within the same module | LOW | HIGH | Narrow visibility or inline as private helper |
| 5 | `server/utils/safe-path.ts` | 73 | `resolveSafePath` is exported but only used by local read/write wrappers | LOW | HIGH | Narrow visibility to local helper |

### 2. Reliability And Error Visibility

| # | File | Line | Finding | Severity | Confidence | Action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/hooks/use-mcp-sync.ts` | 64-72 | Renderer-to-Nitro sync failures are swallowed silently, which can leave MCP state stale with no visible signal | HIGH | HIGH | Replace silent catch with intentional logging or surfaced sync error state |
| 2 | `server/api/ai/chat.ts` | 400-404 | Copilot client shutdown failures are swallowed in `finally` | LOW | HIGH | Route through shared best-effort cleanup helper or debug logging |
| 3 | `server/api/ai/connect-agent.post.ts` | 378-381 | Copilot cleanup on failure silently discards shutdown errors | LOW | HIGH | Use the same intentional cleanup helper/logging path |
| 4 | `server/utils/codex-client.ts` | 234-240 | Temp-directory cleanup ignores removal failures completely | LOW | HIGH | Use best-effort cleanup helper or debug logging |

### 3. Type-Safety Hardening

| # | File | Line | Finding | Severity | Confidence | Action |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `server/api/files/save.ts` | 60-64 | Persistence boundary casts shallowly-validated request data to `CanonicalStore` and `AnalysisFileMeta` before serialization | HIGH | HIGH | Strengthen validation/normalization before calling `storeToAnalysisFile` |
| 2 | `src/hooks/use-phase-progress.ts` | 18-20 | Hook casts canonical store to a generic nested record to satisfy phase-progress helpers | MEDIUM | HIGH | Tighten helper signatures so the hook can pass canonical state without an escape hatch |
| 3 | `shared/game-theory/tools/analysis-tools.ts` | 54-58 | Tool path repeats the same generic-record cast for phase progress computation | MEDIUM | HIGH | Share the same typed helper fix as above |
| 4 | `src/mcp/server.ts` | 197-304 | `createNitroBackedContext()` relies on broad `as unknown as RuntimeToolContext[...]` casts for two large adapter objects | MEDIUM | HIGH | Extract narrower typed adapters/helpers and remove broad interface escapes |

## Deferred Findings

These look real, but they are better treated as bug fixes or separate refactor work rather than first-pass cleanup.

| # | Category | File | Line | Finding | Reason Deferred |
| --- | --- | --- | --- | --- | --- |
| 1 | Pattern drift | `src/routes/settings.tsx` | 24 | Settings UI only renders `anthropic` and `openai`, while store and server layers also support `opencode` and `copilot` | User-visible behavior change; treat as bug fix / product decision, not conservative cleanup |
| 2 | Pattern drift | `src/services/agent-chat-handler.ts` | 4-7 | Chat system prompt is duplicated from `shared/game-theory/prompts/chat-system.md` | Needs shared browser-safe prompt-loading strategy rather than a quick cleanup edit |
| 3 | Structural complexity | `src/routes/editor/playouts.tsx` | 115 | `PlayoutsPage` is a 600+ line component mixing data derivation, mutations, and UI rendering | Higher-risk component decomposition; separate refactor pass |
| 4 | Structural complexity | `src/routes/editor/index.tsx` | 50 | `OverviewPage` is a 470-line component handling orchestration, summaries, and dashboard UI together | Higher-risk component decomposition; separate refactor pass |
| 5 | Structural complexity | `src/hooks/use-mcp-sync.ts` | 93 | `useMcpSync` is a 300+ line hook with nested SSE handling and repeated subscription logic | Better handled as a focused refactor after safe cleanup items |
| 6 | Structural complexity | `src/mcp/server.ts` | 183 | MCP server file mixes Nitro bridge, context adaptation, transport wiring, and HTTP session handling in one module | Separate architectural refactor, not first-pass cleanup |

## Recommended Execution Sequence

1. Remove stale dependencies and dead exports/private helpers.
2. Improve reliability around silent sync and cleanup failures.
3. Tighten low-risk type boundaries at save/phase-progress/MCP bridge edges.
4. Re-run `npx vitest run` and `npx tsc --noEmit` after each category.

## Approval Gate

This plan is ready for execution once approved. No application code has been changed yet.
