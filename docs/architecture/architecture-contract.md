# Architecture Contract

Date: 2026-03-26
Revision: 5
Status: Canonical architectural design for the Game Theory Analyzer

This document defines the target architecture from first principles. It
describes boundaries, contracts, and decisions — not migration steps.
Existing code may not match this contract. Where it diverges, this document
is the target.

---

## System Overview

A locally-deployed desktop app where AI conducts structured game-theoretic
analysis of real-world events. Data stays on the user's machine. Core
analytical functions require internet (AI model access, web research).

The system has five layers. Each layer depends on layers below it. One
controlled exception exists: the chat agent can invoke the analysis agent
through the tool layer (see Agent Relationship below).

```
Layer 5: API Surface         (HTTP + WebSocket endpoints — thin wiring)
Layer 4: AI Agents           (Analysis Agent, Chat Agent — workflow orchestration)
Layer 3: MCP Tool Layer      (entity CRUD, analysis control, research — tool wrappers)
Layer 2: Product Services    (Entity Graph, Layout Engine, Persistence — domain logic)
Layer 1: AI Connectors       (Claude, Codex — transport to AI models)
```

The frontend is a separate process (browser/renderer). It communicates with
the backend via HTTP (REST endpoints) and WebSocket (workspace runtime
transport for real-time state sync, streaming events, and bidirectional
commands). Live chat streaming uses the workspace runtime WebSocket.
The frontend never imports backend code.

---

## Layer 1: AI Connectors

A connector wraps a specific AI provider's SDK. It knows nothing about
game theory, entities, or the methodology. Each connector is a separate
implementation with its own capabilities and constraints — they are NOT
assumed to be equivalent.

### Claude Connector

Wraps the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).

**SDK capabilities (per vendor docs):**

- `query()` function with async iterator for streaming events.
- Agent loop managed by the SDK — multi-turn tool use is automatic.
- Structured output via `outputFormat: { type: "json_schema", schema }`.
  The AI can use tools across multiple turns AND return structured JSON
  as the final result. Tools and structured output coexist in one call.
- Custom MCP tools via `mcpServers` option with `createSdkMcpServer`.
  Tool access controlled via `allowedTools` whitelist.
- Built-in tools include `WebSearch` (enabled via `allowedTools`).
- `maxTurns` controls agent loop iteration limit.
- `includePartialMessages: true` enables streaming of text deltas,
  tool calls, and thinking events.
- Session management: each `query()` call spawns an internal session.
  No persistent thread concept — each call is independent.

**How this app uses it:**

- Analysis mode: `query()` with `mcpServers` (entity CRUD tools +
  WebSearch + phase control tools), `allowedTools` whitelist,
  `includePartialMessages: true`. `maxTurns` set high enough for
  multi-step research and incremental entity creation (10-15,
  configurable). The AI creates entities one-by-one via tool calls
  (`create_entity`, `update_entity`, `create_relationship`,
  `complete_phase`) with per-call Zod validation. No `outputFormat` —
  analysis phases use tool-based entity creation, not structured output.
- Chat mode: `query()` with `mcpServers` (full product + analysis control
  tools), `allowedTools`, `includePartialMessages: true`. Streams
  text and tool side effects. Chat synthesis uses structured output
  (`runStructuredTurn`) for final response formatting.

### Codex Connector

Wraps the Codex CLI app-server via JSON-RPC 2.0 over stdio.

**SDK capabilities (per codex-cli 0.116.0 protocol, live-verified):**

- `thread/start` creates a persistent conversation thread with config
  (model, cwd, approvalPolicy, sandbox, personality).
- `turn/start` sends a prompt and receives streaming notifications
  (`item/started`, `item/completed`, `turn/completed`).
- `turn/start` supports `outputSchema` — **Codex has native structured
  output.** Both connectors can enforce output schemas natively.
- Tool registration via MCP: product tools are registered through
  `~/.codex/config.toml` MCP server entries and `config/mcpServer/reload`.
  This is persistent config management, not in-memory registration.
  `dynamicTools` on `thread/start` is not part of the public API —
  this app standardizes on MCP for Codex tool access.
- `mcpServerStatus/list` checks MCP server connection state.
- Approval policy: `untrusted | on-failure | on-request | never`
  (plus granular per-tool overrides).
- Sandbox modes control file system access.
- Thread persistence — conversation history survives across turns.
  Threads can be resumed (`thread/resume`) and forked (`thread/fork`).
- Web search is a native model capability, NOT an MCP tool. Enabled
  via `--search` flag or `web_search` config field.

**How this app uses it:**

- Analysis mode: register an MCP server (entity CRUD + phase control
  tools) via `config.toml` + `config/mcpServer/reload` before the
  analysis thread starts. Send phase prompt via `turn/start`. The AI
  creates entities incrementally via MCP tool calls (`create_entity`,
  `update_entity`, `create_relationship`, `complete_phase`). No
  `outputSchema` — analysis phases use tool-based entity creation, not
  structured output. On analysis completion, reload the full CRUD MCP
  server for chat mode.
- Chat mode: `turn/start` with streaming. MCP tools (full CRUD +
  analysis control) available via config registration. Streaming
  follows the item lifecycle: `item/started` → deltas → `item/completed`.
  Text streams via `item/agentMessage/delta`. MCP tool activity
  reported via `mcp/toolCall/progress`. Web search activity via
  `item/started` with `webSearch` item type.

### Key differences between connectors

| Capability        | Claude                       | Codex                                   |
| ----------------- | ---------------------------- | --------------------------------------- |
| Structured output | Native (`outputFormat`)      | Native (`outputSchema`)                 |
| Analysis mode     | Tool-based entity creation   | Tool-based entity creation              |
| Tool registration | In-memory MCP servers        | Persistent config + reload              |
| Session model     | Stateless (per-query)        | Persistent threads                      |
| Web search        | MCP-style (`WebSearch` tool) | Native model capability                 |
| Process model     | SDK spawns internal session  | Persistent subprocess                   |
| Approval workflow | `permissionMode`             | `untrusted/on-failure/on-request/never` |

The agent layer accounts for these differences:

- **Tool registration:** Claude uses in-memory MCP server objects;
  Codex uses config.toml entries + `config/mcpServer/reload`. The agent
  layer owns the translation from tool definitions to provider format.
- **Analysis/chat tool isolation:** Claude filters via `allowedTools`
  per query (in-memory, instant). Codex requires swapping MCP server
  config and reloading between analysis and chat modes (persistent,
  requires reload round-trip).
- **Session model:** Codex thread persistence means the chat agent can
  maintain richer conversation context across turns. Claude chat
  sessions are stateless — context must be provided in each call.
- **Web search:** Claude adds `WebSearch` to `allowedTools`; Codex
  sets the `web_search` config field.
- **Streaming events:** Claude uses `stream_event` with content block
  deltas. Codex uses `item/agentMessage/delta` for text,
  `mcp/toolCall/progress` for tool activity, and the `item/started` →
  `item/completed` lifecycle for all item types.

### Connector rules

1. Connectors do not import entity types, methodology types, or product
   services.
2. Connectors accept tool definitions in their provider-specific format.
   The agent layer owns the translation from generic tool definitions
   into provider-specific format (MCP server objects for Claude,
   config.toml entries for Codex).
3. Connectors translate provider-specific events into normalized event
   types. The agent layer never sees raw SDK events.
4. When the connector receives a tool call from the AI, it delegates
   execution to the registered tool handlers (provided by the agent).
5. Each connector is responsible for its own lifecycle (subprocess
   management for Codex, session cleanup for Claude).

---

## Layer 2: Product Services

These know the domain but nothing about AI. They have zero AI connector
imports.

### Entity Graph Service

The canonical store for all analytical entities and relationships.

Responsibilities:

- Entity CRUD with Zod schema validation per entity type. Validation runs
  on every create and update — no unvalidated writes.
- Relationship CRUD with type constraints.
- Provenance tracking (who created/modified, when, why, chained history).
  The `source` field on entities is set server-side based on caller
  context, never accepted as input from tool calls.
- Run-scoped provenance: each analysis run has a `runId`. Entities
  created during a run carry the `runId` in provenance for retry
  tracking, revision diffing, and cleanup.
- Staleness propagation (edit an entity → downstream dependents marked
  stale via relationship graph traversal).
- Mutation event emission (entity_created, entity_updated, entity_deleted,
  relationship_created, relationship_deleted, stale_marked).

Does not contain:

- AI prompts or model configuration
- Phase sequencing logic
- Retry or timeout logic
- Position or layout data

### Layout Engine

Computes canvas positions from entity graph structure.

- Takes entities and relationships as input, produces positions per entity
- Entities do NOT store position in their schema — position is a view
  concern. Some entity types carry analytical ordering (e.g.,
  escalation-rung has an `order` field in its data), which is distinct
  from canvas position.
- Layout runs after entity graph changes (debounced)
- Respects pinned positions (user overrides stored in the layout state,
  not on the entity)

### Persistence Service

Saves and loads analysis files (.gta format).

- Serializes both the entity graph AND layout positions
- .gta file structure: `{ analysis: Analysis, layout: LayoutState }`
- Layout state: `Record<entityId, { x: number, y: number, pinned: boolean }>`
  where `pinned: true` = user-positioned (layout engine must not move),
  `pinned: false` = engine-computed (can be recomputed on graph changes)
- On load: renderer applies stored positions, pinned flags preserved
- On save: renderer captures current positions from view state

---

## Layer 3: MCP Tool Layer

Thin wrappers that expose Layer 2 services as tools the AI can call.
Tools are stateless and agent-agnostic.

### Tool surface split by agent mode

**Analysis mode (read + write + signals):**

```
get_entity(id)                                            → entity
query_entities(filters: { phase?, type?, stale? })        → entity[]
query_relationships(filters: { entityId?, type? })        → relationship[]
create_entity(type, phase, data, confidence, rationale)   → entity
update_entity(id, updates)                                → entity
delete_entity(id)                                         → confirmation
create_relationship(type, fromId, toId, metadata?)        → relationship
request_loopback(trigger_type, justification)             → accepted/queued
```

Web search is provided as a built-in capability of both providers
(not an MCP tool in this list).

Analysis mode uses CQRS tool calls for entity mutations. Each tool call
is an individual command processed through the orchestration engine with
rollback support. This replaces the earlier batch structured-output model.
Rollback is handled per-phase via the analysis.rollback command, which
removes entities created after a given phase checkpoint.

**Chat mode (full CRUD + control):**

All analysis mode tools, plus:

```
create_entity(type, phase, data, confidence, rationale)  → entity
update_entity(id, updates)                                → entity
delete_entity(id)                                         → void
create_relationship(type, fromId, toId, metadata?)        → relationship
delete_relationship(id)                                   → void
start_analysis(topic)                                     → runId
rerun_phases(phases)                                      → runId
get_analysis_status()                                     → status
abort_analysis()                                          → void
```

### request_loopback — constrained triggers

The `request_loopback` tool does NOT accept arbitrary target phases. It
accepts a `trigger_type` from the methodology's defined disruption
triggers. The orchestrator maps trigger types to target phases:

| Trigger type              | Target phase |
| ------------------------- | ------------ |
| new_player                | Phase 2      |
| objective_changed         | Phase 2      |
| new_game                  | Phase 3      |
| game_reframed             | Phase 3      |
| repeated_dominates        | Phase 3      |
| new_cross_game_link       | Phase 3      |
| escalation_revision       | Phase 3      |
| institutional_change      | Phase 3      |
| assumption_invalidated    | Phase 7      |
| model_unexplained_fact    | Phase 3      |
| behavioral_overlay_change | Phase 6      |

Multiple triggers in one phase are batched — the orchestrator jumps to
the earliest target. This prevents the AI from owning methodology control
flow while still allowing it to signal discoveries.

### Tool rules

1. `source` is NOT a tool input. The entity graph service sets it
   server-side ("ai" for tool calls, "human" for user edits).
2. Tools validate domain constraints (e.g., a strategy must reference a
   valid game, relationship types are constrained by entity types).
3. Tools return structured results, never prose.
4. Tools do not manage conversation state or phase sequencing.
5. Tools call Layer 2 services directly — no intermediate abstraction.

---

## Layer 4: AI Agents

Two agents with different workflow patterns over the same capabilities.

### Analysis Agent

Automated, end-to-end. Runs the 10-phase analytical methodology.

**Trigger:** User provides a topic and starts analysis, or chat agent
triggers a rerun.

**Flow:**

1. Orchestrator selects the next phase to run.
2. Begins a phase transaction (tracks pending entity mutations).
3. Builds a phase-specific system prompt with methodology instructions
   and the available entity creation tools.
4. Calls the connector in analysis mode — entity CRUD tools + web
   search + phase control tools. `maxTurns` set high enough for
   multi-step research and incremental entity creation (10-15,
   configurable).
5. AI creates entities incrementally via tool calls during the turn:
   - `create_entity` / `update_entity` — each call validated
     individually via Zod schemas. Real-time progress events emitted
     per entity creation.
   - `create_relationship` — wires entities within the phase.
   - Web search and entity query tools for research context.
   - `complete_phase` — signals phase completion, triggers cross-entity
     validation (correct entity types, required relationships, minimum
     entity count, referential integrity).
6. If cross-entity validation passes: commit the phase transaction
   (all entities persisted atomically to the entity graph).
7. If validation fails or the turn errors: rollback the phase
   transaction (no partial state). Retry the phase (new attempt).
8. Between phases: check for disruption triggers (from `request_loopback`
   calls during the phase) and staleness. Handle loopbacks before
   advancing.
9. After all phases complete (or on terminal failure): emit
   analysis_completed/analysis_failed.

**Composite entity types for complex phases:**

Phases that produce compound analytical structures (Phase 6: payoff
matrices, game trees, cross-game constraint tables) use composite entity
types. A "payoff-matrix" entity contains the full matrix as structured
data within its `data` field, not decomposed into individual cell
entities. This keeps tool call count manageable and preserves structural
integrity.

**What the analysis agent does and does not own:**

- It builds the entity graph — researching, reasoning, creating entities
  and relationships. The graph IS the analysis.
- It does not decide canvas layout or pixel coordinates.
- It does not interact with the user during a run. Progress is visible
  but the user does not converse with the analysis agent mid-phase.

### Chat Agent

Interactive, user-driven. The user's thought partner and hands for the
canvas.

**Trigger:** User types a message.

**Capabilities:**

- Answers questions about the analysis
- Challenges assumptions and explains methodology
- Creates/edits/deletes entities on behalf of the user (using entity
  CRUD tools — the chat agent IS the replacement for manual editing)
- Triggers analysis runs and reruns (using analysis control tools)
- Researches current facts via web search

**Flow:**

1. Receives user message + conversation history.
2. Builds system prompt with current analysis context.
3. Calls the connector in chat mode — full CRUD tools + streaming text.
4. Streams text responses to the frontend (shown in chat panel).
5. Tool calls execute as side effects (entities created/modified,
   analysis triggered).

### Agent Relationship

The chat agent can invoke the analysis agent via analysis control tools
(`start_analysis`, `rerun_phases`). This is a controlled dependency
through the tool layer, not a direct import. The tool implementation
delegates to the analysis orchestrator.

### Agent rules

1. Only one analysis run can be active at a time. If a rerun is
   requested while analysis is running, it queues.
2. The chat agent can be used while analysis is running.
3. Both agents share the same AI connector instance for a given provider.
4. Tool handlers are registered by the agent layer. Analysis mode
   registers read-only tools; chat mode registers full CRUD.

---

## Layer 5: API Surface

Thin HTTP and WebSocket endpoints. Request validation and transport only.
No product logic.

```
POST /api/ai/analyze
  Request:  { topic: string, provider?: string, model?: string }
  Response: SSE stream
    { channel: "progress",  ...AnalysisProgressEvent }
    { channel: "mutation",  ...AnalysisMutationEvent }
    { channel: "snapshot",  analysis: Analysis }
    { channel: "error",     message: string }
    { type: "done" }

POST /api/ai/entity
  Request:  { action: "get" | "update" | "create" | "delete", ... }
  Response: JSON

GET  /api/ai/state
  Response: JSON { analysis: Analysis, runStatus: RunStatus }

POST /api/ai/connect
  Request:  { provider: string }
  Response: JSON { status, error? }

POST /api/ai/abort
  Request:  {}
  Response: JSON { aborted: boolean }
```

### WebSocket transport (workspace runtime)

The primary real-time channel between server and client. Carries:

- **Workspace state bootstrap:** Full snapshot on connect (threads, active
  thread detail, run status, entity graph, pending questions).
- **Push events:** Channel-scoped updates (`threads`, `thread-detail`,
  `run-detail`, `chat-event`) with monotonic revision numbers and latest-push caching.
- **Client requests:** Thread CRUD (create, rename, delete), question
  resolve, and `chat.turn.start` — bidirectional RPC over the same WebSocket
  connection.
- **Reconnect recovery:** Client reconnects with `lastSeenByChannel`
  revisions. Server replays only missed pushes (no full re-bootstrap
  unless the connection was down long enough for the cache to evict).
  Active chat correlations are re-announced on reconnect so terminal chat
  signals can be replayed without a second live transport.

Endpoint: `GET /api/workspace/runtime` (WebSocket upgrade via Nitro/crossws).

### SSE endpoints (legacy — migrating to WebSocket)

Analysis currently streams responses via SSE:

- `POST /api/ai/analyze` → SSE stream of analysis progress events

The frontend also recovers state via:

- `GET /api/ai/state` returns the current entity graph snapshot AND
  the active run status (running/idle, current phase, progress).

### Security

- All HTTP endpoints (Nitro and MCP) bind to `127.0.0.1` only.
- The current live hardening requirement is to keep MCP HTTP access local
  to the machine so tool surfaces are not exposed to the LAN.
- Additional per-session auth, CORS restrictions, or other same-machine
  hardening can be added later if the product threat model changes, but
  they are not active Phase 8 scope.

---

## Revision Diff Algorithm

The most critical contract in the system. Controls how AI-produced
entities are committed to the entity graph during both initial runs and
revisions.

### Entity identity

- **Server owns all entity IDs.** The entity graph service generates IDs
  via `nanoid()` on creation. The AI never generates permanent IDs.
- **Every entity created via tool call has two identity fields:**
  - `id` — server-assigned ID (string) for existing entities the AI
    wants to keep or update. `null` for new entities.
  - `ref` — AI-generated local reference (string, e.g., `"fact-1"`,
    `"player-china"`) used for cross-referencing within the same
    response. Required on all entities (both new and existing). Used by
    relationships to reference entities within the batch.

### Initial run

The AI returns all entities with `id: null` and unique `ref` values.
Relationships reference entities by `ref` (not by `id`, since IDs don't
exist yet).

The orchestrator:

1. Creates each entity in the entity graph service (which generates a
   real server ID).
2. Builds a `ref → server ID` mapping.
3. Wires relationships by resolving `ref` values to real IDs.
4. Discards `ref` values — they do not persist on the entity.

### Revision run

The AI receives existing entities (with their real server IDs) via
read-only query tools as context. It returns a revised entity set where:

- Existing entities have `id` set to their real server ID and a `ref`.
- New entities have `id: null` and a unique `ref`.
- Relationships use `ref` values to reference entities within the batch,
  regardless of whether they are new or existing.

### Entity diff rules

During a phase, the AI creates entities incrementally via tool calls.
The phase transaction collects all mutations. On `complete_phase`, the
orchestrator diffs the accumulated entity set against the current graph:

1. **Entity with existing server ID matching current phase** → update
   (apply changes from the AI's version).
2. **Entity with `id: null`** → addition (create new entity, generate
   server ID).
3. **Existing AI-created entity for this phase NOT in the response** →
   deletion (AI chose to remove it).
4. **Existing user-edited entity NOT in the response** → preserved.
   AI revision never deletes or overwrites user-edited entities.
5. **Entity with a non-null ID not in the graph** → rejected as invalid.
6. **Entity with a non-null ID from a different phase** → rejected as
   invalid. The AI may only reference IDs belonging to the current phase.

### Relationship diff rules

Relationships created via tool calls during the phase follow the same
transactional pattern as entities. The orchestrator:

1. Resolves all `ref`-based endpoints to real entity IDs (using the
   `ref → server ID` mapping for new entities, and the `id` field for
   existing entities).
2. Replaces all AI-created relationships for the phase with the new set.
   User-created relationships are preserved.
3. Cross-phase relationship endpoints (e.g., a Phase 3 strategy
   referencing a Phase 2 player by server ID) are validated — the
   referenced entity must exist.
4. Relationships that reference entities deleted by the entity diff are
   cascade-deleted.

### Conflict resolution (ranked by precedence)

1. User-edited entities are never deleted or overwritten by AI revision.
2. User-created relationships are never deleted by AI revision.
3. If the AI returns a modified version of a user-edited entity, the
   user's version wins.
4. If the AI returns a modified version of an AI-created entity, the
   AI's revision wins.
5. New entities from the AI are created with new server IDs.

### Referential integrity

After applying the diff, the orchestrator validates:

- All relationship endpoints reference existing entities.
- Cross-phase references point to real entities in the correct phases.
- No orphaned relationships remain.

### Truncation safety

If the AI returns significantly fewer AI-owned entities than existed for
the phase (>50% reduction AND the original set had more than 4 entities),
the orchestrator treats this as a potential context-window truncation:

1. Does NOT commit deletions.
2. Retries the phase with explicit instruction: "Your previous response
   appeared truncated. You returned N entities but M existed. Please
   return the complete revised set."
3. If the retry also shows the same level of reduction, commits as-is
   (the AI genuinely wants to remove entities).

---

## Recursive Revalidation

Revalidation is NOT a sequential phase. It is an orthogonal mechanism
that can fire at any point during analysis. Methodology Phase 5 is
subsumed into this mechanism — there is no separate "Phase 5" step in
the orchestrator.

### How it works

The methodology defines disruption triggers — discoveries during any
phase that invalidate conclusions from earlier phases.

### Trigger mechanism

During any phase, the AI can call `request_loopback(trigger_type,
justification)`. The orchestrator:

1. Records the trigger with justification.
2. Completes the current phase (does not abort mid-phase).
3. Commits the current phase output via the revision diff algorithm.
4. If multiple triggers fired during the phase, batches them and
   selects the earliest target phase.
5. Jumps back to the target phase and runs the revision flow forward.
6. Increments a pass counter.

### Convergence

The recursive loop converges when a full forward pass produces no new
disruption triggers. The orchestrator tracks:

- Pass count (how many full or partial passes have occurred)
- Trigger history (which triggers fired, when, and justification)
- Maximum pass limit (default: 4). If the model is still changing
  structurally after 4 passes, the orchestrator emits a diagnostic
  event and halts, rather than looping indefinitely.

### User-initiated revalidation

When a user edits an entity, staleness propagates downstream. The
orchestrator treats this as an external disruption trigger — it identifies
the earliest affected phase and runs the revision flow from there forward.
User edits are accepted immediately (never blocked), and revalidation
queues behind any active analysis run.

---

## Concurrency Model

Two agents and the user can all modify the entity graph.

### Rules

1. **User and chat agent edits are never blocked.** The entity graph
   service accepts mutations at any time, even during an active analysis
   run.

2. **Phase boundary staleness check.** Between phases, the orchestrator
   checks whether input entities for the next phase have become stale
   since the current phase started. If the current phase's own inputs
   became stale during execution: the phase output is committed but all
   produced entities are marked `stale: true`. The orchestrator does NOT
   advance to the next phase. Instead, it queues a revision from the
   earliest stale phase.

3. **User intent takes precedence.** If the user and the AI both
   modified the same entity during a phase, the user's version is kept
   (per the revision diff conflict rules).

4. **Staleness propagation is always live.** When any entity changes,
   downstream dependents are marked stale immediately regardless of
   whether analysis is running.

5. **Revalidation mutual exclusion.** Only one revalidation can run at
   a time. If staleness triggers fire during a revalidation, the new
   stale IDs are batched and processed in the next pass.

---

## Phase Consistency (CQRS Tool-Call Model)

Analysis phases produce entities through individual CQRS tool calls
(create_entity, update_entity, delete_entity), not batch structured
output. Each tool call is a command processed through the orchestration
engine:

1. The AI calls entity mutation tools during a phase.
2. Each tool call produces a domain event (analysis.entity.created, etc.).
3. Events are applied to the read model incrementally.
4. If a phase fails or needs rollback: the analysis.rollback command
   removes entities created after a given phase checkpoint.

Run-scoped provenance (`runId`) is preserved for tracking. Per-phase
rollback is handled by the CQRS rollback command, which identifies
entities by their creation phase and removes those after the rollback
target phase (preserving human-contributed entities).

---

## Cost Awareness

AI analysis with web search across 10 phases, with potential 4-pass
convergence loops, can be expensive.

### Contract

- **Per-run token budget:** user-configurable limit. Default provided
  based on typical analysis complexity.
- **Pre-run cost estimate:** visible to user before starting analysis.
  Based on topic complexity and expected phase count.
- **Live cost tracking:** token usage updated after each phase. Displayed
  in the UI.
- **Warning before expensive operations:** multi-pass revalidation,
  large-scope reruns, etc. User can approve or abort.
- **Budget exhaustion:** complete the current phase, commit its results,
  halt the run, report partial results. Do not start new phases.
- **Provider-specific tracking:** Claude provides token counts per
  query. Codex provides token-usage notifications per thread. Dollar
  costs derived from provider pricing tables.

---

## Entity Schema

Entities are analytical data. They do not contain view-layer concerns.

### Core fields (persisted)

- `id` — unique identifier (server-generated via nanoid, never from AI)
- `type` — entity type (fact, player, objective, game, strategy, etc.)
- `phase` — which methodology phase produced this entity
- `data` — type-specific structured data
- `confidence` — high / medium / low
- `source` — ai / human / computed (set server-side, not by tools)
- `rationale` — why this entity exists (non-empty, required)
- `revision` — incremented on each modification
- `stale` — whether upstream dependencies have changed
- `provenance` — chained history including runId

### Structured output fields (transient, not persisted)

- `id` — server ID (string) for existing entities, `null` for new ones
- `ref` — AI-generated local reference for intra-response cross-linking
  (e.g., `"fact-1"`, `"player-china"`). Used by relationships to
  reference entities within the same batch. Discarded after the
  orchestrator resolves refs to real IDs.

Position (`{x, y}`) is NOT part of the entity schema. It is stored in
the layout state (see Persistence). Analytical ordering (e.g., escalation
rung order) is part of the entity's `data` field, which is distinct from
canvas position.

### Entity types by methodology phase

**Phase 1 — Situational Grounding:**

- fact (categories: capability, economic, position, impact, action, rule)

**Phase 2 — Player Identification:**

- player (types: primary, involuntary, background, internal, gatekeeper)
- objective (priorities: lexicographic, high, tradable; stability:
  stable, shifting, unknown)
- information-asymmetry (per player pair: what each knows/doesn't know
  about the other's capabilities, resolve, and constraints)

**Phase 3 — Baseline Model:**

- game (canonical structures per methodology; includes timing/move-order
  and time-structure fields)
- strategy (feasibility levels per methodology)
- escalation-rung (order, reversibility, escalation dominance)
- deterrence-compellence (per game: who is deterring vs compelling)
- institutional-rule (treaties, legal authorities, alliance obligations,
  economic institutions — game-structure parameters, not background)

**Phase 4 — Historical Repeated Game:**

- interaction-history (per player pair: major moves, outcomes, timing,
  belief changes)
- repeated-game-pattern (classified: tit-for-tat, grim-trigger,
  selective-forgiveness, dual-track-deception, adverse-selection,
  defection-during-cooperation)
- trust-assessment (per player pair: zero, low, moderate, high)
- dynamic-inconsistency (commitment durability, leadership transition
  risk, institutional form vs required durability)
- signaling-effect (global reputation effects observed by third parties)

**Phase 6 — Full Formal Modeling:**

- payoff-matrix (composite: full matrix as structured data)
- game-tree (composite: extensive form with nodes, branches, information
  sets, payoffs)
- equilibrium-result (type: dominant, Nash, subgame-perfect, Bayesian
  Nash, separating/pooling; includes selection reasoning)
- cross-game-constraint-table (composite: strategies vs games grid)
- cross-game-effect (trigger, effect type, magnitude, direction, cascade)
- signal-classification (cheap talk, costly signal, audience cost)
- bargaining-dynamics (outside options, patience, deadlines, commitment
  problems, dynamic inconsistency, issue linkage)
- option-value-assessment (preserved flexibility analysis)
- behavioral-overlay (prospect theory, biases — explicitly labeled as
  adjacent analytical tools, not core equilibrium results)

**Phase 7 — Assumption Extraction:**

- assumption (sensitivity: critical/high/medium/low; category: behavioral,
  capability, structural, institutional, rationality, information;
  classification: game-theoretic/empirical; correlated cluster ID;
  non-empty rationale; dependencies)

**Phase 8 — Elimination:**

- eliminated-outcome (traced reasoning referencing source phase entities
  and the specific findings that eliminate it)

**Phase 9 — Scenario Generation:**

- scenario (probability with range, key assumptions, invalidation
  conditions, model-basis: which game/linked games, cross-game
  interactions, prediction-basis: equilibrium/discretionary)
- scenario subtype: tail-risk (trigger, why unlikely, consequences,
  drift trajectory)
- central-thesis (single falsifiable claim capturing the core finding)

**Phase 10 — Meta-Check:**

- meta-check (structured fields for each of the 10 methodology questions,
  answer per question, disruption-trigger-identified boolean per question)

### Payoff estimates

The methodology requires "bare numbers are bugs." Any payoff or estimate
entity must include: ordinal rank, cardinal value (only if justified by
evidence), plausible range (low/high interval), confidence, rationale
(non-empty), and what assumptions it depends on.

### Cross-entity validation

- Phase 9: scenario probabilities must sum to approximately 100% (±5%).
  If they don't, the orchestrator flags this in validation and the AI
  must adjust.

---

## Prompt Architecture

Phase prompts are the most critical component of the analysis agent.
They determine whether the AI produces good analytical output or garbage.

### Principles

1. Each phase has a dedicated system prompt grounded in the methodology.
   The prompt specifies what the AI should research, what entity types
   to produce, what relationships to create, and what quality standards
   to apply.

2. Phase prompts describe the available entity creation tools and their
   expected arguments so the AI knows what to produce and how to call
   the tools.

3. Prior phase context is provided through tool access (the AI can query
   existing entities via read tools) and a condensed summary in the user
   prompt. Not through stuffing all prior entities into the prompt.

4. Revision prompts (for reruns) are distinct from initial-run prompts.
   They include what changed upstream, the current entities for the phase
   (with stale markers), and explicit instruction to preserve valid work
   while revising what the new information affects.

5. Phase 4 prompt must include the 4f self-check as a mandatory step
   ("Does the baseline game from Phase 3 still look right?") with
   explicit instruction to call `request_loopback` when warranted.
   Phase 4 is the most common trigger point for disruption.

6. Phase 10 prompt must include all 10 meta-check questions as mandatory
   structured fields, not optional free-text. Each question must be
   answered, and the AI must call `request_loopback` if it identifies a
   blind spot.

7. The chat agent's system prompt includes current analysis state
   (phase status, entity counts, recent changes) and the methodology
   overview so it can answer questions and guide the user.

8. Prompts are versioned and testable. Changes to prompts change the
   product's analytical behavior and should be treated with corresponding
   discipline.

---

## Shared Types

Type definitions needed by both frontend and backend.

### Rule

Zod schemas are the source of truth for entity structure. They live
server-side (in the entity graph service). TypeScript types are inferred
from the Zod schemas and exported for the frontend. This prevents drift
between validation and type definitions.

### What is shared (types only, no runtime)

- Entity types (inferred from Zod schemas)
- Methodology types (phase enum, phase status)
- Event types (progress events, mutation events, chat events)
- API request/response shapes

---

## Frontend Architecture

The frontend is a browser application (React + Skia canvas). It is a
display and input layer only.

### What the frontend owns

- Canvas rendering (Skia — entity nodes, relationships, layout)
- Chat panel (message display, input, streaming text)
- Controls (start/stop analysis, provider selection, settings)
- Zustand stores (projections of server state for rendering)
- Layout position state (computed positions + user overrides with pinned
  flags)
- Cost display (token usage, estimated cost per run)

### What the frontend does NOT own

- Entity graph state (projection only — server is canonical)
- AI connector logic
- Analysis orchestration
- Phase prompts or methodology logic
- MCP tool implementations

### Communication

- `analysis-client` — calls `/api/ai/analyze`, reads SSE stream.
  Processes mutation events incrementally (entity_created,
  entity_updated, entity_deleted) so entities appear on the canvas
  as they are committed, not only in the final snapshot. Also processes
  progress events for phase status.
- `workspace-runtime-client` — opens `/api/workspace/runtime`, sends
  `chat.turn.start`, receives `chat-event` pushes, and updates chat state.
- Entity edits — POST to `/api/ai/entity`.
- State hydration on load/reconnect — GET `/api/ai/state` (returns
  entity graph + active run status).

The frontend never imports from `server/`. This boundary is physical
(directory-based), not conventional.

---

## Electron / Development

The backend is an HTTP server.

- **Development:** Vite serves the frontend. Nitro runs the backend. Both
  on localhost.
- **Electron:** Nitro server runs as a child process of the Electron main
  process (forked, not embedded — keeps the main process event loop free).
  Frontend loads in a BrowserWindow and calls localhost.

Same HTTP/WebSocket transport in both environments. No IPC-specific code.

### Process lifecycle

On app quit, the Electron main process must clean up:

- Nitro server child process (SIGTERM)
- Any Codex app-server subprocesses (grandchildren)
- Any in-flight Claude Agent SDK sessions
- MCP HTTP server (if running as detached process)

---

## Directory Structure (Target)

```
src/                              # Frontend (browser/renderer)
  components/                     # React components
    panels/                       # Chat panel, phase progress, entity cards
    editor/                       # Canvas, analysis controls
  stores/                         # Zustand stores (projections)
  canvas/                         # Skia rendering engine
  hooks/                          # React hooks
  clients/                        # HTTP/WebSocket clients
    analysis-client.ts

server/                           # Backend (Node.js)
  api/ai/                         # HTTP endpoints
    analyze.ts
    entity.ts
    connect.ts
    state.ts                      # GET — hydration/reconnection
    abort.ts                      # POST — abort active run
  agents/                         # AI agent orchestration
    analysis-agent.ts             # 10-phase methodology automation
    chat-agent.ts                 # Conversational interface
  services/                       # Product services (domain logic)
    entity-graph-service.ts
    layout-engine.ts
    persistence-service.ts
  connectors/                     # AI transport
    claude-connector.ts
    codex-connector.ts
  tools/                          # MCP tool implementations
    entity-tools.ts
    relationship-tools.ts
    analysis-tools.ts

shared/                           # Types only (no runtime)
  types/
    entity.ts                     # Inferred from server-side Zod schemas
    methodology.ts
    events.ts
    api.ts
```

---

## What This Contract Does Not Decide

- Exact phase prompt content for each phase
- Canvas interaction model (click, drag, zoom behavior)
- Layout algorithm selection
- .gta file format versioning
- OpenPencil legacy removal sequence
- Provider-specific error handling details
- Rate limiting details
- Prompt versioning infrastructure specifics

These are implementation decisions that should be made when the relevant
work begins, guided by the boundaries defined here.
