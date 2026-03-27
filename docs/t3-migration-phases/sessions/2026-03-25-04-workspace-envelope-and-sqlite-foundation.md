# 2026-03-25-04 Workspace Envelope And SQLite Foundation

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
- We are converging on `workspace -> thread -> run -> phase-turn -> activity`.
- The workspace is the portable root; provider-session bindings remain local runtime state.
- The graph and canvas stay central to the product.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-03-command-bus-and-receipts.md
- /Users/joe/Developer/game-theory-model/src/services/analysis/analysis-file.ts
- /Users/joe/Developer/game-theory-model/src/services/analysis/analysis-persistence.ts
- /Users/joe/Developer/game-theory-model/electron/persistence.ts

Problem:
- Establish the persistence foundation for durable workspaces.
- Evolve `.gta` from “analysis + layout” into a workspace envelope that can
  later hold thread summaries, run summaries, artifacts, and checkpoint headers.
- Add the first SQLite schema/repository layer for workspaces, threads,
  messages, activities, runs, provider-session bindings, and command receipts.
- Make persistence and diagnostics boundaries explicit: portable workspace data,
  local runtime state, and local observability data should each have a clear home.

Acceptance criteria:
- A portable `workspace` envelope type exists and can load the current format
  with backward compatibility.
- SQLite foundation exists for the core durable nouns, even if not all tables
  are fully populated yet.
- Persistence boundaries are explicit: portable workspace state versus local
  runtime state.
- Log and diagnostics storage boundaries are explicit enough that future
  sessions do not stuff runtime logs into the portable workspace by accident.

Scope:
- Workspace envelope types and load/save migration path.
- Initial SQLite schema and repository boundaries.
- Tests for format compatibility and persistence initialization.
- Local runtime/log storage boundary decisions that unblock later observability work.

Constraints and best practices:
- Preserve load compatibility for existing `.gta` files.
- Do not try to persist full chat history into `.gta` in this session.
- Do not put provider-native session ids into the portable workspace.
- Keep the migration truthful and boring.
- Keep noisy diagnostics and runtime logs out of portable workspace files.

Verification:
- Run `bun run typecheck`.
- Run targeted persistence and file-format tests.

Out of scope:
- Full chat persistence UX.
- Event store and projections.
- Session resume.
- Prompt-pack extraction.

Handoff:
- Summarize the new workspace envelope and what it can store.
- Note where local runtime logs and audit data are expected to live after this slice.
- Note any migration compromises or temporary compatibility shims.
- State exactly which checks were run.
```
