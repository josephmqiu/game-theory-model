# 2026-03-25-11 Prompt-Pack Registry

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
- Prompt definitions should be versioned, selectable, and attributable to runs.
- Prompt packs are a product primitive, not scattered module constants.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-09-run-journal-and-phase-turn-records.md
- /Users/joe/Developer/game-theory-model/server/agents/phase-prompts.ts
- /Users/joe/Developer/game-theory-model/src/services/ai/ai-prompts.ts
- /Users/joe/Developer/game-theory-model/docs/game-theory-analytical-methodology.md

Problem:
- Introduce a prompt-pack registry and prompt resolution service.
- The service should be able to resolve prompt packs by analysis type and mode,
  attach stable ids/versions to runs and phase-turns, and prepare the path for
  on-disk prompt packs without requiring a full prompt migration yet.

Acceptance criteria:
- A prompt-pack type and resolution service exist.
- Runs and phase-turns can reference prompt-pack identity and version.
- Existing prompt callers no longer need to know where prompt text comes from.
- The design leaves room for user-editable on-disk prompt packs in the next session.

Scope:
- Prompt-pack registry types and loader/resolver.
- Updating current prompt callers to use the new resolution layer.
- Minimal tests for prompt-pack selection/versioning.

Constraints and best practices:
- Do not rewrite the methodology or prompt content beyond what this abstraction needs.
- Do not attempt the full on-disk migration yet if that would make this session too large.
- Keep the service boring and explicit.

Verification:
- Run `bun run typecheck`.
- Run targeted tests for prompt resolution and any affected analysis/chat prompt callers.

Out of scope:
- Full external prompt-pack files.
- Phase-turn execution redesign.
- Plan mode.
- Approval UX.

Handoff:
- Summarize the prompt-pack registry and how runs now reference prompt identity.
- Note what remains for the next session to externalize prompts fully.
- State exactly which checks were run.
```
