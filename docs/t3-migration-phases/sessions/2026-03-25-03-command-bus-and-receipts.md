# 2026-03-25-03 Command Bus And Receipts

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
- We are maturing Game Theory Analyzer from a single-run, singleton-oriented,
  prompt-stuffed app into a session-centric, provider-agnostic, durable
  analysis workspace.
- The target product model is `workspace -> thread -> run -> phase-turn -> activity`.
- The canvas and entity graph remain the primary analytical surface.
- Follow AGENTS.md strictly: one live product, no parallel systems without a
  removal plan, no broad rewrites, smallest useful slice first.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-01-canonical-runtime-contract.md
- /Users/joe/Developer/game-theory-model/server/services/entity-graph-service.ts
- /Users/joe/Developer/game-theory-model/server/services/runtime-status.ts
- /Users/joe/Developer/game-theory-model/server/api/ai/analyze.ts
- /Users/joe/Developer/game-theory-model/server/api/ai/chat.ts
- /Users/joe/Developer/game-theory-model/server/mcp/product-tools.ts

Problem:
- Introduce a canonical server-side command bus or command queue that serializes
  mutating operations and supports command receipts for idempotency.
- The goal is to stop letting graph mutations, run control, and future
  thread/run writes happen through unrelated ad hoc paths.
- Make commands observable: command ids, receipts, and causality metadata should
  make it possible to answer what was attempted, what ran, and what completed or failed.

Acceptance criteria:
- There is one clear server command path for mutating domain operations.
- Commands can carry ids or receipts for idempotency.
- Existing mutation paths touched in this session are routed through that path.
- The design leaves room for later persistence without hard-coding in-memory-only assumptions.
- Commands and receipts in the migrated slice are logged or recorded with enough
  metadata to support later audit and debugging work.

Scope:
- Backend command types and dispatch path.
- Receipt handling, even if receipts are in-memory for now.
- Routing a small but meaningful set of existing mutating operations through the new path.
- Command ids, command outcome logging, and basic causation/correlation metadata.

Constraints and best practices:
- Keep this session backend-only if possible.
- Do not add SQLite or event sourcing yet.
- Do not try to migrate every server write in one pass if that causes churn.
- Choose a representative vertical slice, then leave the rest clearly documented for follow-up.
- Prefer stable ids and explicit outcomes over vague success/failure console lines.

Verification:
- Run `bun run typecheck`.
- Run targeted backend tests for command dispatch, graph mutation, and run control behavior.

Out of scope:
- Projection tables.
- WebSocket transport.
- Full thread persistence.
- Prompt-pack work.

Handoff:
- Summarize the command path and receipt model.
- Note what command metadata is now available for diagnostics and what is still missing.
- List which existing writes now go through it and which still do not.
- State exactly which checks were run.
```
