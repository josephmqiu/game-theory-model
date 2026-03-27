# 2026-03-25-02 Provider Adapter Isolation

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
- We are borrowing runtime and persistence discipline from T3 Code, but this is
  not a coding-agent app and must not accumulate coding-specific complexity.
- Follow AGENTS.md strictly: one live product, no parallel systems without a
  removal plan, no broad rewrites, smallest useful slice first.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-01-canonical-runtime-contract.md
- /Users/joe/Developer/game-theory-model/server/services/ai/claude-adapter.ts
- /Users/joe/Developer/game-theory-model/server/services/ai/codex-adapter.ts
- /Users/joe/Developer/game-theory-model/server/config/analysis-runtime.ts
- /Users/joe/Developer/game-theory-model/electron/main.ts
- /Users/joe/Developer/game-theory-model/electron/auto-updater.ts

Important grounding note:
- Prefer the new runtime contract and maturity plan over older single-run assumptions.

Problem:
- Refactor Claude and Codex integrations to conform to the new provider-neutral
  adapter contract.
- Isolate provider lifecycle state per session or per thread where feasible,
  instead of relying on shared mutable globals.
- Add the baseline shell hardening that directly supports runtime correctness:
  deterministic child exit handling, bounded startup failure, and clean abort propagation.
- Add provider observability for this slice: provider-native logs, canonical
  adapter/runtime logs, and bounded stderr/stdout capture that helps explain
  provider startup, streaming, and failure behavior.

Acceptance criteria:
- Both providers expose the new contract or a thin compatibility layer that
  clearly points to the new contract.
- Shared mutable provider state is reduced or explicitly isolated behind one
  owned lifecycle object.
- Provider health checks exist and can report binary/auth/version readiness in a
  structured way.
- Shell/runtime failure handling is improved in a bounded way without starting a
  broad Electron rewrite.
- Provider lifecycle failures are observable through structured logs that do not
  depend on reading random console output after the fact.

Scope:
- Provider adapter internals.
- Provider health check service.
- Minimal Electron/main-process reliability changes that directly support
  provider lifecycle correctness.
- Provider-native and canonical runtime log plumbing for Claude and Codex.

Constraints and best practices:
- Keep renderer untouched unless a tiny compatibility update is required.
- Do not add persistence, receipts, event store, or prompt-pack work here.
- Do not widen provider scope beyond Claude and Codex.
- Do not leave old and new lifecycle paths running in parallel.
- Logging must be best-effort and must not become a new failure source in the
  provider path.

Verification:
- Run `bun run typecheck`.
- Run provider adapter tests and any runtime-status or Electron tests affected.

Out of scope:
- SQLite persistence.
- WebSocket transport.
- Thread model.
- Settings UI redesign.
- Prompt extraction.

Handoff:
- Summarize how provider lifecycle is now isolated.
- Describe where provider diagnostics now land and which failures they help explain.
- Call out any remaining singleton state and why it still exists.
- State exactly which checks were run.
```
