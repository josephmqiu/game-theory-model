# 2026-03-25-18 AskUserQuestion Interactive Flow

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
- The T3 migration established durable threads, typed provider events, and a
  guided-analysis UX. One key interaction pattern from T3 was not adopted:
  the AskUserQuestion multi-question flow.
- In game-theory analysis, the AI should be able to pause execution to ask
  the user clarifying questions — about assumptions, about actor motivations,
  about scenario boundaries. This is not a coding-agent "approve tool call"
  pattern; it is an analytical consultation pattern.
- The Codex adapter already has partial plumbing for user input
  (requestUserInput / approveUserInput in codex-adapter.ts). This session
  makes it a complete, provider-neutral, user-facing feature.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/server/services/ai/adapter-contract.ts (provider event types)
- /Users/joe/Developer/game-theory-model/server/services/ai/codex-adapter.ts (existing requestUserInput plumbing)
- /Users/joe/Developer/game-theory-model/server/services/ai/claude-adapter.ts
- /Users/joe/Developer/game-theory-model/shared/types/events.ts (ChatEvent discriminated union)
- /Users/joe/Developer/game-theory-model/src/components/panels/ai-chat-panel.tsx
- /Users/joe/Developer/game-theory-model/src/stores/thread-store.ts

T3 reference for this pattern:
- /Users/joe/Developer/t3code/packages/contracts/src/providerRuntime.ts
  (UserInputQuestion schema: id, header, question, options[], multiSelect)
  (Event types: "user-input.requested" | "user-input.resolved")

Problem:
- Implement a provider-neutral AskUserQuestion flow that allows the AI to
  pause during analysis or chat to ask the user one or more questions with
  optional predefined answer choices.
- The flow should:
  1. AI emits a question event with optional answer options.
  2. The question surfaces in the chat panel as a distinct interaction card
     (not a regular message).
  3. The user selects an option or types a free-text answer.
  4. The answer is sent back to the provider and the AI continues.
- This must work for both Claude and Codex providers.

Acceptance criteria:
- A provider-neutral UserInputQuestion type exists with: id, question text,
  optional header, optional options array, optional multiSelect flag.
- ChatEvent union includes "user_input_requested" and "user_input_resolved"
  event types.
- Both Claude and Codex adapters can emit user-input-requested events and
  receive resolutions.
- The chat panel renders pending questions as a distinct card component:
  - Shows the question text and header.
  - Renders options as clickable buttons (if provided).
  - Allows free-text input (always available as fallback).
  - Keyboard shortcuts for numbered options (1-9) if options exist.
- Answering a question sends the resolution back through the adapter and
  the AI turn continues.
- Questions and answers are persisted as activities (not messages) so they
  appear in the transcript but are distinct from conversation.
- Multiple sequential questions auto-advance (answering one reveals the next
  if the AI sent several).

Scope:
- Shared types: UserInputQuestion, user-input events in ChatEvent union.
- Server: Adapter support for emitting and resolving user input in both
  Claude and Codex adapters.
- Server: Activity recording for questions and answers.
- Client: Question card component with option buttons and free-text input.
- Client: Keyboard shortcut handling (1-9 for options).
- Client: Thread store integration for pending questions.
- Tests: Unit tests for question event flow and resolution.

Constraints and best practices:
- Keep this analysis-native. Questions should feel like an analyst asking for
  clarification, not a coding agent requesting file permissions.
- Do not require every tool call to go through approval. This is specifically
  for the AI's explicit "I need human input" signal.
- Keep the question card visually distinct from regular messages and from
  activity cards. It is an interaction state, not a log entry.
- If the provider does not support pausing for user input natively (Claude
  Agent SDK's current model is single-turn per query), implement a turn-
  boundary approach: the AI's turn ends with the question, and the user's
  answer starts the next turn with the question context prepended.
- Persist questions and answers to SQLite via the activity/event system so
  they survive restart.

Verification:
- Run `bun run typecheck`.
- Run `bun run test`.
- Run targeted tests for adapter event handling, question card rendering,
  and activity persistence.

Out of scope:
- Thread management features (soft delete, checkpoints, rollback).
- Plan mode enhancements.
- Settings UI changes.
- New provider integrations.
- Transport changes.

Handoff:
- Summarize the question flow end-to-end.
- Note how each provider handles the pause/resume pattern.
- Note the UI component and keyboard shortcuts added.
- Call out any provider limitations that constrain the flow.
- State exactly which checks were run.
```
