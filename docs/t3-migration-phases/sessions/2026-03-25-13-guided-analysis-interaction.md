# 2026-03-25-13 Guided Analysis Interaction

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
- Once threads, runs, phase-turns, and prompt packs are durable, the product
  can finally surface the richer interaction model cleanly.
- This session should make the runtime legible to the user without turning the
  app into a coding-agent clone.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-12-threaded-phase-turn-execution.md
- /Users/joe/Developer/game-theory-model/src/components/shared/agent-settings-dialog.tsx
- /Users/joe/Developer/game-theory-model/src/components/panels/ai-chat-panel.tsx
- /Users/joe/Developer/game-theory-model/src/components/panels/chat-message.tsx

Problem:
- Add the higher-level guided-analysis UX now that the durable model exists.
- This session should include:
  - a better settings surface
  - per-thread model and effort defaults
  - analysis plan mode or plan artifacts
  - pending-question UX
  - selective approval UX
  - attachments as workspace assets
  - explicit checkpoints and rollback if the durable state underneath is ready
- Make diagnostics visible enough in the product that a user can tell what went
  wrong without reading raw log files for every problem.

Acceptance criteria:
- Messages and activities are visually distinct and readable.
- Pending questions and approvals surface as first-class interaction states, not
  buried transcript noise.
- Plan artifacts can be created and used to spawn or guide follow-up threads.
- Settings are managed through a more durable, validated surface.
- Attachments persist as workspace assets if implemented in this session.
- Checkpoint/rollback behavior is explicit and trustworthy if implemented here.
- If this session surfaces diagnostics, they are legible and tied to real
  runtime/activity data rather than placeholder error text.

Scope:
- UI and renderer projection work that sits on top of the durable backend model.
- Minimal backend additions needed to support approvals, questions, assets, or rollback.
- User-facing diagnostics affordances such as clearer error cards, activity history,
  or an "open logs" pathway if it fits cleanly.

Constraints and best practices:
- Keep approvals selective. Do not require approval for every graph mutation.
- Keep plans analysis-native. Do not copy coding handoff or implementation-thread semantics.
- Keep settings boring and product-specific.
- Prefer explaining real failure state over inventing generic reassurance copy.
- If this session proves too large, split it cleanly into:
  1. settings + plan mode
  2. pending questions + approvals + attachments + rollback

Verification:
- Run `bun run typecheck`.
- Run targeted UI/store tests and any backend tests affected.
- If the session touches end-to-end thread or run flows, run the most relevant
  integration checks available in-repo.

Out of scope:
- New provider integrations.
- Cloud sync or collaboration.
- Terminal, Git, PR, or worktree features from T3.

Handoff:
- Summarize the user-facing interaction improvements shipped.
- Note any diagnostics or error-visibility improvements included in the slice.
- Be explicit about any parts of this session that had to be deferred or split.
- State exactly which checks were run.
```
