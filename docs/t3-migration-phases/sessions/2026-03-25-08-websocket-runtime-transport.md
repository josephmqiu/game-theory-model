# 2026-03-25-08 WebSocket Runtime Transport

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
- Long-lived thread and run state should move over one typed transport with
  snapshot bootstrap, reconnect, and latest-push caching.
- Transport should sit on top of real projections, not current singletons.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-05-event-store-and-projections.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-07-renderer-thread-projection.md
- /Users/joe/Developer/game-theory-model/server/api/ai/events.get.ts
- /Users/joe/Developer/game-theory-model/src/services/ai/analysis-client.ts

Problem:
- Add a typed WebSocket transport for runtime state and commands, with reconnect
  backoff, outbound request tracking, and latest-push caching by channel.
- Use the projection/read-model layer as the server source, not the old
  in-memory event stream as the long-term contract.
- Add transport diagnostics so reconnect loops, dropped pushes, request/response
  mismatches, and backoff behavior are explainable instead of opaque.

Acceptance criteria:
- A typed WebSocket contract exists for bootstrap, requests, and push events.
- The browser transport reconnects with exponential backoff.
- Latest push by channel can be replayed or reused on reconnect.
- A bounded migrated slice uses WebSocket successfully end-to-end.
- Transport failures and reconnect behavior are visible through structured
  diagnostics rather than only transient browser console output.

Scope:
- Server WebSocket endpoint and schemas.
- Browser transport client.
- Runtime bootstrap and push handling for a focused slice.
- Transport logging and reconnect diagnostics for the migrated slice.

Constraints and best practices:
- Keep transport concerns separate from business logic.
- Do not leave SSE and WebSocket as two long-lived equal transports without a
  clear transitional story.
- Do not migrate every consumer if a smaller end-to-end slice proves the path.
- Do not log every frame forever; prefer bounded diagnostics and latest-state visibility.

Verification:
- Run `bun run typecheck`.
- Run targeted transport tests and any integration tests affected.

Out of scope:
- Prompt-pack work.
- Session resume.
- Rollback.
- Settings UI.

Handoff:
- Summarize the new transport contract and migrated slice.
- Note what transport diagnostics now exist and how reconnect/debug behavior can be inspected.
- Note what still depends on SSE and whether it is intentionally transitional.
- State exactly which checks were run.
```
