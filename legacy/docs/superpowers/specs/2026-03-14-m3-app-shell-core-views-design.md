# M3: App Shell + Core Views — Design Spec

**Date:** 2026-03-14
**Milestone:** 3 (App Shell + Core Views)
**Status:** Approved
**Scope:** Sessions 3.1–3.6 + Workflow Board, Players Registry, Welcome Screen from UI mocks

---

## Overview

M3 transforms the M1/M2 backend (18 entity types, command/event spine, referential integrity) into a fully functional desktop application. By the end of M3, users can load or create strategic models, visualize them in six coordinated analytical views, edit payoffs and evidence, and work entirely offline — all without AI.

The app runs as both a Tauri 2.0 desktop app and a standalone browser app via a platform abstraction layer.

### Scope Decisions

**Included (beyond spec sessions 3.1–3.6):**
- Welcome Screen with recent files and action cards
- Workflow Board (kanban-style game management)
- Players Registry (cross-game player grid)
- Evidence Library (filterable app-level evidence list)

**Deferred to later milestones:**
- Settings screen (depends on solver weights from M4)
- Play View (depends on play engine from M7)
- SQLite persistence for Diff View (uses in-memory event log for M3)

### Design Principles Applied

1. **Visible uncertainty** — EstimateValue is the display primitive; EstimateEditor rejects bare numbers
2. **Human-in-the-loop** — Session 3.6 builds complete manual modeling; no AI dependency
3. **Structure over prose** — Views render structured model data, not generated text
4. **Multiple formalizations** — Graph, Matrix, Tree views each suited to different formalization types
5. **Local-first** — Dual-target (Tauri + browser); user controls all data
6. **Inspect before promote** — Derived views (Timeline, Player Lens, Diff) are read-only

---

## Architecture

### Implementation Approach

Two-phase build, shell-first:

- **Phase 1 — App Shell:** Platform abstraction, Zustand store, sidebar navigation, view routing, Welcome Screen, Workflow Board, Players Registry, Evidence Library, empty states, status bar
- **Phase 2 — Analytical Views:** Graph + coordination bus → Evidence Notebook → Matrix + Tree → Timeline/Player Lens/Diff → Manual Modeling

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2.0 |
| UI framework | React 19 |
| State management | Zustand |
| Styling | Tailwind CSS |
| Graph rendering | React Flow (graph + tree views) |
| Icons | Lucide React |
| Font | JetBrains Mono (UI), Space Grotesk (headings) |
| Build | Vite |
| Testing | Vitest + React Testing Library + Playwright |
| Validation | Zod (from M1 schemas) |

### Design System Tokens

From the `.pen` UI mocks:

```
Colors:
  --bg-page:       #0F0F10
  --bg-sidebar:    #0A0A0B
  --bg-card:       #141415
  --border:        #27272A
  --accent:        #F5A623
  --text-primary:  #FAFAFA
  --text-muted:    #A1A1AA
  --text-dim:      #52525B
  --success:       #22C55E
  --warning:       #F59E0B
  --error:         #EF4444
  --info:          #3B82F6

Typography:
  UI text:     JetBrains Mono
  Headings:    Space Grotesk

Spacing:      Tailwind defaults (4px base)
Border radius: 4px default
```

---

## Platform Abstraction Layer

The app runs in both Tauri and browser environments via a platform abstraction.

### Interfaces

```typescript
interface Platform {
  type: 'browser' | 'tauri'
  capabilities: {
    nativeDialogs: boolean
    nativeFs: boolean
    nativeWindowChrome: boolean
  }
}

interface RecentFile {
  path: string
  name: string          // analysis name from file metadata
  lastOpened: number    // timestamp
}

interface SaveResult {
  success: boolean
  path: string
  error?: string
}

interface FileService {
  openFile(): Promise<LoadResult>                          // dialog + read + parse
  openFilePath(filepath: string): Promise<LoadResult>      // direct path (for recent files, fixtures)
  saveFile(filepath: string, store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>
  saveFileAs(store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>   // dialog + write
  getRecentFiles(): Promise<RecentFile[]>
  loadFixture(name: string): Promise<LoadResult>
}

interface ShellService {
  setTitle(title: string): void
  onBeforeClose(cb: () => Promise<boolean>): void
}
```

**Note on `FileService.saveFile`:** The Zustand `saveFile()` action (no params) reads `canonical`, `fileMeta.path`, and `fileMeta.meta` from store state, then calls `fileService.saveFile(path, store, meta)`. The service calls `storeToAnalysisFile(store, meta)` to produce an `AnalysisFile`, then `saveAnalysis(filepath, analysisFile)` from M1. This keeps the platform service stateless — all state comes from the Zustand store.

### Adapters

**TauriFileService:**
- Uses `@tauri-apps/plugin-dialog` for file picker
- Uses `@tauri-apps/plugin-fs` for read/write
- Calls M1 `loadAnalysisFile(filepath)` for loading and `saveAnalysis(filepath, analysisFile)` for saving

**BrowserFileService:**
- Uses File System Access API (`showOpenFilePicker`/`showSaveFilePicker`) with OPFS fallback
- Same M1 functions for parse/serialize
- Recent files stored in `localStorage`

**Detection:** Check for `window.__TAURI_INTERNALS__` at startup.

**Delivery:** `PlatformProvider` React context at app root. Components access via `usePlatform()` hook.

---

## Zustand Store

### Shape

```typescript
// Extended beyond session 3.1's ViewType to include app-level pages
type ViewType =
  | 'welcome'           // app-level (not in 3.1 contract)
  | 'board'             // app-level (not in 3.1 contract)
  | 'players_registry'  // app-level (not in 3.1 contract)
  | 'evidence_library'  // app-level (not in 3.1 contract)
  | 'graph'             // game-scoped
  | 'matrix'            // game-scoped
  | 'tree'              // game-scoped
  | 'timeline'          // game-scoped
  | 'player_lens'       // game-scoped
  | 'evidence_notebook' // game-scoped
  | 'scenario'          // game-scoped
  | 'play'              // game-scoped (deferred)
  | 'diff'              // game-scoped

// Note: session 3.1 contract uses `AnalysisStoreState`. We use `AppStore` here
// because the store serves the full app (including app-level pages beyond the
// session contract). The contract's shape is a subset of this interface.
interface AppStore {
  // L1 — Canonical (persisted to .gta.json)
  canonical: CanonicalStore

  // L2 — View state (in-memory only)
  viewState: {
    activeView: ViewType
    activeGameId: string | null
    activeFormalizationId: string | null
    inspectedRefs: EntityRef[]
    sidebarCollapsed: boolean          // L2 extension beyond session contract
  }

  // Engine state
  eventLog: EventLog
  inverseIndex: InverseIndex
  fileMeta: {
    path: string | null
    meta: AnalysisFileMeta | null      // name, description, timestamps — needed for storeToAnalysisFile()
    lastSaved: number | null
    dirty: boolean
  }

  // Recovery state (populated when loadFile encounters errors)
  // When active=false, other fields are null. When active=true, fields match LoadResult recovery variant.
  recovery: {
    active: false
  } | {
    active: true
    stage: 'parse' | 'migration' | 'validation' | 'structural'
    raw_json: string
    parsed_json?: unknown
    error: { message: string; issues?: unknown[]; structural_issues?: StructuralIssue[] }
  }

  // L1 actions (all go through command spine)
  dispatch: (command: Command, opts?: {
    dryRun?: boolean
    source?: ModelEvent['source']      // 'user' | 'ai_merge' | 'solver' | 'play_session'
  }) => DispatchResult
  undo: () => boolean                  // returns false if nothing to undo
  redo: () => boolean                  // returns false if nothing to redo

  // File actions (go through platform abstraction)
  loadFile: (filepath?: string) => Promise<void>  // optional path; omit for dialog
  saveFile: () => Promise<void>
  newAnalysis: () => void

  // L2 actions (direct store mutations, not commands)
  setActiveView: (view: ViewType) => void
  setActiveGame: (gameId: string | null) => void
  setActiveFormalization: (formId: string | null) => void
  setInspectedRefs: (refs: EntityRef[]) => void
}
```

### Rules

- L1 mutations always go through `dispatch()` — never `set()` directly
- L2 mutations use Zustand's `set()` — they're ephemeral view state
- `dispatch()` internally calls the M2 dispatch function, updates `eventLog`, regenerates `inverseIndex`, marks `fileMeta.dirty = true`
- `dispatch()` with `opts.dryRun = true` returns the result without committing (replaces separate `dryRun` method)
- Selectors are plain functions (e.g., `useGamesForBoard()`, `usePlayersRegistry()`)

### Recovery Mode

When `loadFile` receives a `LoadResult` with `status: 'recovery'`, it populates `store.recovery` with the full recovery payload (`stage`, `raw_json`, `parsed_json`, `error` including `issues` and `structural_issues`). The app enters recovery mode:
- `ViewRouter` checks `recovery.active` first — if true, renders `RecoveryView` instead of the normal view
- `RecoveryView` shows a read-only JSON editor with error annotations from the recovery payload
- User can edit the JSON and retry (re-invokes `loadFile` with the corrected content), or dismiss and start fresh (`newAnalysis()`)
- `dispatch()` is a no-op while `recovery.active === true` — L1 commands are blocked

---

## Navigation & Routing

### Structure

Two-tier sidebar:

**App-level pages:**
- `/` — Welcome Screen (no active game)
- `/board` — Workflow Board
- `/players` — Players Registry
- `/evidence` — Evidence Library

**Game-scoped views** (appear when `activeGameId` is set):
- `/game/:id/graph` — Graph View
- `/game/:id/matrix` — Matrix View
- `/game/:id/tree` — Tree View
- `/game/:id/evidence` — Evidence Notebook
- `/game/:id/scenario` — Scenario View
- `/game/:id/play` — Play View (deferred)

### Implementation

- No client-side router library — navigation is Zustand state (`activeView` + `activeGameId`)
- `ViewRouter` component switches content based on store state
- Game section in sidebar appears/disappears based on `activeGameId`
- Breadcrumb in top bar shows navigation context
- Browser mode supports deep linking via query params: `?view=matrix&game=gm_123&inspect=nd_456`

**Navigation semantics:**
- Navigate to app-level page → `setActiveGame(null)` then `setActiveView('board')` — clears game context
- Navigate to game-scoped view → `setActiveGame(gameId)` then `setActiveView('graph')` — sets game context
- `ViewRouter` checks `recovery.active` first — if true, renders `RecoveryView` regardless of `activeView`

---

## Coordination Bus

Cross-view synchronization system. Plain event emitter — not a React context or Zustand store.

### Contract

```typescript
// Base fields shared by all coordination events
interface BaseCoordinationEvent {
  source_view: ViewType
  correlation_id: string
}

// Typed event union — each kind has a specific payload
type CoordinationEvent =
  | BaseCoordinationEvent & { kind: 'selection_changed'; refs: EntityRef[] }
  | BaseCoordinationEvent & { kind: 'focus_entity'; ref: EntityRef }
  | BaseCoordinationEvent & { kind: 'scroll_to'; ref: EntityRef }
  | BaseCoordinationEvent & { kind: 'highlight_dependents'; root_ref: EntityRef; dependent_refs: EntityRef[] }
  | BaseCoordinationEvent & { kind: 'highlight_clear' }
  | BaseCoordinationEvent & { kind: 'view_requested'; view: ViewType; gameId?: string }
  | BaseCoordinationEvent & { kind: 'stale_entities_changed'; stale_refs: EntityRef[] }

type CoordinationEventKind = CoordinationEvent['kind']

interface CoordinationSnapshot {
  selectedRefs: EntityRef[]
  focusedEntity: EntityRef | null
  highlightedDependents: EntityRef[]
}

interface CoordinationBus {
  emit(event: CoordinationEvent): void
  subscribe(kind: CoordinationEventKind, handler: (e: CoordinationEvent) => void): () => void
  getSnapshot(): CoordinationSnapshot
}
```

### Three-Tier Selection Flow

1. **Bus (immediate):** View emits `selection_changed` → other views highlight
2. **Store (next tick):** Bus listener updates `viewState.inspectedRefs` in Zustand
3. **URL (debounced, browser only):** Query params update for deep linking

### Echo Prevention

Every event carries a `correlation_id`. When a view receives an event, it checks if the `correlation_id` matches one it recently emitted — if so, it ignores it.

### React Hook

```typescript
function useCoordinationHandler(
  kind: CoordinationEventKind,
  handler: (event: CoordinationEvent) => void
): void
```

Created once at app init (singleton module). Views subscribe via the hook, unsubscribe on unmount.

---

## Phase 1: App Shell & Structural Screens

### Component Tree

```
App
├─ PlatformProvider          // detects tauri vs browser
├─ StoreProvider             // Zustand store context
├─ AppLayout
│  ├─ Sidebar
│  │  ├─ SidebarHeader       // logo + app name
│  │  ├─ NavSection "APP"
│  │  │  └─ NavItem × 4      // Board, Games, Players, Evidence
│  │  ├─ NavDivider
│  │  ├─ NavSection (game name, conditional)
│  │  │  └─ NavItem × 5      // Graph, Matrix, Tree, Evidence, Play
│  │  └─ NavItem "Settings"  // bottom-pinned
│  ├─ MainArea
│  │  ├─ TopBar              // breadcrumb + toolbar (undo/redo/save)
│  │  └─ ViewRouter          // switches content by activeView
│  │     ├─ WelcomeScreen
│  │     ├─ WorkflowBoard
│  │     ├─ PlayersRegistry
│  │     ├─ EvidenceLibrary
│  │     ├─ EmptyState        // new game / no AI variants
│  │     └─ (Phase 2 views)
│  └─ StatusBar              // file status, save indicator
```

### Shared Design System Components

| Component | Purpose |
|---|---|
| `Button` | Primary (amber fill) / Secondary (outline) |
| `Badge` | Status/type label with colored background |
| `ConfidenceBadge` | Colored dot + numeric value |
| `StaleBadge` | Warning triangle + "STALE" text |
| `EstimateValue` | Value display + inline confidence badge |
| `Card` | Titled container with slot for content |
| `NavItem` | Sidebar navigation item with icon, label, active state |
| `Breadcrumb` | Path navigation (Games > Ukraine-Russia > Matrix) |
| `ViewTab` | Tab bar item with icon, active border |
| `StatusBar` | Bottom bar with file/solver/connection status |

### Welcome Screen

- 4 action cards: Create New Analysis, Open File, Load Example, Connect AI Client
- Recent files list from `FileService.getRecentFiles()`
- Version footer
- "Connect AI" shows disabled state with "Continue Without AI" option

### Workflow Board

- Kanban columns are **derived from game state**, not a separate status field:
  - **Draft** — game exists but has no formalizations
  - **Modeling** — game has at least one formalization, but none are complete (missing required payoffs/structure)
  - **Formalized** — at least one formalization is complete (all required fields populated)
  - **In Play** — game has an active play session (deferred until Play View is built; column hidden for M3)
  - **Review** — game status is `'resolved'` or `'paused'`
- The column derivation is a pure selector (`useWorkflowColumns()`) — no new L1 fields needed
- Game cards showing: name, status badges, player count, formalization count
- Filter by status, Sort controls
- "+ Add" button opens create game wizard
- Click card → sets `activeGameId`, navigates to Graph view

### Players Registry

- Card grid of all players across all games
- Each card: name, player type badge, game count, brief description
- "+ Add Player" dispatches `add_player` command via creation form
- Click card → inspects player in context

### Evidence Library

> **Design addition:** This is an app-level cross-game evidence view not covered by any session contract. Session 3.3 covers game-scoped evidence notebook; this provides a global view across all games for cross-referencing and discovery.

- Tab filter: All / Sources / Claims / Assumptions
- Each item: title, type badges, confidence dot, stale badge
- Text search across all evidence fields
- "+ Add Source" dispatches `add_source` command

---

## Phase 2: Analytical Views

Built in dependency order: 2A → 2B → 2C → 2D → 2E.

### 2A: Graph View + Coordination Bus (Session 3.2)

**Graph View:**
- Scoped to the active formalization's `GameNode`/`GameEdge` entities (per session 3.2)
- React Flow canvas with custom node components:
  - `DecisionNode` — square, player label, action list
  - `ChanceNode` — diamond shape, probability edges
  - `TerminalNode` — rounded rectangle, payoff estimates
- Custom edge type: `GameEdge` (solid, action labels)
- Cross-game links and derivation edges are **not** rendered on the main graph canvas — they belong to the evidence notebook (session 3.3) and a future cross-game overlay. This keeps the graph focused on strategic structure per the "modeling" design priority.
- Player list shown as a sidebar legend (not as graph nodes), colored to match node borders
- Stale badges on nodes (data-driven from store via `useIsStale()`)
- Inspector panel on right: entity details, clickable evidence links

**Coordination Bus:** (see Coordination Bus section above)

### 2B: Evidence Notebook (Session 3.3)

- Game-scoped evidence view showing the evidence ladder
- Cards for each evidence type: Sources → Observations → Claims → Inferences → Assumptions
- Contradiction cards: paired left/right claims with resolution status
- Derivation chain: inline upstream/downstream graph per entity
- Cross-view sync: select evidence → graph highlights referencing nodes; click evidence link in graph inspector → notebook scrolls to it
- Selector: `useEvidenceLadder()` — extracts and sorts evidence by type
- Selector: `useDerivationChain()` — walks DerivationEdge entities

### 2C: Matrix View + Tree View (Session 3.4)

**Formalization-Aware Payoff Editing:**

Payoffs live in different places depending on formalization type:
- **Normal-form:** `formalization.payoff_cells[i].payoffs[player_id]` — payoffs are on the formalization entity, not nodes
- **Extensive-form:** `game_node.terminal_payoffs[player_id]` — payoffs are on terminal nodes

The existing M2 `update_payoff` command only writes `node.terminal_payoffs` (reducer.ts:135). For M3 we need to either:
1. Add a new `update_normal_form_payoff` command that writes to `formalization.payoff_cells`, or
2. Extend `update_payoff` with a discriminated payload that handles both paths

**Decision:** Add `update_normal_form_payoff` as a new structural command. This keeps the reducer logic clean (each command handles one mutation path) and avoids overloading `update_payoff` with formalization-type awareness.

```typescript
// New command for normal-form payoff editing
{ kind: 'update_normal_form_payoff'
  payload: {
    formalization_id: string
    cell_index: number         // index into payoff_cells array
    player_id: string
    value: EstimateValue
  }
}
```

**Matrix View (Normal-Form):**
- Strategy profiles as rows/columns (from `formalization.payoff_cells`)
- Cells display `EstimateValue` with confidence badge
- Click cell → opens `EstimateEditor` inline
- All edits dispatch `update_normal_form_payoff` commands (writes to formalization, not nodes)
- Selector: `useNormalFormViewModel()` — reads from the active formalization's `payoff_cells`

**Tree View (Extensive-Form):**
- React Flow with custom top-down tree layout algorithm
- Decision nodes: player label + available actions
- Chance nodes: diamond shape + probability on edges
- Terminal nodes: payoff estimate display
- Payoff editing dispatches the existing `update_payoff` command (writes to `node.terminal_payoffs`)
- Information set grouping: dashed boxes around same-set nodes (view-only)
- Inspector panel: node details, assumptions, inline payoff editing
- Selector: `useExtensiveFormViewModel()`

**EstimateEditor (shared by both views):**
- Fields: value, representation type (cardinal_estimate/ordinal/range), confidence, rationale, source_claims
- Also displays (read-only): `supporting_inferences`, `assumptions`, `latent_factors` when present
- Rejects save without rationale and confidence (bare numbers are bugs)
- **Uses merge semantics, not replace:** editor reads the full existing `EstimateValue`, lets the user edit the display fields, and produces a new `EstimateValue` that preserves all fields not shown in the editor (supporting_inferences, assumptions, latent_factors). This prevents silent stripping of provenance data from L1.

### 2D: Timeline + Player Lens + Diff (Session 3.5)

**Timeline View:**
- Events grouped by axis: `event_time` (real-world dates), `model_time` (move indices), `evidence_update` (model changes)
- Swimlane layout per axis
- Read-only derived view

**Player Lens View:**
- Per-player strategic summary
- Games involved, objectives, pressure points (stale inputs, adverse cross-game effects), cross-game exposure
- Read-only; editing in graph/matrix

**Diff View:**
- Change log from in-memory event log (SQLite-backed in M4+)
- Shows: created, updated, deleted, marked_stale, stale_cleared
- Field-level diffs for updates
- Cascade causality tracking (`root_cause_event_id`)
- Time-range and entity-type filtering

### 2E: Manual Modeling (Session 3.6)

**Creation Wizards:**

Complete creation flows for all canonical entity types needed to hand-build a model:

| Entity | Form | Context |
|---|---|---|
| `StrategicGame` | Name, description, labels, status | Workflow Board / sidebar |
| `Player` | Name, player type, description | Players Registry / game context |
| `GameNode` | Type (decision/chance/terminal), player, actions, payoffs | Graph View / Tree View canvas |
| `GameEdge` | Source node, target node, action label, probabilities | Graph View / Tree View canvas |
| `Formalization` | Kind (normal/extensive/repeated/coalition/bayesian), game ref | Game context menu |
| `Source` | Title, URL, date, reliability | Evidence notebook / library |
| `Observation` | Content, source ref | Evidence notebook |
| `Claim` | Statement, source refs, confidence | Evidence notebook |
| `Inference` | Statement, supporting claims, confidence | Evidence notebook |
| `Assumption` | Statement, confidence, rationale | Evidence notebook / inspector context menu |
| `Contradiction` | Left/right claims, resolution status | Evidence notebook |
| `LatentFactor` | Name, description | Evidence notebook |
| `CrossGameLink` | Source game, target game, effect type, description | "Link Games" panel |
| `Scenario` | Name, description, assumption overrides | Scenario view |
| `Playbook` | Name, description, scenario refs | Scenario view |

Each wizard validates with Zod before dispatching. After creation → select new entity in inspector, scroll to it.

**Inline Editing:**
- Inspector panel gains edit mode for entity fields appropriate to each type
- Evidence notebook gains create/edit capability for all evidence types
- Relationship linking: "Link Games" panel for cross-game links, "Add Assumption" context menu
- All edits dispatch `update_*` commands through the command spine

**Empty States:**
- New game: "Start Building Your Game" with Add Player + Add Decision Node buttons
- No AI: message explaining manual-only mode with "Setup Guide" and "Continue Without AI"

**Keyboard Workflows:**
- Tab between fields, Enter to submit, Escape to cancel

**Input Types:**

Input types are **analyst-facing** — they expose only the fields a user fills in during creation, not raw entity schemas. System-managed fields (id, stale_markers, timestamps, invalidators) are excluded. Kind-specific sub-structures are handled by the wizard's step flow, not by a flat Omit.

```typescript
// These are purpose-built input types, NOT raw Omit<Entity, 'id'>.
// Each maps to what the creation wizard actually collects.

interface CreateGameInput {
  name: string
  description: string
  labels: SemanticGameLabel[]
  status: GameStatus                    // defaults to 'active'
}

interface CreatePlayerInput {
  name: string
  player_type: PlayerType
  description?: string
  game_ids: string[]                    // which games this player participates in
}

interface CreateGameNodeInput {
  formalization_id: string
  node_type: 'decision' | 'chance' | 'terminal'
  label: string
  player_id?: string                    // for decision nodes
  terminal_payoffs?: Record<string, EstimateValue>  // for terminal nodes
}

interface CreateGameEdgeInput {
  formalization_id: string
  source_node_id: string
  target_node_id: string
  action_label?: string
  probability?: EstimateValue           // for chance edges
}

// ... similar analyst-facing types for all other entities
// Full definitions derived during implementation from M1 schemas
```

Builder functions (`buildCreateGameCommand()`, `buildCreatePlayerCommand()`, etc.) accept these input types, fill in defaults and system fields, and return a typed `Command` ready for dispatch.

---

## Testing Strategy

### Unit Tests (Vitest)

- Zustand store actions: dispatch, undo/redo, load/save
- Coordination bus: emit, subscribe, echo prevention, snapshot
- Platform abstraction: browser adapter with mock APIs, Tauri adapter with mocked `@tauri-apps/api`
- Selectors: `useNormalFormViewModel()`, `useExtensiveFormViewModel()`, `useEvidenceLadder()`, etc.
- Builder functions: `buildCreateGameCommand()` validation and command output

### Component Tests (Vitest + React Testing Library)

- Design system components render correctly
- EstimateEditor rejects bare numbers
- Creation wizards validate with Zod, dispatch correct commands
- Sidebar shows/hides game section based on `activeGameId`
- ViewRouter renders correct view for each `activeView` state

### Integration Tests (Vitest)

- Full flow: create game → navigate to graph → select node → inspector shows details → edit payoff → undo
- Cross-view sync: select in graph → evidence notebook highlights → clear
- File round-trip: new analysis → add entities → save → reload → verify state

### E2E Tests (Playwright, late M3)

- Welcome screen → open fixture → navigate views → edit → save
- Browser mode file picker flow

### Coverage Target

80%+ on non-UI logic (store, bus, selectors, builders, platform). Component tests for key interactions. E2E for critical user paths.

---

## File Organization

```
src/
├─ platform/
│  ├─ types.ts              // Platform, FileService, ShellService interfaces
│  ├─ detect.ts             // platform detection
│  ├─ tauri-file-service.ts
│  ├─ browser-file-service.ts
│  ├─ tauri-shell-service.ts
│  ├─ browser-shell-service.ts
│  └─ PlatformProvider.tsx
├─ store/
│  ├─ app-store.ts          // Zustand store definition
│  ├─ selectors/
│  │  ├─ board-selectors.ts
│  │  ├─ player-selectors.ts
│  │  ├─ evidence-selectors.ts
│  │  ├─ normal-form-selectors.ts
│  │  ├─ extensive-form-selectors.ts
│  │  └─ timeline-selectors.ts
│  └─ StoreProvider.tsx
├─ coordination/
│  ├─ bus.ts                // CoordinationBus singleton
│  ├─ types.ts              // event types
│  └─ hooks.ts              // useCoordinationHandler
├─ components/
│  ├─ design-system/        // Badge, Button, Card, ConfidenceBadge, etc.
│  ├─ layout/               // AppLayout, Sidebar, TopBar, StatusBar, ViewRouter
│  ├─ shell/                // WelcomeScreen, WorkflowBoard, PlayersRegistry, EvidenceLibrary
│  ├─ views/                // GraphView, MatrixView, TreeView, EvidenceNotebook, Timeline, PlayerLens, DiffView
│  ├─ editors/              // EstimateEditor, creation wizards, inline edit forms
│  └─ inspector/            // InspectorPanel, entity detail renderers
├─ engine/                  // (existing M2 code)
├─ types/                   // (existing M1 code)
└─ utils/                   // (existing M1 code)
```
