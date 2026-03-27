# TODOS

## Chat & Threads

### Thread rollback (undo N turns)

**What:** Allow users to undo N turns from a conversation thread.

**Why:** No undo means bad AI turns are permanent. Users need a way to back out of unproductive analysis directions.

**Context:** All prerequisites are in place: domain-event-store, thread-service, command-bus. The domain events already capture enough state to reconstruct prior thread snapshots.

**Effort:** L
**Priority:** P2
**Depends on:** None (all prerequisites done)

### Workspace runtime stuck after analysis failure

**What:** After any analysis run fails (timeout, validation error, provider error), subsequent chat requests time out with "Workspace runtime request timed out: chat.turn.start". The runtime doesn't properly clean up/reset after failure, blocking all AI interaction until the app is restarted.

**Why:** Critical UX blocker — a single failed analysis makes the entire chat unusable. Users must restart the app to recover.

**Context:** Discovered during E2E testing. Reproduces with both Claude and Codex providers. The workspace runtime transport appears to remain in a "busy" state after `analysis.run` fails, never returning to idle. The `chat.turn.start` request queues behind the dead analysis and eventually times out.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Haiku scenario probability validation

**What:** Haiku outputs scenario probabilities as decimal fractions (e.g., 0.003 instead of 30%), causing the Phase 8 probability sum validation to reject them. The validator expects 95-105% sum but gets ~0.9%.

**Why:** Haiku completes 7/9 phases correctly but fails on Phase 8 every time due to this format mismatch. Blocks smaller/cheaper models from completing full analyses.

**Context:** The fix is either: (a) detect decimal-vs-percentage format and normalize before validation, or (b) if all values are <1 and sum to ~1.0, multiply by 100. The validation logic lives in the analysis orchestrator's scenario phase handler.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Analysis Pipeline

### Multi-turn analysis phases

**What:** Convert analysis phases from single-turn structured output to multi-turn thread-based turns. AI creates entities via tool calls. Phases are turns within a thread.

**Why:** The biggest architectural gap vs the T3 target. Current approach works but doesn't leverage thread persistence, session resume, or tool-based entity creation.

**Context:** This is a major effort — deserves its own `/office-hours` + `/plan-eng-review` cycle before implementation.

**Effort:** XL
**Priority:** P2
**Depends on:** None

### Analysis type architecture (multi-methodology platform)

**What:** Pluggable analysis workflows (game theory, prediction market, stock analysis, etc.).

**Why:** Foundation for entire product roadmap. Currently hardcoded to 10-phase game theory.

**Context:** Depends on analysis report v1 validating the concept first. This is a major planning effort — separate cycle.

**Effort:** XL
**Priority:** P3
**Depends on:** Analysis report v1

### Report revalidation (user-triggered)

**What:** Mark analysis report stale on upstream entity edits. Manual "regenerate report" action.

**Why:** Without this, users can't trust report accuracy after editing entities on the canvas.

**Context:** Requires the analysis report feature to be stable first.

**Effort:** M
**Priority:** P2
**Depends on:** Analysis report feature

### analysis-service.ts decomposition

**What:** Split the ~2,000-line file into schema-builder, orchestration-setup, and thin route handler.

**Why:** Largest file in codebase. Mixes API surface with business logic, making it hard to test and modify.

**Context:** Straightforward refactor — extract logical boundaries that already exist in the code.

**Effort:** M
**Priority:** P2
**Depends on:** None

## Canvas & UX

### Tool approval UX

**What:** Surface AI tool calls as approve/deny prompts with keyboard shortcuts.

**Why:** AI currently acts freely on all tools. Users should approve entity mutations before they hit the graph.

**Context:** question-service and WebSocket transport are done. Need UI component + keybinding integration.

**Effort:** L
**Priority:** P2
**Depends on:** None (all prerequisites done)

### Stream WebSearch queries into canvas status bar

**What:** Show live search queries (e.g., "searching: US China tariff history 2025") instead of just "Using WebSearch".

**Why:** Gives users visibility into what the AI is actually searching for during analysis.

**Context:** Independent enhancement. The content stream typing work (reasoning vs output) provides a pattern for surfacing tool activity.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Force-directed graph layout

**What:** Force-directed or hierarchical graph layout for entity positioning.

**Why:** Entities currently require manual positioning. Auto-layout would make large graphs immediately usable.

**Context:** Entity graph rendering and spatial index are done. Needs a layout algorithm (e.g., d3-force or dagre).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Semantic zoom

**What:** Zoom-level-aware rendering with progressive detail disclosure.

**Why:** At high zoom levels, entity nodes show too much detail; at low zoom, too little. Progressive disclosure improves readability.

**Context:** Entity graph + entity node rendering are done. Canvas pan/zoom is done.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Plan mode

**What:** AI proposes structured plans. Rendered as markdown card. "Implement Plan" button creates new thread.

**Why:** The current `PlanPreviewCard` is a pre-launch analysis settings card, not a provider-generated proposed-plan flow.

**Context:** Would build on thread-service and the existing plan preview UI component.

**Effort:** L
**Priority:** P3
**Depends on:** None

### Keybindings system

**What:** Declarative keybinding registry with context-aware when-clause evaluation.

**Why:** Power users need keyboard shortcuts. Currently no keybinding infrastructure.

**Context:** Standalone feature, no hard dependencies.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Infrastructure

### Pin Nitro to stable release

**What:** Migrate from `nitro-nightly@3.0.1-20260217` to stable Nitro.

**Why:** Nightly builds can break without notice. Contradicts stabilization goals.

**Context:** The 3.0.0 stable vite plugin API (NitroPluginConfig) differs from the nightly API this app uses (`features`, `node`, `serverDir` config surface). Needs a compatibility spike.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Schema-validated settings

**What:** Zod validation on all settings. Per-thread model selection persistence.

**Why:** Settings are currently unvalidated. Bad values cause silent failures.

**Context:** Straightforward — add Zod schemas to existing settings surface.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Electron crash recovery hardening

**What:** Exponential backoff array for Nitro restart [1s, 2s, 4s, 8s, 16s, 30s]. Circuit breaker after 6 failures.

**Why:** Current restart logic is linear. Repeated failures should back off, not hammer.

**Context:** Entry point is `scheduleNitroRestart` in `electron/main.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Event replay capability

**What:** Add `replayEvents` method to domain event store. State reconstruction from event log.

**Why:** Enables debugging, auditing, and potential time-travel features.

**Context:** domain-event-store is done. This adds a read path on top of existing event data.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Multi-tab state sync

**What:** Multiple Electron windows subscribe to WebSocket and see consistent state.

**Why:** Power users may want multiple views of the same workspace.

**Context:** WebSocket transport is done. Needs broadcast channel or shared subscription logic.

**Effort:** M
**Priority:** P4
**Depends on:** None

### Per-thread model selection (persisted)

**What:** Model selector persisted to SQLite per thread, not just localStorage.

**Why:** Model choice should survive across sessions and be workspace-portable.

**Context:** Thread tables already exist. Add a `model` column and wire it through.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed

### Codex adapter wall-clock timeout replaced with idle timeout (2026-03-27)

Replaced the hardcoded 5-minute wall-clock timeout with an idle timeout (3 min default) that only fires when the provider goes silent. Active phases now run to completion. Orchestrator phase timeout bumped to 20 min as a generous safety net. Commit: `98d819f`.

### Chat context cleanup — remove hybrid prompt stuffing (2026-03-27)

Removed entity-summary injection and `trimChatHistory` from the chat system prompt. Adapters now own context-window management. Commit: `2c14621`.

### Atomic entity persistence + batched broadcasts (2026-03-27)

Wrapped entity writes in single SQLite transactions with batched WebSocket broadcasts. Commit: `7e6fbf4`.

### Persistence consolidation — single source of truth (2026-03-27)

`workspace_json` no longer stores entity data. `graph_entities`/`graph_relationships` tables are the canonical entity state. Commit: `043e9b1`.

### Workspace runtime outbound queue parity (2026-03-27)

Added outbound request queueing/replay to `workspace-runtime-client`. Requests survive connect/reconnect transitions. Commit: `943c680`.

### Chat transport — T3 WebSocket pattern (2026-03-27)

Chat streaming migrated from SSE to workspace runtime WebSocket with `chat.turn.start`, correlation-scoped live push events, and server-owned token-aware history budgeting from SQLite.

### Canvas navigation and entity inspection (2026-03-27)

Pan (mouse drag), zoom (mouse wheel to point), click-to-inspect (entity overlay card with type-specific details, in-place editing, cross-entity navigation). Spatial index hit testing, viewport sync, hover detection, edge hit testing, click-away dismissal.

### AI Runtime Redesign (2026-03-19)

Two-provider adapter system, server-side entity-graph-service, 13 MCP product tools, analysis orchestrator, revalidation service, NormalizedChunk support.

### T3 Migration Phases 1-18 (2026-03-26)

Provider adapters, command bus, WebSocket transport, tagged errors, SQLite persistence (14+ tables), session resume, thread CRUD, domain events, question service, health probes, prompt pack registry, entity graph persistence, chat persistence, activity logging, run tracking, Electron crash recovery, auto-updater, command receipts.

### Validated Audit Follow-ups (2026-03-23)

Codex adapter isolation (partial), Nitro readiness (partial), protocol-boundary type hardening (partial).
