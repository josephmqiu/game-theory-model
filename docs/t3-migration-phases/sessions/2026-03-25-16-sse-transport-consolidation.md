# 2026-03-25-16 SSE Transport Consolidation

```text
You are working in /Users/joe/Developer/game-theory-model.

Subagent instruction:
- Use subagents aggressively to conserve main-session context.
- Delegate repo exploration, architecture comparison, and other bounded
  read-heavy tasks whenever they can run in parallel.
- Keep the main session focused on synthesis, integration, decisions, and the
  critical-path implementation work.
- Do not delegate a task if the very next step is blocked on its result and it
  is faster to do locally.

Broader vision:
- Phase 8 introduced a typed WebSocket transport for the workspace runtime with
  reconnection, exponential backoff, per-channel latest-push caching, and
  structured diagnostics.
- Analysis streaming still uses the old SSE transport (EventSource at
  /api/ai/events) with no structured diagnostics and no migration path.
- Two parallel transport systems are active. This violates the architecture
  rule: no parallel systems without a removal plan.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-08-websocket-runtime-transport.md
- /Users/joe/Developer/game-theory-model/src/services/ai/workspace-runtime-client.ts (WebSocket client, 440 lines)
- /Users/joe/Developer/game-theory-model/src/services/ai/analysis-client.ts (SSE client, current analysis transport)
- /Users/joe/Developer/game-theory-model/server/api/ai/events.get.ts (SSE server endpoint)
- /Users/joe/Developer/game-theory-model/server/api/workspace/runtime.get.ts (WebSocket server endpoint)
- /Users/joe/Developer/game-theory-model/shared/types/workspace-runtime.ts (WebSocket contract types)

SSE consumers to migrate (6 files):
- src/components/editor/editor-layout.tsx
- src/components/panels/ai-chat-panel.tsx
- src/components/panels/entity-overlay-card.tsx
- src/services/ai/ai-service.ts
- src/services/ai/phase-activity-format.ts
- src/services/ai/__tests__/analysis-client.test.ts

SSE channels currently served by events.get.ts:
- mutation (entity and relationship changes)
- status (run status)
- progress (phase and synthesis events)
- ping (heartbeat, 30-second interval)

Problem:
- Migrate analysis event streaming from SSE to the existing WebSocket transport.
- Route mutation, status, and progress events through workspace-runtime push
  channels instead of a separate SSE endpoint.
- Remove the SSE endpoint and analysis-client.ts once migration is complete.
- Ensure all analysis events carry the same structured diagnostics that the
  workspace-runtime transport already provides.

Acceptance criteria:
- Analysis events (mutation, status, progress) flow through the workspace-
  runtime WebSocket as typed push channels.
- All 6 SSE consumer files are updated to receive analysis events from the
  WebSocket transport (via workspace-runtime-client or a thin adapter).
- The SSE endpoint (server/api/ai/events.get.ts) is removed.
- analysis-client.ts is removed (or reduced to a thin compatibility layer if
  a full removal is too disruptive in one session).
- Reconnection, backoff, and latest-push caching apply to analysis events
  the same way they already apply to workspace-runtime events.
- Analysis transport failures are observable through the same
  WorkspaceTransportDiagnostic system, not separate console logs.
- The smoke test (smoke-tests/sse.ts) and SSE contract test
  (server/__tests__/integration/sse-contract.test.ts) are removed or
  converted to WebSocket equivalents.

Scope:
- Server: Add analysis push channels to the workspace-runtime WebSocket
  endpoint. Remove the SSE endpoint.
- Client: Update analysis event consumers to subscribe to WebSocket push
  channels. Remove or replace analysis-client.ts.
- Shared types: Extend WorkspaceRuntimePushEnvelope with analysis channel types.
- Tests: Replace SSE contract tests with WebSocket equivalents.

Constraints and best practices:
- Do not change what analysis events contain, only how they are transported.
- Do not redesign the analysis event schema. Wrap existing event shapes in
  the WebSocket push envelope.
- Keep the migration vertical: move all events for one channel at a time
  (e.g., mutation first, then status, then progress) if that reduces risk.
- If a full removal of analysis-client.ts is too large, leave it as a thin
  facade over the WebSocket client with a clear removal TODO. But prefer
  full removal.
- Entity-graph-service's listener/broadcast pattern may need a small adapter
  to emit through the WebSocket push path instead of the SSE write path.
  Keep this adapter minimal.

Verification:
- Run `bun run typecheck`.
- Run `bun run test`.
- Run `bun run build`.
- Manually verify in `bun run dev` that analysis events stream correctly
  and canvas updates appear during a live analysis run.

Out of scope:
- Entity-graph-service SQLite migration.
- Runtime-status singleton refactoring.
- Chat prompt migration.
- AskUserQuestion UX.
- New event types or analysis pipeline changes.

Handoff:
- Summarize which SSE paths were removed and what replaced them.
- Note the new WebSocket push channel names and their event schemas.
- Note any diagnostics improvements from unifying on one transport.
- Call out any compatibility shims left in place and their removal plan.
- State exactly which checks were run.
```
