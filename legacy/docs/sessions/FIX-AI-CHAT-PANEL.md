# Fix AI Chat Panel — Route Through CLI Tools

## Status: Ready for implementation

## Problem

The AI Chat panel (floating copilot) is broken for both providers:

1. **OpenAI / gpt-5.4**: "Provider 'openai' does not yet have a streaming client for the agent loop. Available: anthropic."
2. **Anthropic / Default**: "Could not resolve authentication method. Expected either apiKey or authToken to be set."

## Root Cause

The chat panel hits `POST /api/ai/agent` (`server/api/ai/agent.ts`), which uses a **direct Anthropic SDK client** (`new Anthropic()`) for streaming. This is architecturally wrong:

- **Anthropic**: `shared/game-theory/providers/anthropic-client.ts` creates `new Anthropic(apiKey)` — fails because the user authenticates via Claude Code OAuth, not API keys.
- **OpenAI**: `agent.ts` has no OpenAI streaming client at all (`// TODO` comment at line 51).

Meanwhile, `server/api/ai/chat.ts` already works perfectly with ALL 4 providers (Anthropic, OpenAI, OpenCode, Copilot) by routing through CLI tools:

- Anthropic → Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) → spawns Claude Code CLI
- OpenAI → Codex CLI subprocess (`server/utils/codex-client.ts`)
- OpenCode → OpenCode SDK client (`server/utils/opencode-client.ts`)
- Copilot → Copilot SDK (`@github/copilot-sdk`)

## Architecture Decision

After researching how OpenPencil, Zed, and other CLI-delegating apps handle this, the industry pattern is:

**"App IS the MCP server"** — The in-app chat is a lightweight text copilot routed through CLI tools. Structured tool calling happens when external CLI agents (claude, codex, etc.) connect to the app's MCP server.

This means:

- **In-app chat panel** → `chat.ts` → CLI tools → text streaming (no tool_use)
- **External CLI usage** → CLI tool connects to our MCP server → calls game-theory tools natively

OpenPencil confirms this: their floating chat is simple text, the real power is when Claude Code connects to their MCP server (~90 tools) and manipulates the design directly.

## What To Do

### Phase 1: Route chat panel through `chat.ts`

#### 1.1 Create a new client function for `chat.ts`

Create `src/services/chat-client.ts` — an SSE streaming client that hits `POST /api/ai/chat` instead of `/api/ai/agent`.

The `chat.ts` endpoint expects this body shape (see `server/api/ai/chat.ts` lines 16-28):

```typescript
{
  system: string        // system prompt (required, min 1 char)
  messages: Array<{
    role: "user" | "assistant"
    content: string     // (required, min 1 char)
  }>
  model?: string        // e.g. "claude-sonnet-4-6", "gpt-5.4"
  provider: "anthropic" | "openai" | "opencode" | "copilot"
}
```

It returns SSE with this chunk shape (see `shared/game-theory/types/ai-stream.ts`):

```typescript
type AIStreamChunk =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "error"; content: string }
  | { type: "done"; content: string }
  | { type: "ping"; content: string };
```

The new client should:

- POST to `/api/ai/chat`
- Parse SSE `data:` lines
- Yield events compatible with what `agent-chat-handler.ts` expects
- Handle abort signals the same way `agent-client.ts` does
- Include the same HTTP status error handling that was recently added to `agent-client.ts` (401, 429, 500+)

#### 1.2 Update `agent-chat-handler.ts`

Modify `src/services/agent-chat-handler.ts` to:

- Import the new `chat-client.ts` instead of `agent-client.ts`
- Build a system prompt for the chat (use the existing `loadSystemPrompt()` from `shared/game-theory/prompts/loader` or a simplified version)
- Map the message format: the chat handler currently sends `{ role, content }` strings which already matches what `chat.ts` expects
- Handle the simpler event types from `chat.ts` (`text`, `thinking`, `error`, `done`, `ping`) — no more `tool_call`, `tool_result`, `status`, `compaction` events

The handler currently processes these event types:

- `text` → accumulates content, updates last message ✅ (keep)
- `thinking` → accumulates thinking, updates last message ✅ (keep)
- `tool_call` → adds tool call to message ❌ (remove — chat.ts doesn't emit these)
- `tool_result` → updates tool result, replays commands ❌ (remove)
- `error` → sets error in store ✅ (keep)
- `status` → ignored ❌ (remove)
- `compaction` → appends compaction message ❌ (remove — chat.ts doesn't emit these)
- `done` → no-op ✅ (keep)

NOTE: The `compaction` case was recently added (shows "⟳ Context compacted" message). This event comes from `agent.ts` only. Since we're removing the agent.ts path, this case becomes dead code. Remove it cleanly.

Also: the `agent-client.ts` recently added HTTP status error handling (401 → "API key not configured", 429 → rate limit, 500+ → server error). Carry this over to the new chat client.

#### 1.3 Build the system prompt

`chat.ts` requires a `system` field. The current `agent.ts` loads this from `shared/game-theory/prompts/loader.ts` via `loadSystemPrompt()`.

For the chat panel, use the same system prompt or a simplified version. The system prompt should describe the app context (game theory analyzer) and the AI's role (analysis copilot). It does NOT need tool definitions since we're not doing tool calling.

Look at how `chat.ts` in the openpencil-example builds its system prompt for reference: `openpencil-example/server/api/ai/chat.ts`.

#### 1.4 Remove agent.ts dependencies from the chat flow

After switching, these are no longer used by the chat panel:

- `src/services/agent-client.ts` — the old `/api/ai/agent` SSE client (keep the file but it's now unused by chat)
- The `tool_call` / `tool_result` / `compaction` / `status` event handling in `agent-chat-handler.ts`

Do NOT delete `agent.ts` or `anthropic-client.ts` yet — they may be useful later if `createSdkMcpServer()` bug gets fixed. Just decouple the chat panel from them.

### Phase 2: Verify all 4 providers work

After Phase 1, test each provider through the chat panel:

1. **Anthropic** — Select "Anthropic / Default (recommended)" or a specific Claude model, send "hi". Should stream a response via Agent SDK.
2. **OpenAI** — Select an OpenAI model (e.g. gpt-5.4), send "hi". Should get a response via Codex CLI.
3. **OpenCode** — If installed, test similarly.
4. **Copilot** — If installed, test similarly.

For providers that aren't installed, the error should be clear ("CLI not found" etc.), not a cryptic auth error.

### Phase 3: Clean up dead code (optional, low priority)

These files/patterns become dead code for the chat panel flow:

- `shared/game-theory/providers/anthropic-client.ts` — direct `new Anthropic()` SDK client
- `shared/game-theory/providers/adapter-factory.ts` — provider adapter pattern (was for formatting raw API requests)
- `shared/game-theory/providers/anthropic-adapter.ts`, `openai-adapter.ts`, `generic-adapter.ts`
- `shared/game-theory/agent/loop.ts` — the server-side agent loop (tool execution loop)
- `shared/game-theory/agent/tool-context.ts` — server-side tool execution context
- `server/api/ai/agent.ts` — the agent endpoint itself

These are still used by the MCP server and external CLI tool integration, so check imports before removing. The tool definitions in `shared/game-theory/tools/` are still needed for the MCP server.

## Key Files to Modify

| File                                 | Action                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `src/services/chat-client.ts`        | **CREATE** — new SSE client for `/api/ai/chat`                                |
| `src/services/agent-chat-handler.ts` | **MODIFY** — use chat-client instead of agent-client, simplify event handling |
| `src/services/agent-client.ts`       | **NO CHANGE** — keep but it's now unused by chat panel                        |
| `server/api/ai/chat.ts`              | **NO CHANGE** — already works                                                 |
| `server/api/ai/agent.ts`             | **NO CHANGE** — keep but chat panel no longer uses it                         |

## Files for Context (read but don't modify)

- `server/api/ai/chat.ts` — the working endpoint with all 4 provider implementations
- `server/api/ai/agent.ts` — the broken endpoint, for understanding what we're replacing
- `shared/game-theory/types/ai-stream.ts` — the `AIStreamChunk` type used by `chat.ts`
- `src/stores/ai-store.ts` — the Zustand store the chat handler writes to
- `src/components/panels/ai-chat-panel.tsx` — the UI component (should need no changes)
- `openpencil-example/server/api/ai/chat.ts` — reference implementation

## Testing

Run existing tests after changes:

```bash
npx vitest run src/services/agent-chat-handler.test.ts
npx vitest run src/services/agent-client.test.ts
```

The agent-chat-handler tests mock `streamAgentChat` — they'll need updating to mock the new chat client function instead. The agent-client tests can remain as-is (testing the old client which still exists).

## Design Principles (from CLAUDE.md)

- **Immutable patterns** — always create new objects, never mutate
- **Domain code has zero UI deps** — `shared/game-theory/` is pure logic
- **Only the renderer promotes** — server returns data, renderer pushes through command spine
- **Error handling** — always handle errors comprehensively with user-friendly messages
