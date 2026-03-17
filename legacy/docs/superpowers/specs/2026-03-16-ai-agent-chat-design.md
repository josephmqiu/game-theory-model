# AI Agent Chat with Native Tool Use

## Problem

The 10-phase analysis pipeline runs pure TypeScript heuristics — keyword matching and template filling. No AI reasoning occurs. The phases produce structurally correct but substantively hollow output. "US vs China trade war" gets classified as domain "other" with actors "Primary Actor" and "Counterparty" because "US" is 2 characters.

The architecture has infrastructure for AI (prompt registry, PhaseExecution with token tracking, streaming chat endpoint) but the phase functions never call it.

## Solution

Embed an AI agent in the app's chat panel. The user types their analysis question, the app sends it to the AI API with the methodology as system prompt and tool definitions inline, and the agent reasons through the analysis by calling tools. As it calls `add_player`, `add_game`, `add_evidence`, the app's views update in real-time. The user can steer, interject, or ask questions mid-analysis through the same panel.

Reference implementation: OpenPencil's built-in chat (services/ai/ for orchestration, mcp/ for tools, src/components/ for the chat panel UI).

## Architecture

Three layers:

```
┌─────────────────────────────────────────────────┐
│  Chat Panel UI (React)                          │
│  User input → message stream → tool call timeline│
├─────────────────────────────────────────────────┤
│  Agent Loop (server/api/ai/agent.ts)            │
│  system prompt + tools + messages → provider    │
│  ← tool_use blocks → execute → tool_result →   │
│  ← text/thinking → stream to client             │
├─────────────────────────────────────────────────┤
│  Tool Executor (shared/game-theory/tools/)      │
│  Single tool registry, two consumers:           │
│  - In-app agent loop (direct function call)     │
│  - MCP server (protocol wrapper, external)      │
└─────────────────────────────────────────────────┘
```

### Design Decisions

**Native tool_use, not MCP for in-app chat.** The app is the API client — it constructs messages, sends them, gets responses. There's no external agent to connect to via MCP. The app receives a tool call in the response, executes it locally against its own stores, and sends the result back. This loop is the same whether talking to Anthropic (tool_use content blocks) or OpenAI (function calls). MCP is preserved for external agent access (Claude Code, etc.).

**Soft guidance, not hard phase gates.** The methodology is explicitly non-linear — "a directed graph with backward edges." Phase 4 discoveries routinely fire back to Phase 2 or 3. Hard gates linearize a methodology that's explicitly non-linear. Instead:

- _Soft guidance (prompt + UI):_ The app tracks progress and surfaces it. "You've created 3 players but haven't added any evidence yet." The AI sees this via `get_analysis_status`, the user sees it in the UI, but nobody is blocked.
- _Hard gates (computational preconditions only):_ `run_solver` fails if payoffs are incomplete. `compute_equilibrium` fails if no formalizations exist. These aren't phase opinions — they're data integrity. Discipline comes from the methodology prompt, not locked drawers.

**Prompts as .md files, not inline code.** System prompts, phase methodology text, and tool descriptions live as markdown files in the repo. This keeps them flexible for eval, experiments, and editing — we won't get them perfect the first try.

---

## 1. System Prompt Strategy

### Condensed system prompt (~1,500 words)

Stored as `shared/game-theory/prompts/system.md`. Contains:

- The core principle (facts first, players second, baseline third, history fourth, formalization fifth, predictions last)
- Phase structure (10 phases, one sentence each describing purpose)
- Key failure modes to avoid (premature formalization, complexity inflation, monolithic players, cheap-talk absolutism, etc.)
- Tool usage patterns: call `get_analysis_status` before advancing phases, always trace evidence to sources, propose revisions rather than silently overwriting
- The recursive loop trigger table (what discovery → which phase to revisit)
- Output format guidance (be specific, use numbers, cite evidence)

### Full methodology available via tool

```
get_methodology_phase(phase: number) → full playbook text for that phase
```

Returns the detailed instructions for the requested phase (e.g., all of Phase 2's sub-sections 2a-2c). The agent calls this when it enters a new phase or needs to refresh on specific guidance.

Phase methodology text stored as individual files: `shared/game-theory/prompts/phases/phase-1.md` through `phase-10.md`. Sourced from the playbook document.

**Granularity note:** Phase 3 alone has sub-sections 3a through 3i. For v1, `get_methodology_phase(3)` returns all sub-sections. If context pressure becomes an issue, a future `get_methodology_section("3e")` can return just the escalation ladder section. Flag for v2.

### Tool descriptions as .md files

Each tool's description field is loaded from `shared/game-theory/prompts/tools/<tool-name>.md` at startup. This allows editing tool guidance without touching code.

---

## 2. Conversation State Management

### Provider-managed compaction

Both Anthropic and OpenAI offer server-side compaction:

- **Anthropic:** Add `compact_20260112` to `context_management.edits` in the Messages API request. The API automatically summarizes the conversation when it approaches a configured token threshold.
- **OpenAI:** Set `context_management` with `compact_threshold` in the Responses API request. The server runs compaction when the rendered token count crosses the threshold.

The app sends the full conversation history every time. The provider prunes it.

### Handle compaction events in the stream

- Anthropic returns a compaction block in the response
- OpenAI returns a compaction output item

The provider adapter surfaces these as `{ type: 'compaction' }` events. The agent loop logs them but takes no action — the provider has already handled the pruning.

### Re-orientation via `get_analysis_status`

Provider compaction keeps context focused but produces a generic summary. It won't capture domain-specific state (which games exist, which phases are validated, which assumptions are flagged). The system prompt instructs the agent to call `get_analysis_status` after a compaction event to reload structured awareness.

---

## 3. Streaming Event Protocol

The agent loop emits typed events to the client via SSE:

```typescript
type AgentEvent =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "tool_result"; id: string; result: unknown; duration_ms: number }
  | { type: "status"; analysis_status: AnalysisStatus }
  | { type: "compaction"; summary: string }
  | { type: "error"; content: string }
  | { type: "done"; content: string }
  | { type: "ping"; content: string };
```

**Phase transitions are not an event type.** The agent can only produce text and tool calls through the provider API — it cannot emit custom event types. Phase progress is derived from entity existence via `get_analysis_status`. The UI polls or subscribes to status changes from tool_result events (each entity mutation implicitly advances phase progress). This is consistent with the "soft guidance" decision — phases are inferred, not declared.

### Chat panel rendering

| Event                       | UI rendering                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `text` / `thinking`         | Streaming markdown. Thinking in collapsible block.                                                                                      |
| `tool_call` + `tool_result` | Collapsible timeline entry: tool name, input summary, duration, result summary (e.g., "Created player: United States (primary, state)") |
| `status`                    | Phase checklist refresh (emitted after `get_analysis_status` tool calls)                                                                |
| `compaction`                | Subtle indicator in chat ("Context compacted")                                                                                          |
| `error`                     | Error banner in chat                                                                                                                    |

### Agent loop lifecycle (one user turn)

```
Client sends user message via SSE request
    ↓
Server builds: system prompt + full history + tools + user message
    ↓
Server calls provider API (streaming)
    ↓
┌─ Provider streams response ──────────────────────┐
│  text chunk → emit { type: 'text' } via SSE      │
│  thinking chunk → emit { type: 'thinking' }       │
│  tool_use block → emit { type: 'tool_call' }     │
│    ↓                                               │
│  Execute tool against stores (direct fn call)      │
│    ↓                                               │
│  emit { type: 'tool_result' }                     │
│    ↓                                               │
│  Append tool_result to messages                    │
│    ↓                                               │
│  Call provider API again (continue reasoning)      │
│    ↓                                               │
│  ... repeat until no more tool calls ...           │
└───────────────────────────────────────────────────┘
    ↓
emit { type: 'done' }
```

Multi-turn loop within a single HTTP request. The server keeps calling the provider until the AI produces a final text response with no tool calls. Each iteration streams events to the client.

### Runaway protection

A full analysis could mean 50+ tool calls in a single user turn — potentially minutes of streaming. Safeguards:

- **`max_iterations` config:** Default 100. The agent loop stops after this many provider round-trips within a single user turn and emits a text message: "Pausing — reached iteration limit. Send another message to continue." Configurable per-session.
- **Client-side Stop button:** Sends an `AbortSignal` to the SSE connection. The server-side agent loop checks the signal between iterations and stops cleanly, emitting `{ type: 'done' }`. The partial work (entities already created via tool calls) is preserved — the command spine already committed them.
- **Inactivity timeout:** If the provider returns no text or tool calls for 60 seconds, the loop aborts with an error event.

---

## 4. Tool Registry

### Structure

Single source of truth in `shared/game-theory/tools/`:

```typescript
interface ToolDefinition {
  name: string;
  description: string; // Loaded from .md file
  inputSchema: JsonSchema;
  execute: (input: unknown, context: ToolContext) => ToolResult;
}

interface ToolContext {
  canonical: CanonicalStore;
  dispatch: (command: Command) => DispatchResult;
  getAnalysisState: () => AnalysisState | null;
  getDerivedState: () => DerivedState;
}

type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
```

### Two consumers

1. **In-app agent loop:** Calls `tool.execute(input, context)` directly. No protocol overhead.
2. **MCP server:** Wraps the same `ToolDefinition` objects with the MCP protocol for external agents (Claude Code, etc.).

### Tool catalog

**Research tools:**

| Tool         | Purpose                                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web_search` | Provider-native web search (see Section 5). Phase 1 situational grounding and Phase 4 historical research require the agent to find real facts — military deployments, economic data, political statements, timelines. Without this, the agent is a structured note-taker, not an analyst. |

Both Anthropic and OpenAI offer web search as a built-in tool that can be included in the API request. The provider adapter enables it via config — it is not a custom tool in the tool registry but a provider-native capability. The adapter maps provider-specific search result formats into a normalized shape the agent loop can handle.

**Evidence tools:**

| Tool              | Purpose                                                  |
| ----------------- | -------------------------------------------------------- |
| `add_source`      | Register an information source with quality rating       |
| `add_observation` | Record a specific data point from a source               |
| `add_claim`       | State a factual claim derived from observations          |
| `add_inference`   | Draw an inference from claims                            |
| `add_derivation`  | Link evidence chain (observation→claim, claim→inference) |

**Player tools:**

| Tool                       | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `add_player`               | Create a player with type, role, objectives, constraints |
| `update_player`            | Modify player attributes                                 |
| `add_player_objective`     | Add an objective to an existing player                   |
| `update_information_state` | Update what a player knows/doesn't know/believes         |

**Game tools:**

| Tool                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `add_game`              | Create a game with players, type, move order                    |
| `update_game`           | Modify game attributes                                          |
| `add_formalization`     | Add a formal representation (normal form, extensive form, etc.) |
| `add_escalation_ladder` | Add escalation rungs to a game                                  |
| `add_strategy`          | Add a strategy to a formalization                               |
| `set_payoff`            | Set a payoff cell value with confidence and rationale           |

**History tools:**

| Tool                             | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `add_repeated_game_entry`        | Record a historical interaction event                |
| `add_trust_assessment`           | Assess trust level between a player pair             |
| `add_dynamic_inconsistency_risk` | Flag a commitment durability risk                    |
| `add_repeated_game_pattern`      | Identify a pattern (tit-for-tat, grim trigger, etc.) |

**Assumption tools:**

| Tool                | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `add_assumption`    | Make an assumption explicit with sensitivity rating             |
| `update_assumption` | Revise an assumption (sensitivity, evidence quality, statement) |
| `add_contradiction` | Flag a contradiction between entities                           |
| `add_latent_factor` | Identify a latent factor driving correlated assumptions         |

**Scenario tools:**

| Tool                        | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `add_scenario`              | Create a scenario with narrative, probability, model basis         |
| `update_scenario`           | Revise scenario probability, narrative, or invalidation conditions |
| `add_tail_risk`             | Add a low-probability, high-consequence event                      |
| `add_central_thesis`        | State the central analytical finding as a falsifiable claim        |
| `update_central_thesis`     | Revise thesis statement or falsification condition                 |
| `add_eliminated_outcome`    | Eliminate an implausible outcome with reasoning and citations      |
| `add_signal_classification` | Classify a signal as cheap talk, costly signal, or audience cost   |

**History update tools:**

| Tool                       | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `update_trust_assessment`  | Revise trust level after new evidence       |
| `update_escalation_ladder` | Add/remove/reorder rungs after revalidation |

**Analysis tools:**

| Tool                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `get_analysis_status`   | Returns phase progress, coverage warnings, readiness indicators |
| `get_methodology_phase` | Returns detailed methodology for a specific phase               |
| `get_entity`            | Read a specific entity by type and ID                           |
| `list_entities`         | List all entities of a given type                               |
| `run_solver`            | Run equilibrium solver on a formalization                       |

**Workflow tools:**

| Tool                        | Purpose                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `propose_revision`          | Propose a change to an existing entity with rationale (visible to user for review). Returns a proposal ID. The UI shows the proposal to the user. On user approval, the proposal auto-applies via the command spine — no separate update tool call needed. On rejection, the agent receives the rejection and can adjust. |
| `check_disruption_triggers` | Returns which upstream phases need revalidation based on current state changes. This is Phase 5 as a tool — the agent can call it at any point to check whether its recent work has invalidated upstream conclusions.                                                                                                     |
| `add_cross_game_link`       | Link two games with trigger, effect type, magnitude                                                                                                                                                                                                                                                                       |

**Note on update vs propose_revision:** Direct `update_*` tools exist for the agent to revise its own work (e.g., adjusting a trust assessment it just created). `propose_revision` is for changes to entities the user may have reviewed or accepted — it surfaces the change for approval rather than silently overwriting. The system prompt guides the agent on when to use each.

### Precondition gates

**Hard gates (computational/data integrity):**

| Tool                  | Precondition                                        | Rationale                     |
| --------------------- | --------------------------------------------------- | ----------------------------- |
| `run_solver`          | Formalization has complete payoffs and strategies   | Math requires complete inputs |
| `compute_equilibrium` | At least one formalization exists                   | Nothing to compute            |
| `set_payoff`          | Referenced formalization and strategy profile exist | Referential integrity         |

**Not gated (per methodology):**

| Tool                     | Why not gated                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_eliminated_outcome` | Can eliminate based on Phase 4 findings without formal games. "Trust infrastructure destroyed" eliminates negotiated settlement without requiring a game model. |
| `add_scenario`           | Agent may sketch scenario structure early, refine later.                                                                                                        |
| `add_assumption`         | Assumptions can be identified at any phase.                                                                                                                     |

---

## 5. Provider Abstraction

### Adapter interface

```typescript
interface ProviderAdapter {
  name: string;
  capabilities: {
    toolUse: boolean;
    webSearch: boolean;
    compaction: boolean;
  };

  formatRequest(params: {
    system: string;
    messages: NormalizedMessage[];
    tools: ToolDefinition[];
    contextManagement?: ContextManagementConfig;
    enableWebSearch?: boolean;
  }): ProviderRequest;

  parseStreamChunk(chunk: ProviderStreamChunk): AgentEvent[];

  formatToolResult(toolCallId: string, result: ToolResult): NormalizedMessage;
}
```

### Web search

Both Anthropic and OpenAI offer web search as a built-in tool included in the API request:

- **Anthropic:** Add `web_search` to the tools array. Results return as `tool_result` content blocks with citations.
- **OpenAI:** Add `web_search_preview` to the tools configuration. Results return as search result output items.

The provider adapter enables web search via the `enableWebSearch` flag. The agent loop handles search results the same as any tool result — they appear in the conversation history and stream to the client as `tool_result` events. The system prompt instructs the agent to use web search for Phase 1 grounding and Phase 4 historical research.

### Implementations

| Adapter            | Provider                          | Tool format                               | Web search           | Compaction config                                |
| ------------------ | --------------------------------- | ----------------------------------------- | -------------------- | ------------------------------------------------ |
| `AnthropicAdapter` | Anthropic Messages API            | `tool_use` / `tool_result` content blocks | `web_search` tool    | `context_management.edits: ['compact_20260112']` |
| `OpenAIAdapter`    | OpenAI Responses API              | `function` / `tool` message types         | `web_search_preview` | `context_management.compact_threshold`           |
| `GenericAdapter`   | Any provider without tool support | N/A — text-only                           | N/A                  | N/A                                              |

### Degraded mode (GenericAdapter)

When a provider doesn't support tool use, the agent loop skips the tool execution cycle. The AI can only converse about the analysis — it cannot create entities. The UI shows a warning: "Connected provider does not support tool use. The AI can discuss your analysis but cannot build the model. Switch to a provider with tool support for full functionality."

This is an explicitly degraded mode, not a different product.

---

## 6. Prompt File Structure

```
shared/game-theory/prompts/
├── system.md                          # Condensed system prompt (~1,500 words)
├── phases/
│   ├── phase-1.md                     # Full Phase 1 methodology
│   ├── phase-2.md                     # Full Phase 2 methodology
│   ├── ...
│   └── phase-10.md                    # Full Phase 10 methodology
└── tools/
    ├── add_player.md                  # Tool description for add_player
    ├── add_game.md                    # Tool description for add_game
    ├── get_analysis_status.md         # Tool description for get_analysis_status
    └── ...                            # One file per tool
```

Tool descriptions are loaded at server startup and injected into `ToolDefinition.description`. Methodology phase files are read on-demand when `get_methodology_phase` is called.

All prompt files are committed to the repo. Changes to prompts don't require code changes — just edit the .md file and restart.

**Hot-reload in dev mode:** The server watches prompt files and re-injects descriptions into the tool registry without restarting. This enables rapid iteration on tool descriptions and system prompt during development and eval sessions.

---

## 7. What Happens to Existing Code

### Heuristic phase functions (keep, demote)

The existing `runPhase1Grounding`, `runPhase2Players`, etc. remain as **fallback/offline mode**. They run when no AI provider is connected. The `runFullAnalysis` orchestrator loop continues to work as-is for offline scaffolding.

### Existing MCP tools (refactor)

The current MCP tools in `shared/game-theory/mcp-tools/` are refactored:

1. Extract tool logic into `shared/game-theory/tools/` as `ToolDefinition` objects
2. MCP server wraps those definitions with MCP protocol
3. Agent loop calls `execute()` directly

The MCP tools currently combine "run phase" with "create entities." The new tool registry separates these — the agent calls granular entity tools, not phase-level orchestrators.

### Command spine (unchanged)

All tools execute through the existing command spine: `dispatch(canonical, eventLog, command)`. This preserves undo/redo, event logging, integrity checks, and the proposal system.

### Prompt registry (repurposed)

The existing prompt registry tracks which prompt version was used for each phase execution. This continues to work — the agent loop records which system prompt and tool description versions were active during each session.

### Stores (minimal changes)

- `conversation-store` gains agent event storage (tool calls, tool results in message history)
- `ai-store` gains conversation state for the agent loop (messages array, streaming state)
- `pipeline-store` gains phase progress tracking based on entity existence rather than phase function execution

---

## 8. Chat Panel UI

### Layout

Floating panel (like OpenPencil's ⌘J panel):

- Resizable, draggable, corner-snapping
- Minimize to pill bar
- Model selector dropdown (grouped by provider)
- Text input with Enter to send, Shift+Enter for newline

### Message rendering

- **User messages:** Plain text with optional attachments
- **AI text:** Streaming markdown with cursor pulse
- **Thinking blocks:** Collapsible, muted styling
- **Tool calls:** Collapsible timeline entries with icon per tool category, tool name, input summary, duration badge, result summary
- **Phase transitions:** Highlighted divider with phase name
- **Errors:** Red banner with error text

### Phase progress sidebar

The analysis dashboard shows phase completion status derived from entity existence:

- Phase 1: complete when evidence entities exist across categories
- Phase 2: complete when players with objectives exist
- Phase 3: complete when at least one game with formalization exists
- ...etc.

This replaces the current `phase_states` tracking which was tied to heuristic function execution.

### Steering

The user can type mid-analysis to steer:

- "Focus more on the economic dimension"
- "You're missing the EU as a player"
- "That trust assessment seems too low, China honored the Phase One trade deal partially"

The agent sees these as new user messages and adjusts. The system prompt instructs the agent to acknowledge steering and explain how it changes the analysis.

---

## 9. Migration Path

### Phase 1: Tool registry + agent loop

- Create `shared/game-theory/tools/` with tool definitions (including `get_analysis_status`, `get_methodology_phase`, and all entity CRUD tools)
- Create `shared/game-theory/prompts/` with system prompt and phase methodology files
- Build the agent loop endpoint (`server/api/ai/agent.ts`) with runaway protection (max_iterations, abort signal, inactivity timeout)
- Build the provider adapter layer (Anthropic + OpenAI, with web search and compaction config)
- Wire tool execution to existing command spine
- `get_analysis_status` is included here because the system prompt and conversation state management both depend on it as the re-orientation mechanism — the agent loop won't work well without it

### Phase 2: Chat panel UI

- Build the floating chat panel component
- Implement agent event rendering (text, thinking, tool calls as collapsible timeline entries)
- Wire to the agent loop endpoint via SSE
- Add model selector and provider switching
- Add Stop button wired to AbortSignal

### Phase 3: Analysis views integration

- Update phase progress tracking to entity-based (derived from entity existence, not heuristic function execution)
- Wire entity mutations from tool execution to store updates (so views update in real-time)
- Add `propose_revision` UI flow (proposal appears in chat, user approves/rejects, auto-applies on approval)

### Phase 4: Polish + prompt tuning

- Write and iterate on system prompt (`shared/game-theory/prompts/system.md`)
- Write and iterate on tool descriptions (`shared/game-theory/prompts/tools/*.md`)
- Test with multiple providers (Anthropic, OpenAI, verify degraded mode)
- Add conversation state indicators (compaction events, re-orientation)
- Tune `max_iterations` and timeout configs based on real analysis sessions

---

## What stays unchanged

- Command/event spine with undo/redo
- Evidence ladder (Source → Observation → Claim → Inference → Assumption)
- EstimateValue with required confidence/rationale
- Canonical store structure and all entity types
- Cross-game link composition engine
- Assumption as first-class entity with sensitivity
- MCP server for external agent access
- Heuristic phase functions as offline fallback
- File format (.gta.json)
