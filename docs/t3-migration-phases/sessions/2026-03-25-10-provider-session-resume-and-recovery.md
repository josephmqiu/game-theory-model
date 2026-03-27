# 2026-03-25-10 Provider Session Resume And Recovery

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
- App restart should not mean losing analytical continuity.
- Provider-native session identifiers belong in server-owned runtime state, not
  in the portable workspace.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-09-run-journal-and-phase-turn-records.md
- /Users/joe/Developer/game-theory-model/server/services/ai/claude-adapter.ts
- /Users/joe/Developer/game-theory-model/server/services/ai/codex-adapter.ts
- /Users/joe/Developer/game-theory-model/electron/main.ts

Problem:
- Persist provider-session bindings and implement resume-aware recovery for
  Claude and Codex.
- Define explicit fallback behavior when provider-native resume fails.
- Improve crash and restart behavior so it reconnects to durable thread/run
  state instead of simply restarting blind.
- Make crash, restart, resume, and fallback behavior diagnosable through clear
  recovery logs and state transitions.

Acceptance criteria:
- Provider-session bindings are persisted in local runtime state.
- There is a resume path for each provider or an explicit typed fallback.
- Restart behavior is aware of durable thread/run state.
- Failure modes are explicit and testable, not silent.
- Recovery attempts, resume failures, and fallback paths leave a clear
  diagnostic trail that can explain what the app tried to do.

Scope:
- Provider-session binding persistence.
- Resume/fallback logic in adapters or provider service.
- Focused shell/runtime recovery wiring.
- Recovery and restart diagnostics for the migrated slice.

Constraints and best practices:
- Keep portable workspace files free of provider-native runtime ids.
- Prefer explicit degraded behavior over fake resume.
- Do not redesign prompts or UI here.
- Do not expand provider surface beyond Claude and Codex.
- Log recovery decisions with enough detail to distinguish resume failure from
  shell crash, provider rejection, or missing local session state.

Verification:
- Run `bun run typecheck`.
- Run targeted provider adapter tests and any shell/runtime tests affected.

Out of scope:
- Prompt-pack registry.
- Phase-turn execution redesign.
- Approval UI.
- Attachments.

Handoff:
- Summarize the resume model and fallback behavior per provider.
- Describe what recovery logs now exist and how an operator can tell why resume succeeded or failed.
- Call out any provider limitations that remain.
- State exactly which checks were run.
```
