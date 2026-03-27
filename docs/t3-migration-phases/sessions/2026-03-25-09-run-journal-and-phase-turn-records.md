# 2026-03-25-09 Run Journal And Phase-Turn Records

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
- Analysis runs should be durable and auditable.
- `phase-turn` is the smallest durable execution unit, not an implicit detail
  inside a global run singleton.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-05-event-store-and-projections.md
- /Users/joe/Developer/game-theory-model/server/agents/analysis-agent.ts
- /Users/joe/Developer/game-theory-model/server/services/analysis-service.ts
- /Users/joe/Developer/game-theory-model/server/services/runtime-status.ts

Problem:
- Add persisted `run` and `phase-turn` records linked to threads.
- Record provider, model, effort, prompt identity, timestamps, statuses, and
  summaries while keeping the current live progress path working.
- Upgrade the existing run logging story so run and phase-turn diagnostics are
  correlated with durable ids instead of living as mostly isolated log files.

Acceptance criteria:
- Runs are durably recorded against threads.
- Phase-turns are durably recorded against runs.
- The recorded data is rich enough to support later resume, rollback, pending
  questions, and prompt provenance.
- The current analysis flow continues to function while writing the new records.
- Run journals and phase-turn records are rich enough to reconstruct which
  phase failed, what provider/model/prompt context was active, and what the
  last meaningful status was.

Scope:
- Run and phase-turn schema/repositories.
- Orchestrator write path for run/phase-turn lifecycle records.
- Read-model or query updates needed to inspect those records.
- Correlating existing AI run logs with durable run and phase-turn identities.

Constraints and best practices:
- Keep the methodology behavior the same in this session; do not convert phases
  into threaded turns yet.
- Store summaries and status transitions, not every token delta.
- Avoid UI churn unless a small inspection hook is needed.
- Preserve the useful parts of the current per-run logs while making them less isolated.

Verification:
- Run `bun run typecheck`.
- Run targeted analysis/orchestrator tests and any persistence tests affected.

Out of scope:
- Prompt-pack extraction.
- Phase-turn execution redesign.
- Rollback UI.
- Pending-question UX.

Handoff:
- Summarize the run and phase-turn record model.
- Note how run diagnostics now correlate with durable ids and what gaps still remain.
- Note what future sessions can now build on top of it.
- State exactly which checks were run.
```
