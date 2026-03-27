# 2026-03-25-17 Entity Graph Durability

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
- The T3 migration established SQLite-backed durable state for threads,
  messages, activities, runs, phase-turns, events, and command receipts.
- The entity graph (the core analytical data structure) is still an in-memory
  singleton in entity-graph-service.ts with module-level `let` variables.
- runtime-status.ts is also a module-level singleton mixing global state with
  per-run concerns.
- These are the last major singletons. Once they are projection-backed, all
  server-owned product state flows through the durable architecture.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-05-event-store-and-projections.md
- /Users/joe/Developer/game-theory-model/server/services/entity-graph-service.ts (module-level state: let analysis, listeners, _revision, _isDirty, _fileName, _filePath, _fileHandle)
- /Users/joe/Developer/game-theory-model/server/services/runtime-status.ts (module-level state: let activeRun, snapshot, revision, listeners, deferredStaleIds)
- /Users/joe/Developer/game-theory-model/server/services/workspace/workspace-db.ts (existing SQLite factory, 9 repositories)
- /Users/joe/Developer/game-theory-model/server/services/workspace/workspace-schema.ts (schema v5)
- /Users/joe/Developer/game-theory-model/server/services/workspace/domain-event-store.ts (event projection pipeline)

Entity-graph-service consumers (12 files):
- server/agents/analysis-agent.ts
- server/api/ai/entity.post.ts
- server/api/ai/events.get.ts
- server/api/ai/state.ts
- server/services/ai/chat-service.ts
- server/services/analysis-phase-brief.ts
- server/services/analysis-tools.ts
- server/services/canvas-service.ts
- server/services/command-handlers.ts
- server/services/revalidation-service.ts
- server/services/revision-diff.ts
- server/services/synthesis-service.ts

Runtime-status consumers (6 files):
- server/agents/analysis-agent.ts
- server/api/ai/dismiss.post.ts
- server/api/ai/events.get.ts
- server/api/ai/state.ts
- server/services/entity-graph-service.ts
- server/services/revalidation-service.ts

Problem:
- Migrate entity-graph-service from an in-memory module-level singleton to a
  SQLite-backed service scoped to the active workspace.
- Migrate runtime-status from module-level singleton state to workspace-scoped
  run state backed by the existing runs projection table.
- The infrastructure is ready: workspace-db.ts already manages 9 SQLite
  repositories, domain-event-store.ts already projects events to tables, and
  the command-bus already routes entity mutations with receipts.

Acceptance criteria:
- Entity graph state (entities and relationships) is persisted to SQLite and
  survives app restart.
- Entity-graph-service no longer uses module-level `let` variables as the
  source of truth. Either it reads from SQLite or it maintains an in-memory
  cache that is write-through to SQLite.
- Runtime-status no longer uses module-level singletons. Run state comes from
  the runs projection table, supplemented by ephemeral in-memory status for
  the currently active run.
- All 12 entity-graph-service consumers work against the new backing without
  behavioral change.
- All 6 runtime-status consumers work against the new backing without
  behavioral change.
- The .gta file format continues to work for import/export, but SQLite is the
  live runtime source of truth.
- Entity mutations still flow through the command bus and are observable
  through the existing event store.

Scope:
- New SQLite table(s) for entities and relationships (schema v6 migration).
- New repository for entity/relationship CRUD.
- Refactoring entity-graph-service to use the repository as backing store.
- Refactoring runtime-status to read from runs projection + ephemeral
  active-run state.
- Updating consumers if the service API changes.
- Domain event types for entity mutations if not already covered.

Constraints and best practices:
- Keep the entity-graph-service API surface as stable as possible. Consumers
  should see minimal changes.
- Prefer write-through cache over lazy-load if the entity graph is frequently
  read during analysis (it is — phase briefs and tools query it constantly).
- Do not change the .gta file format. It remains the portable export format.
- Do not collapse entity-graph-service and runtime-status into one service.
  They serve different concerns (graph data vs run lifecycle state).
- Keep the canvas rendering path fast. If SQLite reads add latency, keep the
  in-memory projection hot and write-through.
- The listener/broadcast pattern in entity-graph-service (for SSE/WebSocket
  push) should continue to work. If SSE was already removed in session 16,
  adapt to the WebSocket push path.

Verification:
- Run `bun run typecheck`.
- Run `bun run test`.
- Run `bun run build`.
- Manually verify in `bun run dev`:
  - Start an analysis, close the app mid-run, reopen — entity graph should
    restore from SQLite.
  - Complete an analysis, close and reopen — all entities visible on canvas.

Out of scope:
- Transport changes (SSE vs WebSocket — handle in session 16).
- Prompt changes.
- AskUserQuestion UX.
- Thread management features (soft delete, checkpoints, rollback).
- Chat prompt registry.

Handoff:
- Summarize the new schema and repository.
- Explain the caching/write-through strategy chosen.
- Note how runtime-status now derives state.
- Call out any API changes to entity-graph-service or runtime-status that
  consumers needed to adapt to.
- State exactly which checks were run.
```
