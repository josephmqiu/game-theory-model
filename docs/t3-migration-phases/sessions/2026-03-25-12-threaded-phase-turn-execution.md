# 2026-03-25-12 Threaded Phase-Turn Execution

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
- Methodology phases should become durable phase-turns inside a thread, not
  isolated stateless requests.
- Prompt stuffing should be reduced in favor of graph-query tools plus compact
  phase briefs.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-11-prompt-pack-registry.md
- /Users/joe/Developer/game-theory-model/server/agents/analysis-agent.ts
- /Users/joe/Developer/game-theory-model/server/services/analysis-service.ts
- /Users/joe/Developer/game-theory-model/server/services/analysis-tools.ts
- /Users/joe/Developer/game-theory-model/server/services/ai/tool-surfaces.ts

Problem:
- Convert methodology execution from stateless phase requests into durable
  phase-turns inside an analysis thread.
- Externalize prompt packs onto disk.
- Replace most prior-context stuffing with graph-query tools and compact phase briefs.

Acceptance criteria:
- Phase execution is tied to thread/run/phase-turn identities.
- Prompt packs are resolved from on-disk or packaged prompt-pack sources rather
  than hardcoded phase constants.
- Prior context stuffing is materially reduced and replaced by tool-backed context access.
- The analysis still produces usable graph output and preserves methodology boundaries.

Scope:
- Phase execution flow.
- Prompt-pack externalization.
- Compact phase-brief builder.
- Tool policy wiring needed to support tool-backed context.

Constraints and best practices:
- Do not assume prompt stuffing disappears entirely; preserve compact phase briefs.
- Do not collapse methodology phases into one undifferentiated long chat.
- Do not import coding-agent plan semantics from T3.
- Preserve clear phase identity and done conditions.

Verification:
- Run `bun run typecheck`.
- Run targeted analysis pipeline tests and any integration tests affected.

Out of scope:
- Guided analysis UI.
- Pending-question UX.
- Rollback.
- Attachments.

Handoff:
- Summarize how analysis phases now execute as phase-turns.
- Note any prompt or tool-policy compromises left for future refinement.
- State exactly which checks were run.
```
