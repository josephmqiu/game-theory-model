# 2026-03-25-01 Canonical Runtime Contract

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
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-contract.md
- /Users/joe/Developer/game-theory-model/docs/CURRENT-STATE.md
- /Users/joe/Developer/game-theory-model/server/services/ai/claude-adapter.ts
- /Users/joe/Developer/game-theory-model/server/services/ai/codex-adapter.ts
- /Users/joe/Developer/game-theory-model/server/services/runtime-status.ts
- /Users/joe/Developer/game-theory-model/shared/types/events.ts
- /Users/joe/Developer/game-theory-model/shared/types/analysis-runtime.ts

Important grounding note:
- `architecture-maturity-plan.md` is the newest convergence document.
- `CURRENT-STATE.md` and `architecture-contract.md` are still useful grounding,
  but parts may be stale where they reflect the older single-run design.
- If you find a real conflict, note it clearly in your final handoff instead of
  forcing the code to preserve the older shape by default.

Problem:
- Define the canonical runtime contract that the rest of the app will converge around.
- This session should create the stable vocabulary and type boundaries for:
  provider adapters, canonical runtime events, tagged errors, provider health
  state, model capability metadata, and canonical effort levels.
- Do not rewrite providers yet. The goal is to define the contract they will
  later conform to.

Acceptance criteria:
- There is a clear provider-neutral adapter interface in shared or server-owned
  types that can support Claude and Codex.
- Runtime events are expressed as typed discriminated unions rather than loose
  ad hoc shapes.
- Error types are tagged and distinguish validation, transport, provider,
  session, and process failures.
- Canonical effort levels are defined as `low | medium | high | max`, with room
  for provider-specific aliases behind capability mapping.
- Provider health state has a structured type rather than raw string status.
- Existing code is updated only as much as needed to compile against the new
  contract.

Scope:
- Add new types and boundary definitions.
- Add or update light unit tests for the new contracts.
- Add small documentation comments if needed to make the contract legible.

Constraints and best practices:
- Keep this session schema-setting, not implementation-heavy.
- Do not add SQLite, prompt-pack, WebSocket, or renderer state changes here.
- Do not leave duplicate competing contracts in place if you can migrate a small
  consumer cleanly in the same session.
- Prefer stable domain language over provider-specific names.

Verification:
- Run `bun run typecheck`.
- Run targeted tests for any new or changed type/runtime files.

Out of scope:
- Full adapter rewrites.
- Session resume.
- Prompt-pack extraction.
- Event store or transport changes.
- Settings UI changes.

Handoff:
- Summarize the new runtime contract.
- List the main provider/event/error/model capability files introduced or changed.
- Call out any places where current code still does not conform and should be
  addressed in the next session.
- State exactly which checks were run.
```
