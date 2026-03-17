# AI Agent Chat — Phase 3: Analysis Views Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the agent's tool execution to live UI updates — when the AI calls `add_player`, the Players view updates in real-time. Replace heuristic-based phase tracking with entity-existence-based progress. Build the propose_revision approval UI.

**Architecture:** Tool execution in the agent loop dispatches commands through the command spine, which updates the canonical store via Zustand. React components already subscribe to store changes, so entity views update automatically. The new work is: (1) deriving phase progress from entity counts instead of heuristic phase function execution, (2) building the propose_revision UI flow where proposals appear in chat and the user approves/rejects, and (3) ensuring the ToolContext in the agent endpoint has access to the real canonical store state.

**Tech Stack:** React 19, Zustand 5, existing command spine (`dispatch()`), existing analysis-store

**Spec:** `docs/superpowers/specs/2026-03-16-ai-agent-chat-design.md` — Sections 4 (Tool Registry, propose_revision), 7 (What Happens to Existing Code), 8 (Phase progress sidebar)

**Depends on:** Phase 1 (tool registry, agent loop) + Phase 2 (chat panel UI)

---

## Scope

### What to build

1. **ToolContext wiring** — The agent endpoint currently has a placeholder ToolContext. Wire it to the real canonical store:
   - The client sends the current canonical state snapshot with each request, OR
   - The server maintains a session-scoped canonical store that tools mutate directly
   - Decision: The server-side approach is cleaner — the agent endpoint holds a mutable CanonicalStore for the duration of the SSE connection. Tool results that create entities are dispatched server-side. The client receives `tool_result` events and replays the same commands through its own Zustand store to stay in sync.
   - This preserves the "only the renderer promotes" principle — the server proposes, the client commits to its own store.

2. **Entity-based phase progress** — Replace `pipeline-store`'s `phase_states` (which tracks heuristic function execution) with derived progress from entity existence:
   - Phase 1 complete: evidence entities exist across categories (sources, observations, claims, inferences)
   - Phase 2 complete: players with objectives exist (≥2 players)
   - Phase 3 complete: at least one game with a formalization
   - Phase 4 complete: trust assessments or repeated game patterns exist
   - Phase 5: always "available" (revalidation is on-demand via `check_disruption_triggers`)
   - Phase 6 complete: formalizations have payoffs
   - Phase 7 complete: assumptions extracted
   - Phase 8 complete: eliminated outcomes exist
   - Phase 9 complete: scenarios with probability estimates exist
   - Phase 10 complete: meta-check (derived from adversarial challenges existing, or manual)

   This logic already exists in `get_analysis_status` (Phase 1, Task 4). The UI component subscribes to the canonical store and derives phase progress directly.

3. **Phase progress sidebar component** — Visual checklist showing 10 phases with:
   - Filled/empty indicator based on entity existence
   - Entity count badges
   - Coverage warnings (from `get_analysis_status` logic)
   - Current focus indicator (which phase the AI is currently working on, inferred from recent tool calls)

4. **propose_revision UI flow** — When the agent calls `propose_revision`:
   - The tool creates a proposal (reuses existing proposal infrastructure from conversation-store)
   - A `tool_result` event streams to the chat panel with proposal details
   - The chat panel renders it as a proposal card with Accept/Reject buttons
   - On Accept: the proposal's commands are dispatched through the client-side command spine
   - On Reject: the rejection is sent back to the agent as a user message ("Proposal rejected: [reason]") so it can adjust
   - This reuses the existing `acceptConversationProposal()` from `src/stores/proposal-actions.ts`

5. **Real-time view updates** — Verify that entity mutations from tool execution trigger view re-renders:
   - When `add_player` executes → Players view shows the new player
   - When `add_game` executes → Game Map view shows the new game
   - When `add_source` → `add_observation` → `add_claim` execute → Evidence Library updates
   - This should work automatically via Zustand subscriptions if the command spine dispatches correctly through the analysis-store

### What NOT to build (deferred to Phase 4)

- Prompt tuning and iteration
- Multi-provider testing
- Compaction event indicators in chat

### Key files to study before implementing

- `src/stores/analysis-store.ts` — Canonical store + dispatch + event log
- `src/stores/pipeline-store.ts` — Current phase tracking (to be replaced/augmented)
- `src/stores/conversation-store.ts` — Proposal infrastructure (registerProposalGroup, updateProposalStatus)
- `src/stores/proposal-actions.ts` — acceptConversationProposal()
- `shared/game-theory/tools/analysis-tools.ts` — get_analysis_status (Phase 1) has the entity→phase mapping logic
- `server/api/ai/agent.ts` — Agent endpoint ToolContext placeholder (Phase 1)
- `src/components/` — Existing entity views that should update in real-time

### Key architecture decisions

**Server-side canonical store vs client-side:** The agent endpoint needs a ToolContext with a canonical store to execute tools. Two options:

- Client sends canonical snapshot with each request (simple but large payload)
- Server maintains session-scoped store (cleaner, but needs sync mechanism)

Recommendation: Start with client sends snapshot (simpler), optimize to server-side store later if payload size is an issue. The canonical store is typically <100KB even for complex analyses.

**Proposal flow:** The existing proposal infrastructure (conversation-store's `registerProposalGroup`, `proposal-actions`'s `acceptConversationProposal`) is designed for batch proposals from heuristic phases. The agent's `propose_revision` produces individual proposals. The simplest integration: create a one-proposal group per `propose_revision` call, render it as a chat message with Accept/Reject, and use the existing acceptance flow.

### Task outline (to be expanded into full TDD steps)

1. Wire ToolContext to real canonical store in agent endpoint
2. Build entity-based phase progress derivation (reuse get_analysis_status logic)
3. Build phase progress sidebar component
4. Implement propose_revision tool with proposal creation
5. Build proposal card renderer in chat panel (Accept/Reject buttons)
6. Wire Accept to command spine dispatch, Reject to agent feedback
7. Verify real-time view updates via Zustand subscriptions
8. Integration test: agent creates entities → views update → phase progress advances
