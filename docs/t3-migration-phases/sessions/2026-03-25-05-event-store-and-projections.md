# 2026-03-25-05 Event Store And Projections

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
- Durable user-facing state should come from server-owned projections, not
  renderer-owned ad hoc state.
- Commands and domain events should become the audit source of truth.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-04-workspace-envelope-and-sqlite-foundation.md
- /Users/joe/Developer/game-theory-model/server/services/runtime-status.ts
- /Users/joe/Developer/game-theory-model/server/services/entity-graph-service.ts
- /Users/joe/Developer/game-theory-model/shared/types/events.ts

Problem:
- Add a durable event store for domain events and build projection tables/read
  models for thread state, run state, phase-turn summaries, and activity state.
- The goal is to stop treating current in-memory singletons as the long-term
  source of truth.
- Turn the event layer into a real audit trail with event ids, ordering, and
  causality metadata so failures and unexpected mutations can be reconstructed later.

Acceptance criteria:
- Domain events can be persisted with sequence ordering.
- Projection tables or equivalent read models exist for at least thread, run,
  and activity state.
- There is a clear boundary between the write side and read side.
- Current singleton services touched in this session are no longer the only
  truth for the migrated slice.
- The event store captures enough metadata to answer what happened, in what
  order, and what command or prior event caused it.

Scope:
- Event store schema and repository.
- Projection update pipeline for a bounded set of domain events.
- Read model query surfaces used later by renderer/bootstrap work.
- Event metadata fields needed for diagnostics, audit, and replay.

Constraints and best practices:
- Persist coarse domain events, not token deltas.
- Keep projection design boring and query-friendly.
- Do not rewrite the renderer in this session.
- Do not change transport yet.
- Favor queryable audit records over clever logging abstractions.

Verification:
- Run `bun run typecheck`.
- Run targeted tests for event append, projection updates, and read-model queries.

Out of scope:
- WebSocket transport.
- Full chat UI migration.
- Prompt-pack work.
- Rollback.

Handoff:
- Summarize the event store and projection model.
- Call out which audit questions the new event metadata can answer and which still require follow-up.
- List which read models are now authoritative.
- State exactly which checks were run.
```
