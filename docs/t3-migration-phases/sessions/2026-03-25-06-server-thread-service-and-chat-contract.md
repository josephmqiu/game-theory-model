# 2026-03-25-06 Server Thread Service And Chat Contract

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
- Chat should follow the same server-owned, renderer-projected architecture that
  analysis state already wants to follow.
- Durable threads should replace renderer-local message history and prompt stuffing.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-05-event-store-and-projections.md
- /Users/joe/Developer/game-theory-model/server/api/ai/chat.ts
- /Users/joe/Developer/game-theory-model/src/components/panels/ai-chat-handlers.ts
- /Users/joe/Developer/game-theory-model/src/stores/ai-store.ts
- /Users/joe/Developer/game-theory-model/src/services/ai/context-optimizer.ts

Problem:
- Introduce a canonical server-owned thread service and change chat to operate
  on `workspaceId/threadId` rather than renderer-local message arrays.
- Stop relying on “last user message + conversation history stuffed into system prompt”
  as the long-term chat model.

Acceptance criteria:
- There is a server thread service or equivalent domain boundary.
- `/api/ai/chat` can operate against a server-owned thread identity.
- Chat writes canonical messages and activities to durable state.
- The session leaves a clean compatibility path for the renderer while reducing
  dependence on renderer-local history.

Scope:
- Backend thread service.
- Chat request/response contract.
- Message and activity write path.

Constraints and best practices:
- Keep `message` and `activity` distinct.
- Do not solve renderer thread UX here.
- Do not try to complete session resume or attachments yet.
- If some prompt stuffing still remains temporarily, keep it bounded and clearly transitional.

Verification:
- Run `bun run typecheck`.
- Run targeted tests for chat request handling, message persistence, and thread writes.

Out of scope:
- Thread switcher UI.
- WebSocket transport.
- Prompt-pack extraction.
- Approval UX.

Handoff:
- Summarize the new chat contract and thread service.
- Note any temporary compatibility paths still feeding from `useAIStore`.
- State exactly which checks were run.
```
