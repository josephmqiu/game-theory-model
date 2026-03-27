# 2026-03-25-07 Renderer Thread Projection

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
- Renderer state should be a projection for UI concerns, not the canonical owner
  of thread or message history.
- This session is the first user-visible validation of the durable thread model.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-06-server-thread-service-and-chat-contract.md
- /Users/joe/Developer/game-theory-model/src/stores/ai-store.ts
- /Users/joe/Developer/game-theory-model/src/components/panels/ai-chat-panel.tsx
- /Users/joe/Developer/game-theory-model/src/components/panels/ai-chat-handlers.ts

Problem:
- Replace `useAIStore.messages` and local chat title state as the source of
  truth with a renderer projection of server-owned threads.
- Ship the smallest usable thread UX: restore last active thread, list threads,
  create thread, rename or archive thread if feasible in one session.

Acceptance criteria:
- The chat panel can load and display server-owned thread history.
- The last active thread restores when a workspace opens.
- The renderer no longer treats local in-memory messages as the canonical history.
- Thread UI is functional enough to validate the model without over-designing it.

Scope:
- Renderer stores and selectors for thread projection.
- Minimal thread list and active-thread UX.
- Wiring chat panel to projected thread data.

Constraints and best practices:
- Keep the UI slice focused and boring.
- Do not redesign the whole chat panel.
- Do not add plan mode, approvals, or attachments here.
- Preserve the working product path while swapping the source of truth.

Verification:
- Run `bun run typecheck`.
- Run targeted UI/store tests for thread projection and active-thread restore.

Out of scope:
- WebSocket transport.
- Prompt packs.
- Run journaling.
- Approval or pending-question UX.

Handoff:
- Summarize how the renderer now projects thread state.
- Call out any remaining local-only chat state that still needs removal.
- State exactly which checks were run.
```
