# TODOS

Deferred work items from the Entity Graph Canvas v1 plan review (2026-03-18).
Updated with items from Analysis Report & Prediction Verdict CEO review (2026-03-23).
Updated with T3 migration eng review findings (2026-03-26).
Reorganized into P0-P3 priority tiers (2026-03-26).

## P1 — Next Up (high value)

### Content stream typing (reasoning vs output)
- **What:** Distinguish reasoning vs output vs plan content in chat streams. Render reasoning in collapsible blocks.
- **Why:** The renderer currently gets a flat text stream with no way to differentiate AI reasoning from final output. T3 has `ContentStreamKind` with 7 content types.
- **Effort:** M (human: ~3 days / CC: ~20min)
- **Where to start:** Extend ChatEvent with `content_kind` discriminator. Claude adapter: extract reasoning_text from SDK events. Codex adapter: extract tool output vs text.

### Chat context cleanup (remove hybrid prompt stuffing)
- **What:** Stop injecting entity summaries and trimmed history windows into the chat system prompt. Move to canonical thread history + tool-driven graph lookup.
- **Why:** Chat persistence exists in SQLite, but the live provider path still uses the pre-T3 architecture: server-side context stuffing plus `trimChatHistory`.
- **Effort:** M (human: ~3 days / CC: ~20min)
- **Where to start:** Delete the entity-summary block in `chat-service`, remove `trimChatHistory` from the hot path, and let adapters own context-window management.

### Atomic entity persistence + batched broadcasts
- **What:** Wrap `commitPhaseSnapshot` in a single SQLite transaction including both entity writes AND domain events. Collect mutations and emit ONE WebSocket broadcast per phase.
- **Why:** Currently entity writes are N individual autocommit calls, and each fires a separate WebSocket broadcast. If a write fails mid-batch, the graph diverges silently.
- **Effort:** M (human: ~6h / CC: ~20min)
- **Where to start:** Add `beginBatch()`/`commitBatch()` API to entity-graph-service.

### Persistence consolidation (single source of truth)
- **What:** Make `graph_entities`/`graph_relationships` SQLite tables THE canonical entity state. Make `workspace_json` derive from them on save.
- **Why:** 4 sources of entity truth (workspace_json, graph tables, domain events, .gta files). Export reads graph tables for entities but workspace_json for everything else — active split-brain.
- **Effort:** L (human: ~1 week / CC: ~1h)
- **Where to start:** Make workspace_json serialize from graph tables, not in-memory state. Make .gta export read from graph tables.

### Canvas navigation and entity inspection
- **What:** Pan, zoom, and click-to-inspect entities on the canvas.
- **Why:** Without interaction, the entity graph feature is invisible. Users can't verify analysis quality or interact with results.
- **Where to start:** Wire mouse wheel → zoom, mouse drag → pan. On entity click, show overlay card.

### Workspace runtime outbound queue parity
- **What:** Add outbound request queueing/replay to `workspace-runtime-client` so thread/question requests survive connect/reconnect transitions.
- **Why:** The current client reconnects and replays pushes, but request sends still fail when the socket is not already open. That is not T3 transport parity yet.
- **Effort:** S (human: ~1 day / CC: ~10min)
- **Where to start:** Mirror T3 `wsTransport` semantics: enqueue every request, flush on open, reject only on timeout/dispose.

## P2 — Important (product maturity)

### Multi-turn analysis phases
- **What:** Convert analysis phases from single-turn structured output to multi-turn thread-based turns. AI creates entities via tool calls. Phases are turns within a thread.
- **Why:** The biggest architectural gap vs the T3 target. The current approach works but doesn't leverage the full T3 infrastructure (thread persistence, session resume, tool-based entity creation).
- **Effort:** XL — deserves its own /office-hours + /plan-eng-review cycle.

### Thread rollback (undo N turns)
- **What:** Allow users to undo N turns from a conversation thread.
- **Why:** No undo means bad AI turns are permanent.
- **Effort:** L (human: ~1 week / CC: ~30min)
- **Depends on:** domain-event-store (done), thread-service (done), command-bus (done)

### Tool approval UX
- **What:** Surface AI tool calls as approve/deny prompts with keyboard shortcuts.
- **Why:** AI currently acts freely on all tools. Users should approve entity mutations.
- **Effort:** L (human: ~1 week / CC: ~30min)
- **Depends on:** question-service (done), WebSocket transport (done)

### Overlay transcript consolidation
- **What:** Remove `overlayMessages` as a second chat transcript source. Replace it with a bounded pending-turn state that reconciles into the persisted thread projection.
- **Why:** The renderer currently merges persisted thread messages with a parallel Zustand overlay transcript. That dual state path complicates resume, rollback, and truthfulness.
- **Effort:** M (human: ~2 days / CC: ~20min)
- **Depends on:** Chat transport — T3 WebSocket pattern

### Schema-validated settings
- **What:** Zod validation on all settings. Per-thread model selection persistence.
- **Effort:** M (human: ~3 days / CC: ~15min)

### Analysis type architecture (multi-methodology platform)
- **What:** Pluggable analysis workflows (game theory, prediction market, stock analysis, etc.).
- **Why:** Foundation for entire product roadmap. Currently hardcoded to 10-phase game theory.
- **Effort:** XL — deserves its own planning cycle.
- **Depends on:** Analysis report v1 validates the concept.

### Report revalidation (user-triggered)
- **What:** Mark analysis report stale on upstream entity edits. Manual "regenerate report" action.
- **Effort:** M (human: ~1 week / CC: ~1 hour)
- **Depends on:** Analysis report feature.

### Stream WebSearch queries into canvas status bar
- **What:** Show live search queries (e.g., "searching: US China tariff history 2025") instead of just "Using WebSearch".
- **Effort:** S — independent enhancement.

### Pin Nitro to stable release
- **What:** Migrate from `nitro-nightly@3.0.1-20260217` to stable Nitro. Requires compatibility spike — the 3.0.0 stable vite plugin API (NitroPluginConfig) is different from the nightly API this app uses (`features`, `node`, `serverDir` config surface).
- **Why:** Nightly builds can break without notice. Contradicts stabilization goals.
- **Effort:** M (human: ~2 days / CC: ~30 min) — needs config migration + testing

### analysis-service.ts decomposition
- **What:** Split the 1,997-line file into schema-builder, orchestration-setup, and thin route handler.
- **Why:** Mixes API surface + business logic. Largest file in codebase.
- **Effort:** M (human: ~3 days / CC: ~30 min)

## P3 — Nice to Have

### Event replay capability
- **What:** Add `replayEvents` method to domain event store. State reconstruction from event log.
- **Depends on:** domain-event-store (done)

### Keybindings system
- **What:** Declarative keybinding registry with context-aware when-clause evaluation.
- **Effort:** M (human: ~3 days / CC: ~15min)

### Electron crash recovery hardening
- **What:** Exponential backoff array for Nitro restart [1s, 2s, 4s, 8s, 16s, 30s]. Circuit breaker after 6 failures.
- **Where to start:** `electron/main.ts` `scheduleNitroRestart`.

### Force-directed graph layout
- **What:** Force-directed or hierarchical graph layout for entity positioning.
- **Depends on:** Entity graph v1 (done).

### Semantic zoom
- **What:** Zoom-level-aware rendering with progressive detail disclosure.
- **Depends on:** Entity graph + entity node rendering (done).

### Multi-tab state sync
- **What:** Multiple Electron windows subscribe to WebSocket and see consistent state.
- **Depends on:** WebSocket transport (done).

### Plan mode
- **What:** AI proposes structured plans. Rendered as markdown card. "Implement Plan" button creates new thread.
- **Why:** The current `PlanPreviewCard` is a pre-launch analysis settings card, not a provider-generated proposed-plan flow.
- **Effort:** L

### Per-thread model selection (persisted)
- **What:** Model selector persisted to SQLite per thread, not just localStorage.
- **Effort:** S

## Completed

### AI Runtime Redesign (2026-03-19)
Two-provider adapter system, server-side entity-graph-service, 13 MCP product tools, analysis orchestrator, revalidation service, NormalizedChunk support.

### T3 Migration Phases 1-18 (2026-03-26)
Provider adapters, command bus, WebSocket transport, tagged errors, SQLite persistence (14+ tables), session resume, thread CRUD, domain events, question service, health probes, prompt pack registry, entity graph persistence, chat persistence, activity logging, run tracking, Electron crash recovery, auto-updater, command receipts.

### Validated Audit Follow-ups (2026-03-23)
Codex adapter isolation (partial), Nitro readiness (partial), protocol-boundary type hardening (partial).

### Chat transport — T3 WebSocket pattern (2026-03-27)
Chat streaming migrated from SSE to workspace runtime WebSocket with `chat.turn.start`, correlation-scoped live push events, and server-owned token-aware history budgeting from SQLite.
