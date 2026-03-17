# AI Agent Chat — Phase 2: Chat Panel UI

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the floating chat panel that connects to the agent loop endpoint from Phase 1, renders streaming AI responses with collapsible tool call timeline entries, and lets the user steer the analysis mid-stream.

**Architecture:** A React floating panel component (like OpenPencil's ⌘J) connects to `POST /api/ai/agent` via SSE. It renders `AgentEvent` types as streaming markdown, thinking blocks, and tool call timeline entries. The ai-store (Zustand) manages conversation messages, streaming state, model selection, and panel UI state. A Stop button sends an AbortSignal to cancel the SSE connection.

**Tech Stack:** React 19, Zustand 5, Tailwind v4, lucide-react (icons), SSE client

**Spec:** `docs/superpowers/specs/2026-03-16-ai-agent-chat-design.md` — Sections 3 (Streaming Event Protocol), 8 (Chat Panel UI)

**Depends on:** Phase 1 complete (agent loop endpoint, tool registry, provider adapters)

**Reference implementation:** OpenPencil's `src/components/panels/ai-chat-panel.tsx` (780 lines), `src/components/panels/chat-message.tsx` (707 lines), `src/services/ai/ai-service.ts` (357 lines)

---

## Scope

### What to build

1. **AI store expansion** (`src/stores/ai-store.ts`) — Add conversation messages array, streaming state, abort controller, panel UI state (open/closed, corner position, minimized), model/provider selection with localStorage persistence

2. **SSE client** (`src/services/agent-client.ts`) — Connects to `/api/ai/agent`, parses SSE `data:` lines into `AgentEvent` objects, yields them as an async generator. Handles reconnection, abort, and timeout.

3. **Chat panel component** (`src/components/panels/agent-chat-panel.tsx`) — Floating, resizable, draggable panel with corner-snapping. Contains:
   - Message list (scrollable, auto-scroll on new content)
   - Text input (Enter to send, Shift+Enter for newline)
   - Model selector dropdown (grouped by provider)
   - Stop button (visible during streaming)
   - Minimize to pill bar

4. **Message renderer** (`src/components/panels/agent-chat-message.tsx`) — Renders each `AgentEvent` type:
   - `text` → streaming markdown with cursor pulse
   - `thinking` → collapsible block with muted styling
   - `tool_call` + `tool_result` → collapsible timeline entry with tool name, input summary, duration badge, result summary (e.g., "Created player: United States (primary, state)")
   - `error` → red banner
   - `compaction` → subtle "Context compacted" indicator
   - `status` → triggers phase progress refresh in sidebar

5. **Chat handler** (`src/services/agent-chat-handler.ts`) — Orchestrates the send flow:
   - Append user message to store
   - Add placeholder assistant message (streaming)
   - Call SSE client with current messages + provider config
   - Process events: update assistant message content, handle tool calls, update phase progress
   - On done/error: mark streaming complete

6. **Keyboard shortcut** — ⌘J toggles panel open/closed

### What NOT to build (deferred to Phase 3)

- Entity-based phase progress sidebar (Phase 3)
- propose_revision approval/rejection UI (Phase 3)
- Real-time view updates from tool execution (Phase 3)

### Key patterns from OpenPencil to follow

- **Panel state in localStorage** — corner position, minimized, model preference survive reload
- **Streaming indicator** — bouncing dots when streaming with no content, cursor pulse at end of partial text
- **Tool call rendering** — collapsible entries with icon, tool name, and one-line summary. Expand to see full input/output JSON
- **Auto-expand on stream start** — if panel is minimized and a response starts streaming, expand it
- **Chat history trimming** — the SSE client sends the full conversation history; the provider handles compaction server-side (configured in Phase 1 provider adapters)

### Key files to study before implementing

- `src/stores/ai-store.ts` — Current AI store (expand, don't replace)
- `src/stores/conversation-store.ts` — Existing conversation store (the agent chat is separate from the pipeline conversation; they coexist)
- `shared/game-theory/types/agent.ts` — AgentEvent type (from Phase 1)
- `server/api/ai/agent.ts` — Agent endpoint (from Phase 1)
- OpenPencil `src/components/panels/ai-chat-panel.tsx` — Reference for panel layout
- OpenPencil `src/components/panels/chat-message.tsx` — Reference for message rendering
- OpenPencil `src/stores/ai-store.ts` — Reference for store shape

### Task outline (to be expanded into full TDD steps)

1. Expand ai-store with conversation state + panel UI state
2. Build SSE client (async generator over EventSource)
3. Build chat handler (send flow orchestration)
4. Build message renderer component (text, thinking, tool calls)
5. Build chat panel shell (floating, resizable, input, model selector)
6. Wire ⌘J shortcut
7. Add Stop button with AbortSignal
8. Integration test: panel renders streaming events correctly
