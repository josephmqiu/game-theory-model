# Game Theory Analysis Platform — v3 Specification

**Date:** 2026-03-14
**Status:** Approved

## Project overview

An open-source, local-first desktop application for **AI-assisted game theory analysis of world events**. Users input an event or live situation (for example: a regional war, sanctions spiral, labor strike, antitrust fight, alliance fracture, or leadership crisis), and the app helps them:

1. **Model** the strategic situation as linked games, players, objectives, constraints, beliefs, and possible moves.
2. **Visualize** the structure through synchronized graph, matrix, tree, timeline, player, evidence, scenario, and play views.
3. **Play out** the game by branching through plausible action sequences, letting the user and/or AI control actors turn-by-turn, and tracing how choices cascade across linked games.
4. **Update** the model when new information arrives, with a visible audit trail of what changed, why it changed, and which predictions were invalidated.
5. **Compute** formal results where the model is sufficiently specified, while making it impossible to confuse "math on assumptions" with robust inference.

This product exists because real-world strategic analysis breaks chat interfaces. Analysts need persistent structure, explicit provenance, editable assumptions, multiple formal lenses, and a way to explore branching futures without losing the chain of reasoning.

### The actual goal of the app

The app is not just "an AI that talks about game theory." It is a **strategic modeling environment** for world events.

The product must be excellent at three things:

- **Modeling:** turning messy real-world events into explicit strategic structures.
- **Visualizing:** letting users understand relationships across games, players, time, evidence, and scenarios.
- **Playing out:** letting users explore how the event could unfold under different assumptions, moves, and shocks.

If the design ever has to choose, it should optimize for those three jobs.

## Product pillars

### 1) Modeling

The app should help users convert messy reporting into a structured strategic model:

- Who are the relevant actors?
- What are they trying to optimize?
- What constraints bind them?
- What information do they have?
- What moves are available?
- Which strategic games are nested inside the broader event?
- Which assumptions are doing the most work?

### 2) Visualization

The app should make complex strategic structures comprehensible:

- multiple linked games
- cross-game dependencies
- repeated interactions over time
- evidence quality and contradictions
- uncertainty and sensitivity
- alternative formalizations of the same situation

A single graph canvas is not enough. The graph is one lens, not the whole product.

### 3) Play-out / war-gaming

The app should let users actively explore the model:

- play as one or more actors
- let AI control selected actors
- compare equilibrium play vs heuristic play vs adversarial play
- branch from any decision point
- inject shocks and new evidence
- see how beliefs, payoffs, and cross-game effects change over time

This is where the product becomes more than a static analysis notebook.

### 4) Auditability

Every estimate, scenario, and simulation step must be inspectable:

- where it came from
- what evidence supports it
- what assumptions it depends on
- what would invalidate it
- whether the formal method used is actually appropriate

### 5) Reproducibility

The app must support both lightweight sharing and full replay:

- a **shareable analysis file** for the structured model
- a **full reproducible bundle** containing source snapshots, extraction traces, prompt versions, and AI run logs

## Design philosophy

### Visible uncertainty

The single most important design principle: **computational outputs are only as good as their inputs**.

Real-world strategic analysis is usually built on a mix of observed facts, extracted claims, analytic inferences, and explicit assumptions. The app must make those layers visible, not flatten them into one authoritative-looking graph.

This means:

- assumptions are first-class objects
- contradictions are surfaced, not hidden
- every payoff/probability estimate has rationale, confidence, and dependencies
- every solver result has an applicability warning and readiness score
- every scenario shows invalidation conditions
- every simulation path shows what moved because of evidence vs inference vs assumption

### Human-in-the-loop merge authority

Subagents can propose changes. Only the orchestrator merges them into the canonical model. The user can always inspect, accept, reject, or edit those merges.

### Structure over prose

Long prose is useful, but the product's core asset is the structured model:

- games
- players
- formalizations
- nodes / edges
- evidence objects
- assumptions
- scenarios
- playbooks
- update history

### Multiple formalizations over forced simplification

The same real-world situation may be viewed as:

- a coarse normal-form game
- a more detailed extensive-form tree
- a repeated game
- a Bayesian or signaling model
- a coalition bargaining problem

v3 should explicitly support **multiple formalizations of the same strategic game**, rather than forcing everything into one representation.

### Local-first and inspectable

The app should run without a server, save plain files, and preserve user control over data, prompts, and provider routing.

## Primary analyst workflow

The design should optimize for one default workflow:

1. **Create analysis**
   - User enters an event or ongoing strategic situation.
   - App creates a new analysis workspace.

2. **Research + source capture**
   - AI gathers sources and snapshots them.
   - User sees an evidence notebook, not just a summary.

3. **Evidence normalization**
   - Sources become observations.
   - Observations become claims.
   - Claims may support or contradict each other.
   - Inferences and assumptions are created explicitly.

4. **Game identification**
   - AI proposes strategic games, players, strategic labels, and candidate formalizations.
   - User approves / edits / merges.

5. **Formalization**
   - User and AI refine payoff structures, beliefs, information sets, timing, and cross-game links.
   - Multiple views stay synchronized.

6. **Readiness check**
   - Before any solver runs, the app checks whether the model is actually formal enough for that method.
   - Missing inputs and weak assumptions are surfaced.

7. **Compute**
   - Solvers run only on eligible formalizations.
   - Every result comes with sensitivity analysis and applicability notes.

8. **Scenario generation**
   - AI proposes plausible paths through the model, with assumptions and invalidators.
   - User compares them in Scenario view.

9. **Play-out**
   - User launches a play session.
   - Humans and/or AI control actors.
   - Branches, shocks, belief updates, and cross-game cascades are recorded.

10. **Update**
    - New evidence arrives.
    - The app traces what changed, what became stale, and which scenarios or playbooks need revision.

11. **Export / share**
    - Export a lightweight analysis file or a full reproducible bundle.

That is the canonical product loop.

## Tech stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | **Tauri 2.0** (Rust) | Local-first native app, secure keychain access, filesystem access, no server required. |
| UI framework | **React + Vite** (TypeScript) | Fast iteration, strong TS tooling, no server assumption. |
| State management | **Zustand** | Lightweight global state across synchronized views. |
| Graph editor | **React Flow** | Best-in-class node/edge interaction for strategic graphs. |
| Structured editors | **TanStack Table + custom editors** | Matrix editing, evidence tables, scenario comparison. |
| Text editors | **CodeMirror / Monaco** | Prompt workbench, structured JSON inspection. |
| Validation | **Zod** | Runtime schema validation for files, diffs, and AI outputs. |
| Persistence | **Local JSON + SQLite** | JSON for canonical model; SQLite for snapshots, logs, caches, and reproducibility artifacts. |
| Computation | **TypeScript + Rust/WASM + Web Workers** | TS for most algorithms; Rust/WASM for larger solvers; workers for non-blocking UI. |
| Distribution | `tauri build` | Native binaries for macOS, Windows, Linux. |

### Key dependencies

```text
react, react-dom
reactflow
zustand
@tanstack/react-table
zod
@tauri-apps/api
@tauri-apps/plugin-sql
@tauri-apps/plugin-store
```

## Architecture

### Runtime data layers

The runtime model remains a three-layer system:

#### Layer 1 — Canonical analysis data
The "truth" of the analysis:

- strategic games
- formalizations
- players
- nodes / edges
- sources
- observations
- claims
- inferences
- assumptions
- contradictions
- latent factors
- cross-game links
- analyst-authored scenarios / playbooks

This is the part that is versioned, saved, diffed, and shared.

#### Layer 2 — View state
UI-only state:

- graph positions
- zoom level
- selected view
- panel layout
- expanded/collapsed sections
- pinned comparisons
- local filters

This is never part of the canonical analysis file.

#### Layer 3 — Derived results / runtime cache
Regeneratable outputs:

- solver results
- sensitivity runs
- belief updates
- scenario rankings
- simulation outcomes
- AI-generated summaries
- stale / fresh dependency statuses
- readiness reports

This is derived from Layer 1 + selected runtime settings and should never be treated as canonical truth.

### Command/Event Spine & Undo/Redo

#### Core Concept

Every mutation to the canonical model is a named command that produces an immutable event. The event log is the undo stack, the audit trail, and the sync trigger.

#### Commands

Commands are the input — a typed instruction to mutate the model:

```typescript
interface BaseCommand {
  base_revision?: number  // event log cursor at time of creation
}

type Command = BaseCommand & (
  // Entity CRUD — one variant per entity type in CanonicalStore.
  // The full list is derived mechanically: for each entity type E,
  // generate add_E, update_E, delete_E variants.
  | { kind: 'add_claim'; payload: Omit<Claim, 'id'>; id?: string }
  | { kind: 'update_claim'; payload: { id: string } & Partial<Claim> }
  | { kind: 'delete_claim'; payload: { id: string } }
  | { kind: 'add_assumption'; payload: Omit<Assumption, 'id'>; id?: string }
  | { kind: 'update_assumption'; payload: { id: string } & Partial<Assumption> }
  | { kind: 'delete_assumption'; payload: { id: string } }
  | { kind: 'add_game'; payload: Omit<StrategicGame, 'id'>; id?: string }
  | { kind: 'update_game'; payload: { id: string } & Partial<StrategicGame> }
  | { kind: 'delete_game'; payload: { id: string } }
  // ... (same pattern for all 16 entity types in CanonicalStore)
  // Formalization commands must include the `kind` discriminant in the payload
  // so the reducer and integrity layer know which subtype-specific fields and
  // refs to validate. Example: add_formalization with kind: 'extensive_form'
  // triggers validation of root_node_id; kind: 'normal_form' does not.

  // Structural commands
  | { kind: 'update_payoff'; payload: { node_id: string; player_id: string; value: EstimateValue } }
  | { kind: 'mark_stale'; payload: { id: string; reason: string } }
  | { kind: 'clear_stale'; payload: { id: string } }
  | { kind: 'remove_player_from_game'; payload: { game_id: string; player_id: string } }

  // Cross-game
  | { kind: 'apply_cascade_effect'; payload: ApplyCascadePayload }

  // Play-out promotion
  | { kind: 'promote_play_result'; payload: PromotePlayPayload }

  // Batch
  | { kind: 'batch'; commands: Command[]; label: string }
)

// Derivation rule: at implementation time, a code generator produces
// add/update/delete variants for every key in CanonicalStore.
// The examples above are representative, not exhaustive.
```

#### Events

Events are the output — an immutable record of what actually changed:

```typescript
interface ModelEvent {
  id: string
  timestamp: string
  command: Command
  patches: ReadonlyArray<Patch>              // JSON Patch (RFC 6902) diffs
  inverse_patches: ReadonlyArray<Patch>      // For undo
  integrity_actions: ReadonlyArray<IntegrityAction>
  source: 'user' | 'ai_merge' | 'solver' | 'play_session'
  metadata?: Record<string, unknown>
}
```

#### Dispatch Cycle

```
Command received
  → Pre-validation (structural checks on command itself)
  → Reducer produces candidate state + patches
  → Integrity reactor expands cascades into batch
  → Reducer re-applies with full batch → final candidate state
  → Post-validation on candidate state (invariants)
  → If post-validation fails → reject, nothing committed
  → If passes → COMMIT: event pushed to log, Zustand store updated
  → THEN: coordination bus fires any relevant signals
```

Key: the integrity reactor runs **before** commit. Its output is folded into the command as a `batch`. What gets committed is the complete atomic unit — the user's original intent plus all cascading consequences. There is no "command commits, then cleanup runs separately."

#### Undo/Redo

The event log is append-only for audit. Undo/redo uses a cursor:

```typescript
interface EventLog {
  readonly events: ReadonlyArray<ModelEvent>
  cursor: number  // state = apply(events[0..cursor])
}
```

- Undo = move cursor back, apply `inverse_patches`
- Redo = move cursor forward, re-apply `patches`
- Batch commands undo as one unit
- New edits after an undo truncate forward history (standard behavior)
- Truncated events can be archived for full audit

#### Revision Protection

Commands carry `base_revision` — the event log cursor at time of creation.

On dispatch:
- If `base_revision` matches current cursor → apply normally
- If model has moved forward → attempt rebase: re-run integrity checker against current state
  - If still passes → apply
  - If conflicts → reject with diff showing what changed since the proposal was generated
- User/AI can revise and resubmit

#### Dry Run

Preview and commit use the identical code path:

```typescript
type DispatchResult =
  | {
      status: 'committed'
      event: ModelEvent                        // the committed event
      new_cursor: number                       // updated event log cursor
    }
  | {
      status: 'dry_run'
      event: ModelEvent                        // what would be committed
      impact_report?: ImpactReport             // cascade preview for deletes
    }
  | {
      status: 'rejected'
      reason: 'validation_failed' | 'revision_conflict' | 'invariant_violated' | 'error'
      errors: string[]
      revision_diff?: { expected: number; actual: number }
    }

function dispatch(command: Command, opts?: { dryRun: boolean }): DispatchResult {
  // Same validation, same reducer, same integrity reactor
  // dryRun = true → returns dry_run result without committing
  // Failure → returns rejected with reason
}
```

The cascade-warning UI calls `dispatch(cmd, { dryRun: true })` to show the impact graph.

#### Event Log Scope

The event log tracks Layer 1 (canonical) mutations only:
- Solver results (Layer 3) are derived and regeneratable — no undo needed
- Play sessions have their own turn log
- A play-session outcome can be promoted to canonical via a `promote_play_result` command (see below)

#### Event Log Persistence

The event log serves two purposes with different persistence requirements:

**Undo/redo (session-scoped):** The in-memory event log with cursor is rebuilt fresh on each app launch. Undo history does not survive restarts. This is standard behavior for document editors — undo is a session concept, not a file concept.

**Audit trail (workspace-scoped):** For audit, replay, and "what changed when" inspection, committed events are appended to the SQLite workspace database:

```typescript
// SQLite table: canonical_events
interface PersistedEvent {
  id: string
  timestamp: string
  command_json: string                       // serialized Command
  patches_json: string                       // serialized JSON Patches
  source: 'user' | 'ai_merge' | 'solver' | 'play_session'
  analysis_id: string                        // which analysis this belongs to
}
```

This gives the app full mutation history for:
- Diff view ("what changed since last week")
- Bundle export (events are included in `.gtbundle` for replay)
- Cost tracking (correlating events with AI phase executions)

The persisted event log is append-only and never truncated by undo. It is a superset of the in-memory event log.

On app launch, the canonical state is loaded from `.gta.json` (the snapshot), not by replaying events. Events in SQLite are historical records, not the source of truth for current state.

#### Promote Play Result

When an analyst wants to make a play-session outcome canonical:

```typescript
interface PromotePlayPayload {
  session_id: string
  branch_id: string
  turn_id: string
  base_revision: number
  promoted_effects: Array<{
    target: EntityRef
    field: TargetField
    value: unknown
    rationale: string
  }>
}
```

This creates a batch command that applies the selected effects to Layer 1 through the normal dispatch cycle (integrity checks, undo stack, audit trail). Only explicitly selected effects are promoted — not the entire session state.

On promotion, `base_revision` is compared to the current event log cursor. If the model has moved since the session started, the system attempts rebase (same as command revision protection). If rebase fails due to conflicts, the user is shown what changed and asked to resolve.

#### Apply Cascade Effect

When an analyst accepts resolved cross-game effects from cascade analysis:

```typescript
interface ApplyCascadePayload {
  analysis_run_id: string
  accepted_effects: Array<{
    resolver_output: ResolverOutput
    target: EntityRef
    field: TargetField
  }>
}
```

This also becomes a batch command through normal dispatch.

#### Error Recovery in Dispatch

If the reducer throws an unexpected error (not a validation failure):
- The candidate state is discarded
- The store is not modified
- The event is not recorded
- The error is surfaced to the user with full context (command, error message, stack)
- The command can be retried or abandoned

The dispatch function wraps the entire reduce-validate-commit cycle in a try/catch. No partial state is ever committed.

#### Key Constraints

- Commands are serializable (important for reproducibility bundles)
- Events are append-only (never mutated after creation)
- `batch` commands enable atomic multi-entity operations
- The AI propose-merge flow emits a `batch` command that the user reviews before dispatch

### Persistence and reproducibility boundary

v3 makes the portability boundary explicit.

#### 1) Shareable analysis file (`.gta.json`)
A lightweight, human-readable artifact containing Layer 1 canonical data only.

Use this when you want to:
- send someone the model
- version it in git
- inspect / edit it manually
- share without bundling all raw evidence snapshots

#### 2) Reproducible bundle (`.gtbundle`)
A zipped bundle containing:

- the canonical analysis file
- source snapshots (HTML, PDF text, extracted content)
- prompt versions used
- AI run logs and structured diffs
- extraction outputs
- checksums / bundle manifest
- optional saved play sessions and rendered reports

Use this when you want to:
- replay an analysis
- audit what the AI saw
- debug differences across runs
- preserve a world-event analysis at a specific point in time

#### 3) Local workspace database (SQLite)
The working storage for:
- source cache
- execution logs
- temporary staging diffs
- pending merges
- replay metadata
- prompt history
- run costs / quotas

### Schema Migration

#### Schema Format Version

Monotonic integer, not semver:

```typescript
interface SchemaVersion {
  format: number                             // 1, 2, 3, 4, ...
  schema: ZodType<AnalysisFile>
  normalize: (data: AnalysisFile) => AnalysisFile  // materializes all defaults
  released_at: string
  breaking: boolean
}

const SCHEMA_REGISTRY: SchemaVersion[] = [
  { format: 1, schema: analysisFileV1, normalize: normalizeV1, released_at: '2026-04-01', breaking: false },
  // ...
]

function getSchema(format: number): SchemaVersion {
  const entry = SCHEMA_REGISTRY.find(s => s.format === format)
  if (!entry) throw new MigrationError(`No schema registered for format ${format}`)
  return entry
}
```

In the `.gta.json` file: `"schema_version": 3`.

#### Three Categories of Change

| Category | Example | Handling |
|---|---|---|
| Additive | New optional field, new enum value | Auto-migrated via normalize function |
| Breaking | Field rename, type change, structural reshape | Hand-written `MigrationTransform` |
| Removal | Field or entity type removed | Hand-written lossy transform |

#### Migration Transforms

```typescript
interface MigrationTransform {
  from: number
  to: number
  description: string
  lossy: boolean
  discarded_fields?: string[]
  transform: (data: unknown) => { result: unknown; discarded?: Record<string, unknown> }
}

const MIGRATIONS: MigrationTransform[] = [
  // Every version step must have an entry, even identity transforms
]
```

#### Strict Migration Path

Every intermediate step must exist. No skip-ahead:

```typescript
function buildMigrationPath(from: number, to: number): MigrationTransform[] {
  const path: MigrationTransform[] = []
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS.find(m => m.from === v && m.to === v + 1)
    if (!step) {
      throw new MigrationError(`Missing migration from schema ${v} to ${v + 1}.`)
    }
    path.push(step)
  }
  return path
}
```

#### Load Pipeline with Per-Step Validation

```typescript
async function migrateFile(raw: unknown, from: number, to: number): Promise<MigrationResult> {
  const path = buildMigrationPath(from, to)
  let data = raw
  const stepResults: StepResult[] = []

  const allDiscarded: MigrationResult['discarded_data'] = []

  for (const step of path) {
    const { result, discarded } = step.transform(data)
    data = result

    if (step.lossy && discarded) {
      allDiscarded.push({
        step: { from: step.from, to: step.to },
        description: step.description,
        fields: step.discarded_fields ?? [],
        values: discarded,
      })
    }

    const validation = getSchema(step.to).schema.safeParse(data)

    if (!validation.success) {
      return {
        status: 'migration_failed',
        failed_at_step: { from: step.from, to: step.to },
        description: step.description,
        errors: validation.error.issues,
        partial_data: data,
      }
    }

    data = getSchema(step.to).normalize(validation.data)
    stepResults.push({ from: step.from, to: step.to, status: 'ok' })
  }

  return {
    status: 'success',
    data,
    steps_applied: stepResults,
    discarded_data: allDiscarded.length > 0 ? allDiscarded : undefined,
  }
}
```

When `from === to` (file is already at current version), the migration pipeline is skipped but the file is still validated and normalized through the current schema. This ensures that even current-version files with structural issues are caught on load.

#### Unknown Future Versions

```typescript
if (version > currentMax) {
  return {
    status: 'unsupported_version',
    file_version: version,
    app_version: currentMax,
    message: 'This file requires a newer app version. Update or open in recovery mode.',
    recovery_available: true,
  }
}
```

#### Explicit Normalization

Each schema version registers a `normalize` function that materializes all defaults into concrete values. No reliance on Zod `.optional()` to fill gaps. Saved files always have all fields present.

#### Lossy Migration Tracking

When a transform discards data, the discarded values are collected and surfaced:

```typescript
type MigrationResult =
  | {
      status: 'success'
      data: AnalysisFile
      steps_applied: StepResult[]
      discarded_data?: Array<{
        step: { from: number; to: number }
        description: string
        fields: string[]
        values: Record<string, unknown>
      }>
    }
  | {
      status: 'migration_failed'
      failed_at_step: { from: number; to: number }
      description: string
      errors: unknown[]                        // Zod validation issues
      partial_data: unknown                    // raw JSON at point of failure
    }
  | {
      status: 'unsupported_version'
      file_version: number
      app_version: number
      message: string
      recovery_available: true
    }

interface StepResult {
  from: number
  to: number
  status: 'ok'
}
```

The UI shows a non-dismissable notice listing what was lost and where to find it in the backup.

#### Atomic Save

```typescript
async function saveAnalysis(filepath: string, data: AnalysisFile): Promise<void> {
  const tempPath = `${filepath}.tmp.${Date.now()}`
  const backupPath = `${filepath}.backup`

  await writeFile(tempPath, JSON.stringify(data, null, 2))

  // Verify temp file by re-parsing
  const verification = currentSchema.safeParse(JSON.parse(await readFile(tempPath, 'utf-8')))
  if (!verification.success) {
    await removeFile(tempPath)
    throw new SaveError('Written file failed verification — save aborted')
  }

  // Backup existing, then atomic rename
  if (await fileExists(filepath)) await copyFile(filepath, backupPath)
  await renameFile(tempPath, filepath)
}
```

#### Recovery Mode

When migration fails, shows:
- File version and which step failed
- Transform description
- Zod validation errors
- Raw JSON in read-only editor
- Option to export individual entities for manual recovery

### Multi-view UX strategy

The product should expose multiple synchronized views, each optimized for a different job.

| View | Purpose | Best for |
|------|---------|----------|
| **Graph view** | Shows linked games, players, and dependencies as clusters | Orientation, navigation, cross-game structure |
| **Matrix view** | Edits and inspects normal-form representations | Strategy comparison, payoff editing, equilibrium inspection |
| **Tree view** | Displays extensive-form structures | Sequential reasoning, information sets, backward induction |
| **Timeline view** | Distinguishes real-world chronology from model turns | Repeated games, escalation sequences, update history |
| **Player lens** | Re-centers the model around one actor | Objectives, constraints, beliefs, pressure points |
| **Evidence notebook** | Shows source snapshots, observations, claims, contradictions | Auditing, trust, research review |
| **Scenario view** | Compares approved future paths | Forecast review, invalidators, branch comparison |
| **Play view** | Interactive war-game / sandbox mode | Turn-by-turn simulation, branch exploration, mixed human+AI play |
| **Diff view** | Shows how the model changed after new evidence or edits | Update tracking, review, QA |

Views are synchronized. Selecting a node, player, scenario, or assumption in one view should highlight corresponding objects across the others.

### View Synchronization — Hybrid Model

#### Two Systems, Two Jobs

| System | Job | Trigger | Mechanism |
|---|---|---|---|
| Zustand selectors | Data-driven re-renders | Command commits → store updates | React re-render via selector equality |
| Coordination bus | Cross-view UX signals | User interaction | Imperative event dispatch, no re-render |

#### Zustand Selectors — Narrow and Memoized

Views subscribe to the narrowest possible slice:

```typescript
// GraphView: only nodes/edges for the active game
const graphViewModel = useAnalysisStore(
  useShallow(s => {
    const gameId = s.viewState.activeGameId
    if (!gameId) return null
    const game = s.games[gameId]
    if (!game) return null
    const formIds = new Set(game.formalizations)
    return {
      gameId,
      nodes: pickBy(s.nodes, n => formIds.has(n.formalization_id)),
      edges: pickBy(s.edges, e => formIds.has(e.formalization_id)),
      links: pickBy(s.cross_game_links, l =>
        l.source_game_id === gameId || l.target_game_id === gameId),
    }
  })
)
```

For large analyses, per-entity subscriptions:

```typescript
// Subscribe to ID list (changes rarely)
const nodeIds = useAnalysisStore(
  s => Object.keys(pickBy(s.nodes, n => n.formalization_id === activeFormId)),
  shallowArrayEqual
)

// Individual components subscribe to their own entity
function GraphNode({ id }: { id: string }) {
  const node = useAnalysisStore(s => s.nodes[id])
  // Only re-renders when THIS node changes
}
```

#### Selection Lives in Three Places

| Concern | Where | Why |
|---|---|---|
| Cross-view highlighting | Coordination bus | Ephemeral, imperative |
| Inspector panel content | Zustand `viewState.inspectedRefs` | Drives React UI, survives view switches |
| Deep-linking | URL search params | Survives reload, enables sharing |

**Precedence on mount/navigation:** URL params are the restore source on page load and deep-link navigation. On mount, a view reads `inspectedRefs` from the Zustand store (which was hydrated from the URL), then calls `bus.getSnapshot()` for ephemeral highlight state. During normal interaction, user clicks update all three in sequence: bus (immediate), store (next tick), URL (debounced). The URL is always the source of truth for what survives a refresh.

```typescript
type ViewType =
  | 'graph'
  | 'matrix'
  | 'tree'
  | 'timeline'
  | 'player_lens'
  | 'evidence_notebook'
  | 'scenario'
  | 'play'
  | 'diff'

interface ViewState {
  activeGameId: string | null
  activeFormalizationId: string | null
  inspectedRefs: ReadonlyArray<EntityRef>
  activeView: ViewType
}
```

#### Coordination Bus

```typescript
// All events carry base fields for routing and dedup
interface BaseCoordinationEvent {
  correlation_id: string
  source_view: string
}

type CoordinationEvent = BaseCoordinationEvent & (
  | { kind: 'selection_changed'; refs: EntityRef[] }
  | { kind: 'focus_entity'; ref: EntityRef }
  | { kind: 'scroll_to'; ref: EntityRef }
  | { kind: 'highlight_dependents'; root: EntityRef; depth: number }
  | { kind: 'highlight_clear' }
  | { kind: 'view_requested'; view: ViewType; context?: EntityRef }
  | { kind: 'stale_entities_changed'; refs: EntityRef[] }
)
```

#### Feedback Loop Prevention

Views use correlation IDs to prevent echo loops:

```typescript
function useCoordinationHandler(
  kind: CoordinationEvent['kind'],
  viewName: string,
  handler: (event: CoordinationEvent) => void
) {
  const processed = useRef(new Set<string>())
  useEffect(() => {
    return coordinationBus.subscribe(kind, (event) => {
      if (event.source_view === viewName) return
      if (processed.current.has(event.correlation_id)) return
      processed.current.add(event.correlation_id)
      handler(event)
    })
  }, [kind, viewName, handler])
}
```

#### Late-Mount Sync

The bus maintains a lightweight snapshot for newly-mounted views:

```typescript
interface CoordinationSnapshot {
  selection: ReadonlyArray<EntityRef>
  focusedEntity: EntityRef | null
  highlightedDependents: { root: EntityRef; depth: number } | null
}

class CoordinationBus {
  private currentState: CoordinationSnapshot = {
    selection: [],
    focusedEntity: null,
    highlightedDependents: null,
  }

  getSnapshot(): Readonly<CoordinationSnapshot>
}
```

#### Stale: Data First, Bus for Flash

Stale status is model state, derived from Zustand:

```typescript
function useIsStale(ref: EntityRef): StaleMarker | null {
  return useAnalysisStore(s => {
    const entity = getEntity(s, ref)
    return entity?.stale ?? null
  })
}
```

The `stale_entities_changed` bus event is only for transient UX (amber flash animation). Persistent stale badges are always driven by store data.

#### Event Ordering

Bus fires **after** store commit. Enforced in the `dispatch` function (see Command/Event Spine):

```
dispatch() internals:
  ... validate, reduce, commit ...
  store.setState(newState)                    // Zustand update first
  coordinationBus.emit(...)                   // Bus signals after
```

Views receiving bus events are guaranteed to see consistent store data.

#### What Does NOT Go on the Bus

- Model data → always Zustand
- Undo/redo → always command/event spine
- Anything that needs to survive page refresh → the bus is ephemeral

### Timeline discipline: event time vs model time

A critical distinction for world events:

- **Event time:** what happened when in the real world
- **Model time:** the order of strategic moves in a formalization
- **Simulation time:** the order in which actions are taken during a play session

These must not be conflated.

A world event can unfold over months while being represented by a compressed game tree. v3 should explicitly encode all three time notions.

### Directory structure (target)

```text
src/
├── components/
│   ├── panels/
│   │   ├── GameRegistry.tsx
│   │   ├── AIReasoning.tsx
│   │   ├── EvidencePanel.tsx
│   │   ├── ReadinessPanel.tsx
│   │   └── UpdateDiffPanel.tsx
│   ├── views/
│   │   ├── GraphView.tsx
│   │   ├── MatrixView.tsx
│   │   ├── TreeView.tsx
│   │   ├── TimelineView.tsx
│   │   ├── PlayerLens.tsx
│   │   ├── EvidenceNotebook.tsx
│   │   ├── ScenarioView.tsx
│   │   ├── PlayView.tsx
│   │   └── DiffView.tsx
│   ├── graph/
│   │   ├── nodes/
│   │   │   ├── DecisionNode.tsx
│   │   │   ├── ChanceNode.tsx
│   │   │   ├── TerminalNode.tsx
│   │   │   └── AssumptionNode.tsx
│   │   └── edges/
│   │       ├── MoveEdge.tsx
│   │       ├── CrossGameEdge.tsx
│   │       └── DerivationEdge.tsx
│   ├── uncertainty/
│   │   ├── ConfidenceBadge.tsx
│   │   ├── SensitivityPanel.tsx
│   │   ├── AssumptionList.tsx
│   │   ├── ContradictionCard.tsx
│   │   ├── InvalidationBadge.tsx
│   │   └── DependencyPanel.tsx
│   ├── simulation/
│   │   ├── TurnConsole.tsx
│   │   ├── PolicyAssignment.tsx
│   │   ├── ShockInjector.tsx
│   │   ├── BranchComparator.tsx
│   │   └── CascadeInspector.tsx
│   ├── workbench/
│   │   ├── PromptEditor.tsx
│   │   ├── PromptDiff.tsx
│   │   └── RunComparison.tsx
│   └── settings/
│       ├── ProviderConfig.tsx
│       ├── RoutingConfig.tsx
│       └── BundleExportConfig.tsx
├── engine/
│   ├── command-event.ts
│   ├── dispatch.ts
│   ├── integrity.ts
│   ├── inverse-index.ts
│   ├── migration.ts
│   ├── coordination-bus.ts
│   ├── composition.ts
│   ├── resolver.ts
│   └── playout.ts
├── ai/
│   ├── orchestrator.ts
│   ├── subagent.ts
│   ├── providers/
│   │   ├── interface.ts
│   │   ├── chatgpt-oauth.ts
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   ├── openrouter.ts
│   │   └── local.ts
│   ├── pipeline/
│   │   ├── intake.ts
│   │   ├── validate.ts
│   │   ├── research.ts
│   │   ├── evidence-normalize.ts
│   │   ├── identify.ts
│   │   ├── formalize.ts
│   │   ├── expand.ts
│   │   ├── adversarial.ts
│   │   ├── predict.ts
│   │   ├── simulate.ts
│   │   └── update.ts
│   ├── prompts/
│   │   ├── official/
│   │   └── types.ts
│   └── evidence/
│       ├── extractor.ts
│       ├── dedupe.ts
│       ├── contradiction.ts
│       └── provenance.ts
├── compute/
│   ├── nash.ts
│   ├── backward-induction.ts
│   ├── expected-utility.ts
│   ├── dominance.ts
│   ├── bayesian.ts
│   ├── cascade.ts
│   ├── dependency.ts
│   ├── sensitivity.ts
│   ├── readiness.ts
│   └── playout.ts
├── store/
│   ├── analysis.ts
│   ├── view-state.ts
│   ├── derived.ts
│   ├── staging.ts
│   ├── evidence.ts
│   ├── providers.ts
│   ├── prompts.ts
│   └── simulation.ts
├── types/
│   ├── canonical.ts
│   ├── evidence.ts
│   ├── formalizations.ts
│   ├── derived.ts
│   ├── simulation.ts
│   ├── export.ts
│   ├── view.ts
│   └── ai.ts
└── utils/
    ├── graph-serializer.ts
    ├── context-injector.ts
    ├── file-io.ts
    ├── bundle.ts
    ├── checksums.ts
    └── diff.ts
```

### Rust backend (`src-tauri/src/`)

```text
src-tauri/src/
├── main.rs
├── commands/
│   ├── file_io.rs
│   ├── bundle.rs
│   ├── oauth.rs
│   ├── keychain.rs
│   └── http.rs
└── compute/
    ├── nash_solver.rs
    └── playout_engine.rs
```

## Data model

### Key design decisions

1. **Strategic games are not identical to formal models.** A real-world game can have multiple formalizations.
2. **Semantic labels are separate from formal representations.** "Chicken" and "signaling" are interpretive strategic labels; "normal form" and "extensive form" are computational representations.
3. **Actor is a tagged union**, never a magic string.
4. **Evidence is a ladder**, not a blob: source → observation → claim → inference → assumption / estimate.
5. **Bare numbers are forbidden** for payoffs, probabilities, beliefs, and utilities.
6. **Payoff scales can be ordinal or cardinal.** The model must not force fake cardinal precision when only rank-order information exists.
7. **Latent factors are first-class objects** so correlated uncertainties can be modeled explicitly.
8. **Cross-game effects have typed semantics** and composition rules.
9. **Solver readiness is mandatory** before formal results are shown.
10. **Scenario invalidators are first-class**, not prose footnotes.
11. **Reproducibility is explicit** via `.gta.json` vs `.gtbundle`.
12. **All canonical mutations flow through a typed command/event spine** with undo/redo.
13. **The in-memory canonical store uses ID-keyed maps, not arrays**, for patch stability.
14. **Referential integrity is declared per-reference** with explicit delete behavior.
15. **Cross-game effects use a two-stage composition model:** patches then resolver.
16. **Schema evolution uses declarative diffing** with a monotonic format version.
17. **View synchronization is hybrid:** Zustand for data, coordination bus for UX signals.

### Canonical concepts

#### Strategic game
The real-world strategic situation as analysts understand it.

```typescript
interface StrategicGame {
  id: string;
  name: string;
  description: string;
  semantic_labels: SemanticGameLabel[];
  players: string[];                 // Player IDs
  status: 'active' | 'paused' | 'resolved' | 'stale';
  formalizations: string[];          // Formalization IDs
  coupling_links: string[];          // CrossGameLink IDs
  key_assumptions: string[];         // Assumption IDs
  created_at: string;
  updated_at: string;
}
```

#### Formalization
A specific computational representation of a strategic game.

A single strategic game may have:
- a coarse normal-form abstraction for equilibrium inspection
- a richer extensive-form tree for move-by-move analysis
- a repeated-game model for long-run interaction
- a Bayesian model for incomplete information

```typescript
type Formalization =
  | NormalFormModel
  | ExtensiveFormModel
  | RepeatedGameModel
  | BayesianGameModel
  | CoalitionModel;

interface BaseFormalization {
  id: string;
  game_id: string;
  kind: 'normal_form' | 'extensive_form' | 'repeated' | 'bayesian' | 'coalition';
  purpose: 'explanatory' | 'computational' | 'playout';
  abstraction_level: 'coarse' | 'medium' | 'detailed';
  assumptions: string[];             // Assumption IDs
  readiness: SolverReadiness;
  notes?: string;
}
```

#### Formalization subtypes

```typescript
interface NormalFormModel extends BaseFormalization {
  kind: 'normal_form';
  strategies: Record<string, string[]>;      // player_id -> strategy labels
  payoff_cells: NormalFormCell[];
}

interface ExtensiveFormModel extends BaseFormalization {
  kind: 'extensive_form';
  root_node_id: string;
  information_sets: InformationSet[];
}

interface RepeatedGameModel extends BaseFormalization {
  kind: 'repeated';
  stage_formalization_id: string;            // Usually a normal-form or extensive-form stage game
  horizon: 'finite' | 'indefinite';
  discount_factors: Record<string, EstimateValue>;
}

interface BayesianGameModel extends BaseFormalization {
  kind: 'bayesian';
  player_types: Record<string, PlayerType[]>;
  priors: PriorDistribution[];
  signal_structure?: SignalStructure;
}

interface CoalitionModel extends BaseFormalization {
  kind: 'coalition';
  agenda_setters?: string[];                 // Player IDs
  coalition_options: CoalitionOption[];
}
```

#### Semantic labels vs formalizations

Semantic labels describe the **strategic logic** analysts believe is present:

```typescript
type SemanticGameLabel =
  | 'chicken'
  | 'prisoners_dilemma'
  | 'coordination'
  | 'attrition'
  | 'deterrence'
  | 'coercive_bargaining'
  | 'signaling'
  | 'hostage'
  | 'domestic_political'
  | 'coalition'
  | 'repeated_defection'
  | 'custom';
```

Formalizations describe the **mathematical structure** used to compute or play through the model.

This separation is important. One strategic situation may carry the semantic label "signaling" while being encoded as a Bayesian extensive-form model.

#### Players

```typescript
interface Player {
  id: string;
  name: string;
  type: 'state' | 'organization' | 'individual' | 'coalition' | 'market' | 'public';
  objectives: ObjectiveRef[];
  constraints: ConstraintRef[];
  beliefs?: BeliefModel;
  strategy_library?: StrategyTemplate[];
  risk_profile?: EstimateValue;
  reservation_utility?: EstimateValue;
  audience_costs?: EstimateValue;
  metadata?: {
    description?: string;
    aliases?: string[];
  };
}
```

#### Actors

```typescript
type Actor =
  | { kind: 'player'; player_id: string }
  | { kind: 'nature' }
  | { kind: 'environment' }
  | { kind: 'coalition_proxy'; coalition_id: string };
```

#### Nodes and edges

Nodes and edges belong to a specific formalization, not just a top-level game.

```typescript
interface GameNode {
  id: string;
  formalization_id: string;
  actor: Actor;
  type: 'decision' | 'chance' | 'terminal';
  label: string;
  description?: string;
  information_set_id?: string;
  available_actions?: string[];      // Action IDs
  claims?: string[];                 // Claim IDs
  inferences?: string[];             // Inference IDs
  assumptions?: string[];            // Assumption IDs
  terminal_payoffs?: Record<string, EstimateValue>;
  model_time_index?: number;
}

interface GameEdge {
  id: string;
  formalization_id: string;
  from: string;
  to: string;
  label: string;
  action_id?: string;
  choice_forecast?: ForecastEstimate;       // For strategic actor choices
  chance_estimate?: ChanceEstimate;         // For chance/nature transitions
  payoff_delta?: Record<string, EstimateValue>;
  triggers_cross_game_links?: string[];     // CrossGameLink IDs
  assumptions?: string[];
}
```

### Estimate wrappers

Bare numbers are not allowed.

```typescript
interface EstimateValue {
  representation: 'ordinal_rank' | 'interval_estimate' | 'cardinal_estimate';
  value?: number;
  min?: number;
  max?: number;
  ordinal_rank?: number;
  confidence: number;                // 0-1
  rationale: string;
  source_claims: string[];           // Claim IDs
  supporting_inferences?: string[];  // Inference IDs
  assumptions?: string[];            // Assumption IDs
  latent_factors?: string[];         // LatentFactor IDs
}

interface ForecastEstimate {
  mode: 'point' | 'range' | 'conditional';
  value?: number;
  min?: number;
  max?: number;
  conditions?: ConditionRef[];
  confidence: number;
  rationale: string;
  source_claims: string[];
  assumptions: string[];
  latent_factors?: string[];
}

interface ChanceEstimate {
  value: number;
  confidence: number;
  rationale: string;
  source_claims?: string[];
  assumptions?: string[];
}
```

### Evidence ladder

v3 formalizes the reasoning ladder.

```typescript
interface Source {
  id: string;
  kind: 'web' | 'pdf' | 'article' | 'report' | 'transcript' | 'manual';
  url?: string;
  title?: string;
  publisher?: string;
  published_at?: string;
  captured_at: string;
  snapshot_ref?: string;             // Points into SQLite / bundle
  quality_rating?: 'low' | 'medium' | 'high';
  notes?: string;
}

interface Observation {
  id: string;
  source_id: string;
  text: string;                      // Directly observed statement / quote / datum
  quote_span?: string;
  captured_at: string;
}

interface Claim {
  id: string;
  statement: string;                 // Normalized proposition
  based_on: string[];                // Observation IDs
  confidence: number;
  freshness?: string;
  contested_by?: string[];           // Claim IDs
}

interface Inference {
  id: string;
  statement: string;                 // Analyst/AI conclusion derived from claims
  derived_from: string[];            // Claim IDs
  confidence: number;
  rationale: string;
}

interface Assumption {
  id: string;
  statement: string;
  type: 'structural' | 'behavioral' | 'payoff' | 'timing' | 'belief' | 'simplification';
  supported_by?: string[];           // Claim or Inference IDs
  contradicted_by?: string[];        // Claim IDs
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

interface Contradiction {
  id: string;
  left_ref: string;                  // Claim ID
  right_ref: string;                 // Claim ID
  description: string;
  resolution_status: 'open' | 'partially_resolved' | 'resolved' | 'deferred';
  notes?: string;
}

interface DerivationEdge {
  id: string;
  from_ref: string;                  // Source/Observation/Claim/Inference/Assumption/Estimate ID
  to_ref: string;
  relation:
    | 'supports'
    | 'contradicts'
    | 'infers'
    | 'operationalizes'
    | 'parameterizes'
    | 'invalidates'
    | 'updates';
}
```

This is the core epistemic discipline of v3.

**DerivationEdge directionality:** Derivation edges flow **from evidence-ladder entities to model entities**, never the reverse. `from_ref` targets evidence types (source, observation, claim, inference, assumption); `to_ref` targets both evidence types and model types (game_node, game_edge). This reflects the epistemic direction: evidence *supports* model structure, not the other way around. If a model change invalidates evidence, that relationship is captured through the `'invalidates'` relation on a derivation edge pointing from the evidence to the model element it was supposed to support.

### Latent factors and correlated uncertainty

Scenario probabilities in world events are rarely independent. A single hidden driver can influence multiple branches.

v3 introduces explicit latent factors:

```typescript
interface LatentFactor {
  id: string;
  name: string;                      // e.g. "Iran regime fragility"
  description?: string;
  states: {
    label: string;
    probability: number;
    confidence: number;
  }[];
  affects: string[];                 // Assumption / GameNode / GameEdge IDs (entities containing estimates)
  source_claims?: string[];
  assumptions?: string[];
}
```

This allows the app to model:
- shared underlying drivers
- conditional probabilities
- regime shifts
- correlated payoffs
- shock scenarios

The app may still support simple independence assumptions, but it must label them as approximations.

### Referential Integrity & Normalization Layer

#### In-Memory Canonical Store

#### Entity Type System

The `EntityType` union is the canonical list of entity kinds. It maps to `CanonicalStore` keys via a naming convention:

```typescript
type EntityType =
  | 'game'
  | 'formalization'
  | 'player'
  | 'game_node'
  | 'game_edge'
  | 'source'
  | 'observation'
  | 'claim'
  | 'inference'
  | 'assumption'
  | 'contradiction'
  | 'derivation'
  | 'latent_factor'
  | 'cross_game_link'
  | 'scenario'
  | 'playbook'

// Mapping from EntityType to CanonicalStore key
const STORE_KEY: Record<EntityType, keyof CanonicalStore> = {
  game: 'games',
  formalization: 'formalizations',
  player: 'players',
  game_node: 'nodes',
  game_edge: 'edges',
  source: 'sources',
  observation: 'observations',
  claim: 'claims',
  inference: 'inferences',
  assumption: 'assumptions',
  contradiction: 'contradictions',
  derivation: 'derivations',
  latent_factor: 'latent_factors',
  cross_game_link: 'cross_game_links',
  scenario: 'scenarios',
  playbook: 'playbooks',
}
```

#### Canonical Store

Uses ID-keyed maps (not arrays) for patch stability:

```typescript
interface CanonicalStore {
  games: Record<string, StrategicGame>
  formalizations: Record<string, Formalization>
  players: Record<string, Player>
  nodes: Record<string, GameNode>
  edges: Record<string, GameEdge>
  sources: Record<string, Source>
  observations: Record<string, Observation>
  claims: Record<string, Claim>
  inferences: Record<string, Inference>
  assumptions: Record<string, Assumption>
  contradictions: Record<string, Contradiction>
  derivations: Record<string, DerivationEdge>
  latent_factors: Record<string, LatentFactor>
  cross_game_links: Record<string, CrossGameLink>
  scenarios: Record<string, Scenario>
  playbooks: Record<string, Playbook>
}
```

The `.gta.json` file serializes as arrays (more human-readable). A thin serialization layer converts `Record<string, T> ↔ T[]` on load/save.

#### Load pipeline: file to store

Loading a `.gta.json` file follows this pipeline:

1. **Parse** — Read raw JSON, verify it's an object with a `schema_version` field.
2. **Migrate** — If `schema_version < current`, run the migration pipeline (see Schema Migration).
3. **Validate** — Run the current Zod schema against the migrated data.
4. **Structural checks** — Before converting arrays to maps:
   - Verify all entities have non-empty `id` fields
   - Verify no duplicate IDs within any single array
   - Verify no ID collisions across entity types (since IDs are prefixed, e.g., `claim_abc`, `asmp_def`)
5. **Convert** — Transform arrays to ID-keyed `Record<string, T>` maps using `STORE_KEY` mapping.
6. **Build derived structures** — Construct the inverse reference index from the loaded maps.
7. **Integrity check** — Run post-validation invariants (same as dispatch post-validation) to catch any pre-existing data inconsistencies.
8. **Initialize event log** — Start a fresh `EventLog` with `cursor: 0`. Prior mutation history is not loaded from the file (see Event Log Persistence).

If any step fails, the file opens in recovery mode (read-only, raw JSON editor).

#### Declared Reference Schema

Each entity type declares its outgoing references and delete behavior:

```typescript
interface RefDeclaration {
  field: string
  target: EntityType | EntityType[]
  cardinality: 'one' | 'many'
  required: boolean
  on_delete: 'block' | 'remove_ref' | 'remove_ref_or_stale_if_empty' | 'cascade_delete' | 'mark_stale'
}
```

`remove_ref_or_stale_if_empty` means: remove the reference. If removing it would leave a `required: true` array-type field empty, mark the owning entity as stale instead of leaving it in an invalid state.

```typescript

const REFERENCE_SCHEMA: Record<EntityType, RefDeclaration[]> = {
  game: [
    { field: 'players', target: 'player', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'formalizations', target: 'formalization', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'coupling_links', target: 'cross_game_link', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'key_assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  formalization: [
    { field: 'game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'root_node_id', target: 'game_node', cardinality: 'one', required: false, on_delete: 'cascade_delete' },
    { field: 'stage_formalization_id', target: 'formalization', cardinality: 'one', required: false, on_delete: 'cascade_delete' },
    { field: 'agenda_setters', target: 'player', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  // Note: root_node_id applies only to 'extensive_form', stage_formalization_id
  // only to 'repeated', agenda_setters only to 'coalition'. The integrity layer
  // checks these refs only when the field exists on the actual entity instance
  // (i.e., when the discriminant matches). Missing fields on non-matching
  // subtypes are ignored, not treated as violations.
  player: [
    { field: 'risk_profile.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'risk_profile.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'reservation_utility.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'reservation_utility.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'audience_costs.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'audience_costs.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  game_node: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'inferences', target: 'inference', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'terminal_payoffs.*.source_claims', target: 'claim', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'terminal_payoffs.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'terminal_payoffs.*.latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  game_edge: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'from', target: 'game_node', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'to', target: 'game_node', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'triggers_cross_game_links', target: 'cross_game_link', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'choice_forecast.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'choice_forecast.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'chance_estimate.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'chance_estimate.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  source: [
    // No outgoing entity refs — top-level evidence root
  ],
  observation: [
    { field: 'source_id', target: 'source', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  claim: [
    { field: 'based_on', target: 'observation', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'contested_by', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  inference: [
    { field: 'derived_from', target: 'claim', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
  ],
  assumption: [
    { field: 'supported_by', target: ['claim', 'inference'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'contradicted_by', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  contradiction: [
    { field: 'left_ref', target: 'claim', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'right_ref', target: 'claim', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  derivation: [
    { field: 'from_ref', target: ['source', 'observation', 'claim', 'inference', 'assumption'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'to_ref', target: ['claim', 'inference', 'assumption', 'game_node', 'game_edge'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  latent_factor: [
    { field: 'affects', target: ['assumption', 'game_node', 'game_edge'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  cross_game_link: [
    { field: 'source_game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'target_game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'trigger_ref', target: ['game_edge', 'game_node'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'target_ref', target: ['formalization', 'game_node', 'player'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  scenario: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'path', target: 'game_edge', cardinality: 'many', required: true, on_delete: 'mark_stale' },
    { field: 'key_assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'mark_stale' },
    { field: 'key_latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'invalidators', target: ['claim', 'inference', 'assumption'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  playbook: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'derived_from_scenario', target: 'scenario', cardinality: 'one', required: false, on_delete: 'remove_ref' },
  ],
}
```

Delete behavior per reference:

| Entity | Field | Target | on_delete |
|---|---|---|---|
| Observation | `source_id` | Source | `cascade_delete` |
| Claim | `based_on` | Observation | `remove_ref_or_stale_if_empty` |
| Assumption | `supported_by` | Claim/Inference | `remove_ref` |
| GameNode | `formalization_id` | Formalization | `cascade_delete` |
| Scenario | `key_assumptions` | Assumption | `mark_stale` |
| CrossGameLink | `source_game_id` | StrategicGame | `cascade_delete` |

#### Base Entity Fields

All canonical entities share common fields managed by the infrastructure layer:

```typescript
interface BaseEntity {
  id: string
  stale_markers?: ReadonlyArray<StaleMarker>
}
```

> **Updated:** `stale_markers` is an array supporting multiple independent stale causes. An entity is stale when the array is non-empty.

Every entity interface in the canonical model implicitly extends `BaseEntity`. The `stale_markers` field is:
- Appended to by `mark_stale` commands (AI update flow, cascade effects) — each cause creates a separate marker
- Filtered by `clear_stale` commands (user review) — removes the specific cause, entity becomes non-stale when array empties
- Serialized into `.gta.json` when non-empty (preserved across save/load)
- Used by the solver readiness engine, view rendering, and export logic

#### Nested References (Embedded Value Objects)

`EstimateValue` is an embedded value object, not a top-level entity. It does not appear in `CanonicalStore` or `REFERENCE_SCHEMA` as a standalone entry. Its outgoing references (to claims, assumptions, latent factors) are declared as nested refs on the containing entity using wildcard field paths (e.g., `terminal_payoffs.*.source_claims` in the `game_node` schema above).

#### Entity References

Typed composite keys for type safety:

```typescript
interface EntityRef {
  readonly type: EntityType
  readonly id: string
}

function refKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`
}
```

IDs are globally unique via prefixed UUIDs (`claim_abc123`, `asmp_def456`).

#### Impact Graph Computation

When a delete is requested, the layer walks the inverse reference graph:

```typescript
interface ImpactReport {
  target: EntityRef
  direct_dependents: EntityRef[]
  transitive_dependents: EntityRef[]
  proposed_actions: IntegrityAction[]
  severity: 'safe' | 'warning' | 'destructive'
}

type IntegrityAction =
  | { kind: 'remove_ref'; entity: EntityRef; field: string; ref_id: string }
  | { kind: 'mark_stale'; entity: EntityRef; reason: string }
  | { kind: 'cascade_delete'; entity: EntityRef }
  | { kind: 'block'; reason: string }
```

#### Inverse Reference Index

Derived data structure rebuilt on load, maintained incrementally:

```typescript
// Key: "claim:claim_abc123", Value: entities that reference it
type InverseIndex = Record<string, ReadonlyArray<EntityRef>>
```

Impact graph computation is O(dependents) instead of O(all entities).

#### Two Modes

- **User edits** → cascade-aware warn-then-act. Show impact report, user confirms, commit as atomic batch.
- **AI updates** → soft delete. Mark removed entities as stale with a reason. Mark dependents as stale. Nothing deleted without human approval.

#### Stale Semantics

```typescript
interface StaleMarker {
  readonly stale: true
  readonly reason: string
  readonly stale_since: string
  readonly caused_by: EntityRef
}
```

| Operation | Stale entities |
|---|---|
| Display in views | Shown with visual warning badge |
| Manual editing | Allowed |
| Solver readiness | Drops to `usable_with_warnings` or `not_ready` |
| Scenario generation | Shown with "needs review" flag |
| Play sessions | Can play, tagged "uses stale inputs" |
| Export to .gta.json | Included, stale markers preserved |
| AI pipeline re-runs | AI told which inputs are stale, can propose replacements |

Rule: stale never hides, never blocks editing, always warns downstream consumers.

#### Post-Validation Invariants

Run on candidate state before commit:

- No dangling references (ID points to nothing)
- No orphaned entities that should have parents
- Derivation edges form a DAG (no circular reasoning)
- Formalization nodes/edges belong to declared formalization
- Payoff matrix dimensions match declared strategy sets
- No duplicate IDs within any entity collection
- No illegal self-references
- Cardinality enforcement (`required: true` + `cardinality: 'one'` = exactly one valid ref)
- Ownership consistency across game/formalization boundaries

### Cross-game links with explicit semantics

Cross-game influence is central to the product. v3 gives it firmer semantics.

```typescript
interface CrossGameLink {
  id: string;
  source_game_id: string;
  target_game_id: string;
  trigger_ref: string;               // Usually an edge or terminal outcome
  effect_type:
    | 'payoff_shift'
    | 'belief_update'
    | 'strategy_unlock'
    | 'strategy_remove'
    | 'timing_change'
    | 'player_entry'
    | 'player_exit'
    | 'resource_transfer'
    | 'commitment_change';
  target_ref: string;                // Formalization / GameNode / Player ID (must match REFERENCE_SCHEMA targets)
  magnitude?: EstimateValue;
  // Note: composition mode is NOT declared here. It lives on the EffectPatch
  // emitted by the two-stage merge model (see Cross-Game Composition section).
  // CrossGameLink defines WHAT is linked; EffectPatch defines HOW it composes.
  conditions?: ConditionRef[];
  rationale: string;
  source_claims?: string[];
  assumptions?: string[];
  mode_override?: 'sum' | 'max' | 'min' | 'override' | 'bayesian_update' | 'union' | 'intersection';
  priority?: 'critical' | 'high' | 'normal' | 'low';
}
```

This prevents cross-game effects from becoming hand-wavy dashed lines with unclear meaning.

#### Link-to-Patch Translation

`CrossGameLink` is the stored relationship. `EffectPatch` is the runtime artifact. The cascade engine translates one to the other:

1. The engine reads the link's `effect_type` and looks up the `RESOLVER_DISPATCH` table to determine the resolver strategy.
2. The link's `target_ref` is resolved to an `EntityRef` and the appropriate `TargetField` variant.
3. The link's `magnitude` (an `EstimateValue`) provides the `value`, `confidence`, and provenance.
4. The `mode` is determined by the resolver strategy's default for that effect type (e.g., `payoff_shift` defaults to `sum`). Links can override the default via an optional `mode_override` field.
5. Priority defaults to `'normal'` unless the link specifies otherwise via an optional `priority` field.
6. Conditions are passed through directly from the link.

This translation is deterministic and auditable. The cascade engine never invents information not present on the link or its referenced entities.

### Cross-Game Composition — Two-Stage Merge Model

#### Core Concept

Cross-game links do not directly mutate target entities. Each link emits a typed `EffectPatch`. All patches targeting the same field go through a deterministic resolver. The analyst inspects results before they become canonical.

#### Stage 1: Links Emit Effect Patches

```typescript
interface EffectPatch {
  readonly link_id: string
  readonly target: EntityRef
  readonly field: TargetField                 // typed, not dot-path
  readonly effect_type: EffectType
  readonly mode: 'sum' | 'max' | 'min' | 'override' | 'bayesian_update' | 'union' | 'intersection'
  readonly value: EffectValue
  readonly confidence: number
  readonly priority: 'critical' | 'high' | 'normal' | 'low'
  readonly conditions: ConditionRef[]
  readonly scope: PatchScope
  readonly provenance: {
    source_game_id: string
    trigger_ref: string
    rationale: string
    source_claims: string[]
    assumptions: string[]
  }
}
```

#### Typed Target Fields

Stable across schema evolution — semantic keys, not structural paths:

```typescript
type TargetField =
  | { kind: 'terminal_payoff'; player_id: string }
  | { kind: 'edge_probability' }
  | { kind: 'belief_prior'; player_id: string; type_label: string }
  | { kind: 'available_strategies'; player_id: string }
  | { kind: 'game_player_list' }              // targets StrategicGame.players
  | { kind: 'discount_factor'; player_id: string }
  | { kind: 'reservation_utility'; player_id: string }
  | { kind: 'audience_costs'; player_id: string }
```

The `player_id` and other parameters in `TargetField` variants are derived from the `CrossGameLink` during translation:
- `player_id` comes from the link's `target_ref` when it points to a `Player`, or from the specific payoff key when targeting a `GameNode`'s terminal payoffs.
- The cascade engine resolves these by inspecting the target entity's structure at translation time.

#### Effect Types and Values

```typescript
type EffectType =
  | 'payoff_shift'
  | 'belief_update'
  | 'strategy_unlock'
  | 'strategy_remove'
  | 'timing_change'
  | 'player_entry'
  | 'player_exit'
  | 'resource_transfer'
  | 'commitment_change'

type EffectValue =
  | { kind: 'numeric_delta'; delta: number }
  | { kind: 'numeric_override'; value: number }
  | { kind: 'estimate_override'; value: EstimateValue }
  | { kind: 'set_add'; items: string[] }
  | { kind: 'set_remove'; items: string[] }
  | { kind: 'bayesian'; prior: number; likelihood: number; observation: string }
```

#### Patch Scope

Patches carry scope to prevent accidental merging across contexts:

```typescript
type PatchScope =
  | { kind: 'cascade_analysis'; analysis_run_id: string }
  | { kind: 'play_session'; session_id: string; turn_id: string; branch_id: string }
  | { kind: 'scenario_evaluation'; scenario_id: string }
  | { kind: 'model_update'; update_event_id: string }
```

The resolver groups patches by scope first, then by target field.

#### Field Policy Layer

Validates that patches are legal for their target:

```typescript
interface FieldPolicy {
  target_entity_type: EntityType
  field_pattern: string
  allowed_effect_types: EffectType[]
  allowed_modes: string[]
  allowed_value_kinds: Array<EffectValue['kind']>
}
```

Patches violating their field's policy are rejected at Stage 1.

#### Stage 2: Resolver

Three resolver strategies dispatched by effect type:

```typescript
type ResolverStrategy =
  | { kind: 'numeric'; combine: 'sum' | 'max' | 'min' | 'override' | 'bayesian_update' }
  | { kind: 'set'; combine: 'union' | 'intersection' | 'override' }
  | { kind: 'structural'; combine: 'batch_command' }

const RESOLVER_DISPATCH: Record<EffectType, ResolverStrategy> = {
  payoff_shift:       { kind: 'numeric', combine: 'sum' },
  belief_update:      { kind: 'numeric', combine: 'bayesian_update' },
  resource_transfer:  { kind: 'numeric', combine: 'sum' },
  strategy_unlock:    { kind: 'set', combine: 'union' },
  strategy_remove:    { kind: 'set', combine: 'union' },
  timing_change:      { kind: 'numeric', combine: 'override' },
  player_entry:       { kind: 'structural', combine: 'batch_command' },
  player_exit:        { kind: 'structural', combine: 'batch_command' },
  commitment_change:  { kind: 'structural', combine: 'batch_command' },
}
```

#### Resolution Algorithm

```
resolve(input: ResolverInput) → ResolverOutput:

  1. FILTER: Remove patches whose conditions are not met.
     → discarded with reason 'condition_not_met'

  2. GROUP by priority tier: critical > high > normal > low

  3. Starting from highest priority tier with patches:

     a. If tier contains 'override' patches:
        - Exactly one override → it wins. Discard all lower-priority.
        - Multiple overrides, same value → collapse to one (agreement, not conflict).
        - Multiple overrides, different values → CONFLICT. Flag for user.

     b. If no override:
        - Group by mode.
        - Within each mode group, combine:
          • sum: add all deltas
          • max: take the maximum
          • min: take the minimum
          • bayesian_update: chain sequentially (confidence desc, with evidence group dedup)
        - One mode group → that's the result.
        - Multiple mode groups at same priority → CONFLICT. Flag for user.

     c. Clean result at this tier → discard all lower-priority patches.

  4. CONFIDENCE: min(confidence) among applied patches.
     Labeled as 'min_heuristic' — conservative, not mathematically rigorous.

  5. Return ResolverOutput with full audit trail.
```

#### Resolver Output

```typescript
interface ResolverOutput {
  final_value: unknown
  confidence: number
  confidence_method: 'min_heuristic'
  applied_patches: ReadonlyArray<EffectPatch>
  discarded_patches: ReadonlyArray<{
    patch: EffectPatch
    reason: 'condition_not_met' | 'overridden_by_higher_priority' | 'conflict_flagged'
  }>
  conflicts: ReadonlyArray<EffectConflict>
}

interface EffectConflict {
  field: TargetField
  competing_patches: ReadonlyArray<EffectPatch>
  reason: string
  requires_user_resolution: true
}
```

#### Structural Resolver Output

For `player_exit`, `player_entry`, `commitment_change`:

```typescript
interface StructuralResolverOutput {
  kind: 'structural'
  commands: ReadonlyArray<Command>
  description: string
  requires_user_confirmation: boolean        // always true for structural
}
```

These produce batch commands that go through the normal command/event spine.

#### Bayesian Update Guardrails

```typescript
interface BayesianResolverConfig {
  method: 'sequential_heuristic'
  ordering: 'confidence_desc'
  double_count_guard: 'evidence_group_dedup'  // patches sharing source_claims grouped
  display_label: 'Approximate Bayesian update (heuristic)'
}
```

Patches deriving from the same claims → only higher-confidence one applied. UI always labels as "approximate."

#### Integration with Command/Event Spine

Cross-game effects flow differently depending on context:
- **Cascade analysis (compute):** Results stored in Layer 3 as derived. Analyst inspects. Nothing canonical changes automatically.
- **Play sessions:** Effects applied to session-local state. Turn log records patches.
- **Model updates:** Analyst accepts a cascade result → `ApplyCascadeEffect` command through normal dispatch.

No silent canonical mutation.

#### Condition Evaluation

```typescript
interface ConditionRef {
  kind: 'outcome_reached' | 'assumption_holds' | 'scenario_active' | 'player_state' | 'custom'
  ref_id: string
  negated: boolean
}
```

Conditions with unresolvable references treated as unmet; patch discarded with warning.

### Solver readiness and formal adequacy

Before any formal algorithm runs, the app computes readiness.

```typescript
interface SolverReadiness {
  overall: 'ready' | 'usable_with_warnings' | 'not_ready';
  completeness_score: number;        // 0-1
  confidence_floor: number;          // Lowest confidence among key inputs
  blockers: string[];
  warnings: string[];
  supported_solvers: Array<
    | 'nash'
    | 'backward_induction'
    | 'expected_utility'
    | 'dominance'
    | 'bayesian_update'
    | 'cascade'
    | 'simulation'
  >;
}
```

Example warnings:
- "Expected utility is being shown on interval estimates with wide ranges."
- "Backward induction assumes terminal payoffs not directly evidenced."
- "Mixed-strategy equilibrium depends on cardinalization of ordinal preferences."

### Scenarios and invalidators

```typescript
interface Scenario {
  id: string;
  name: string;
  formalization_id: string;
  path: string[];                    // Edge IDs
  probability_model: 'independent' | 'dependency_aware' | 'ordinal_only';
  estimated_probability?: ForecastEstimate;
  key_assumptions: string[];
  key_latent_factors?: string[];
  invalidators: string[];            // Claim / Inference / Assumption IDs
  narrative: string;
}

interface Playbook {
  id: string;
  name: string;
  formalization_id: string;
  derived_from_scenario?: string;
  role_assignments: Record<string, PolicyRef>; // player_id -> policy
  notes?: string;
}
```

### Play sessions

Play sessions are runtime/derived artifacts stored in the local SQLite workspace database (Layer 3). They are **not** part of the `.gta.json` canonical file.

- **Active sessions** are held in memory (Zustand store) and flushed to SQLite periodically and on pause/end.
- **Paused sessions** are fully persisted in SQLite and can be resumed across page refreshes.
- **Ended sessions** remain in SQLite for review and can be exported into `.gtbundle` files.
- **Promotion** of individual results to canonical state uses the `promote_play_result` command.

```typescript
interface PolicyRef {
  kind: 'human' | 'ai' | 'equilibrium' | 'heuristic' | 'scripted';
  provider_id?: string;
  model_id?: string;
  prompt_version?: string;
  heuristic_id?: string;
}
```

#### Branching Data Model

All turns belong to branches. The session has a trunk branch created at start:

```typescript
interface PlaySession {
  id: string
  playbook_id: string
  started_at: string
  base_revision: number              // event log cursor at session start
  seed?: number
  trunk_branch_id: string
  branches: Record<string, PlayBranch>
  active_branch_id: string
}

interface PlayBranch {
  id: string
  name: string
  parent_branch_id: string | null
  fork_after_turn_id: string | null
  turns: ReadonlyArray<PlayTurn>
  discarded_turns: ReadonlyArray<PlayTurn>     // turns removed by quick rewind
  state_checkpoint: SessionStateCheckpoint
  created_at: string
}
```

#### Turns with Stable IDs

```typescript
interface PlayTurn {
  id: string                                 // stable: "turn_abc123"
  branch_id: string
  sequence: number                           // display ordering
  parent_turn_id: string | null
  actor: PlayActor
  kind: 'move' | 'shock'
  chosen_edge_id?: string
  shock?: {
    description: string
    effects: ReadonlyArray<EffectPatch>
  }
  rationale: string
  supporting_refs?: string[]
  cross_game_impacts?: string[]
  notes?: string
}

type PlayActor =
  | { kind: 'player'; player_id: string; policy: PolicyRef }
  | { kind: 'nature'; description: string }
  | { kind: 'analyst'; description: string }
  | { kind: 'system'; trigger: string }
```

#### AI Turn Progress

```typescript
type AITurnPhase =
  | { step: 'assembling_context'; detail: string }
  | { step: 'enumerating_strategies'; count: number }
  | { step: 'evaluating_payoffs'; current: number; total: number }
  | { step: 'computing_cross_game'; links_evaluated: number; links_total: number }
  | { step: 'deciding'; top_candidates: Array<{ action: string; score: number }> }
  | { step: 'complete'; chosen_edge_id: string; rationale: string }
  | { step: 'cancelled'; reason: 'user' | 'timeout' | 'error' }

interface AITurnProgress {
  attempt_id: string                         // unique per computation attempt
  session_id: string
  branch_id: string
  after_turn_id: string
  actor: PlayActor
  phase: AITurnPhase
  started_at: string
}
```

Elapsed time is derived by the UI from `started_at`, not stored. Cancel discards all partial data for that `attempt_id`.

#### Rewind Mechanics

**Quick rewind** (last turn only):
- Pops last turn from active branch
- Session state resets via checkpoint
- The discarded turn is moved to a `discarded_turns` log on the branch (not permanently deleted). This preserves auditability — the analyst can see what was tried and undone. The turn no longer affects session state or branch comparison, but it remains inspectable in the session history.
- Instant, no ceremony

**Fork** (any earlier turn):
- Creates new `PlayBranch` with `fork_after_turn_id`
- Original branch preserved intact
- New branch becomes active
- User switches between branches in sidebar

#### Session State Checkpoints

Checkpoint-based restoration, not replay:

```typescript
interface SessionStateCheckpoint {
  checkpoint_id: string
  after_turn_id: string
  base_revision: number                      // event log cursor at session start
  canonical_overlay: Record<string, Record<string, unknown>>  // entity_type -> id -> changed fields
  active_conditions: string[]                // JSON-serializable (not Set)
  cumulative_effects: Record<string, ResolverOutput>
}
```

`canonical_overlay` uses a granular diff structure (entity type → entity ID → changed fields) rather than `Partial<CanonicalStore>` to keep checkpoints small. `active_conditions` is a plain array (JSON-serializable) rather than a `Set`.

Each turn updates the checkpoint incrementally. Switching branches loads the target checkpoint directly — O(1). Checkpoints are persisted to SQLite alongside the session.

#### Shock Injection

Shocks use the same two-stage composition from the cross-game composition model:
1. Analyst describes the shock
2. System generates `EffectPatch` proposals
3. Resolver combines them
4. Analyst inspects and edits before applying
5. Applied to session state as a `shock` turn with `actor: { kind: 'analyst' }`

#### Branch Comparison

Default comparison mode: cumulative from fork point.

```typescript
interface BranchComparison {
  left_branch_id: string
  right_branch_id: string
  fork_after_turn_id: string
  comparison_mode: 'cumulative_from_fork'
  divergence_summary: {
    left_turns_since_fork: number
    right_turns_since_fork: number
    payoff_deltas: Record<string, {
      at_fork: EstimateValue
      left_current: EstimateValue
      right_current: EstimateValue
    }>
    cascade_differences: Array<{
      link_id: string
      fired_in_left: boolean
      fired_in_right: boolean
    }>
    key_divergences: Array<{
      left_turn_id: string
      right_turn_id: string
      description: string
    }>
  }
}
```

### Top-level analysis file

```typescript
interface AnalysisFile {
  schema_version: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;

  games: StrategicGame[];
  formalizations: Formalization[];
  players: Player[];
  nodes: GameNode[];
  edges: GameEdge[];

  sources: Source[];
  observations: Observation[];
  claims: Claim[];
  inferences: Inference[];
  assumptions: Assumption[];
  contradictions: Contradiction[];
  derivations: DerivationEdge[];

  latent_factors: LatentFactor[];
  cross_game_links: CrossGameLink[];
  scenarios: Scenario[];
  playbooks: Playbook[];

  metadata: {
    tags: string[];
    prompt_versions_used: Record<string, string>;
    primary_event_dates?: {
      start?: string;
      end?: string;
    };
  };
}
```

Stale markers are serialized inline on each entity. Since all entity interfaces implicitly extend `BaseEntity`, the optional `stale` field appears directly on each object in the JSON arrays. No separate stale-tracking structure is needed in the file format.

**Deferred auxiliary types** — the following types are used by the entity interfaces above but are intentionally deferred to implementation. They are domain-specific value objects without cross-entity references, so their exact shape does not affect the infrastructure systems. Each should be defined in dedicated files under `src/types/` and schema-validated with Zod:

- `NormalFormCell` — a single cell in a normal-form payoff matrix (player strategies → payoffs)
- `InformationSet` — groups of decision nodes where a player cannot distinguish between them
- `PlayerType` — a possible type for a player in a Bayesian game (label + prior probability)
- `PriorDistribution` — probability distribution over player types
- `SignalStructure` — how observations map to player types in signaling models
- `ObjectiveRef` — what a player is trying to optimize (label + weight + estimate)
- `ConstraintRef` — what limits a player's choices (label + type + severity)
- `BeliefModel` — a player's beliefs about other players' types and strategies
- `StrategyTemplate` — a reusable strategy pattern for a player (label + conditions + actions)
- `CoalitionOption` — a possible coalition configuration (members + payoff allocation)
- `ConditionRef` — a reference to a condition that must hold (used in cross-game links and forecasts)
- `PlaySessionSummary` — returned by `endSession()` (total turns, branches, key outcomes)

### Bundle manifest

```typescript
interface BundleManifest {
  bundle_version: string;
  analysis_file: string;             // path inside bundle
  source_snapshots: string[];
  ai_runs: string[];
  extraction_runs: string[];
  prompt_versions: string[];
  saved_play_sessions?: string[];
  checksums: Record<string, string>;
  created_at: string;
}
```

## AI pipeline architecture

### Multi-agent orchestration with propose-merge

The core orchestration rule stays the same:

- subagents propose structured diffs
- only the orchestrator merges into Layer 1
- the user can always review or override

But v3 expands what can be proposed:

- sources and source snapshots
- observations and claims
- inferences
- assumptions
- games and formalizations
- nodes and edges
- cross-game links
- scenarios and playbooks
- update diffs when new evidence arrives

### Pipeline phases

#### Phase 0: Intake
Classify the request:
- live event
- historical case
- business / negotiation case
- textbook / toy model
- user-authored custom model

Decide whether the system should emphasize:
- evidence gathering
- formal modeling
- simulation
- comparison to historical analogs

#### Phase 1: Validate
Does the event admit game-theoretic treatment?

The app should answer:
- who are the strategic actors?
- are choices interdependent?
- is game theory the right abstraction?
- what are the obvious limits?

If the fit is weak, the system should say so.

#### Phase 2: Research + source capture
The orchestrator decomposes the event into 3-8 threads and assigns them to research subagents.

Research output is not "a summary." It is:
- source candidates
- captured source snapshots
- structured findings
- explicit gaps
- confidence assessments

Provider-specific search behavior should be normalized into one internal evidence layer.

#### Phase 3: Evidence normalization
This is new and central in v3.

The app converts raw sources into:
- observations
- claims
- contradiction objects
- first-pass inferences

This creates a structured evidence notebook before heavy formalization begins.

#### Phase 4: Game + player identification
AI proposes:
- strategic games
- relevant players
- semantic labels
- candidate objectives / constraints
- candidate formalizations

The system should be willing to propose several competing framings instead of pretending there is one obvious "correct" game.

#### Phase 5: Formalization
For each strategic game, AI proposes one or more formalizations.

Examples:
- a normal-form abstraction for rapid strategic inspection
- an extensive-form tree for escalation sequencing
- a repeated-game lens for ongoing bargaining
- a Bayesian model for incomplete information

Every parameterization must show:
- source claims used
- inferences used
- assumptions introduced
- confidence and uncertainty form

#### Phase 6: Expansion and linking
The orchestrator identifies:
- missing players
- missing games
- missing cross-game effects
- missing assumptions
- unresolved contradictions
- weakly evidenced payoffs
- hidden latent factors

Subagents can deepen any of those.

#### Phase 7: Adversarial challenge
Preferably via a different model.

The red-team phase should challenge:
- framing choice
- omitted actors
- omitted strategies
- omitted latent drivers
- overconfident payoffs
- naive independence assumptions
- unjustified equilibrium claims
- overly linear scenario narratives

Output is a structured critique, not vague prose.

#### Phase 8: Readiness + computation
The app computes solver readiness first.

Then, and only then, it runs the eligible algorithms and stores results in Layer 3.

Every computational result must include:
- readiness summary
- assumption exposure
- sensitivity range
- invalidation hooks
- solver-specific warnings

#### Phase 9: Scenario generation
AI proposes scenarios as explicit paths through formalizations and cross-game links.

Scenarios must include:
- path trace
- assumptions
- latent factors
- probability model type
- invalidators
- rationale

#### Phase 10: Play-out / simulation
The app can now "play" the model.

Modes:
- human vs AI
- AI vs AI
- human-assisted AI
- equilibrium-guided play
- heuristic play
- scripted play

Each turn is logged with rationale and impacts.

#### Phase 11: Update on new evidence
World-event models must evolve.

When new evidence arrives:
- source snapshots are added
- claims are updated or contradicted
- affected assumptions / estimates are marked stale
- affected formalizations get readiness recomputed
- scenarios and playbooks show which parts changed

This update discipline is essential for live strategic analysis.

### Pipeline error handling and concurrency

#### Phase failure and retry

Each AI pipeline phase returns a structured result:

```typescript
type PhaseResult =
  | { status: 'complete'; proposals: Command[] }
  | { status: 'partial'; proposals: Command[]; gaps: string[]; retriable: boolean }
  | { status: 'failed'; error: string; phase: number; retriable: boolean }

interface PhaseExecution {
  phase: number
  provider_id: string
  model_id: string
  started_at: string
  completed_at?: string
  result: PhaseResult
  cost_estimate?: { input_tokens: number; output_tokens: number; cost_usd: number }
}
```

On failure:
- Retriable phases can be re-run with the same or different model
- Non-retriable failures surface to the user with the error and partial results
- Partial completions are accepted as-is; the orchestrator notes gaps for later phases to fill
- All phase executions are logged to SQLite for cost tracking and debugging

The orchestrator does not auto-retry. The user decides whether to retry, skip, or abort.

#### Concurrent subagent proposals

When the orchestrator dispatches multiple subagents in parallel (e.g., 3-8 research threads), their proposals may overlap:

1. Each subagent produces a batch `Command` with a `base_revision` stamped at dispatch time.
2. The orchestrator collects all proposals before merging any.
3. Proposals are applied **sequentially in arrival order**. The first applies normally. Subsequent proposals are rebased: the integrity checker re-validates against the updated state.
4. If rebase fails (conflicting changes to the same entity), the conflicting proposal is flagged for user review — not silently dropped.
5. The user sees all proposals in the structured diff review UI (Phase 3/Phase 6) and can accept, reject, or edit each one.

This sequential-merge approach is simpler than true concurrent merge and aligns with the human-in-the-loop merge authority principle.

### Context window strategy

The graph remains the retrieval backbone, but v3 expands the unit of retrieval.

Context should be assembled from:
- selected formalization
- relevant evidence objects
- affected players
- nearby cross-game links
- associated latent factors
- current playbook / scenario if applicable

Small analyses can inject the full canonical JSON.

Large analyses should use tiered retrieval:
- selected object detail
- directly related graph neighborhood
- relevant evidence ladder objects
- compact summaries of linked games
- selected prompt version metadata

## AI provider architecture

### Provider tiers

**Tier 1 (default): ChatGPT subscription OAuth**
- best default onboarding
- zero extra cost for users who already subscribe
- useful for general research / analysis / orchestration

**Tier 2: Direct API keys**
- OpenAI, Anthropic, Gemini
- better concurrency and routing control
- required for provider-specific access constraints

**Tier 3: OpenRouter**
- broad model coverage
- helpful for A/B model comparison

**Tier 4: Local / custom**
- Ollama or any OpenAI-compatible endpoint
- useful for offline or private play-throughs
- cannot perform live web research

### Per-role routing

Users should be able to pick separate models for:
- orchestration
- research
- evidence normalization
- formalization
- adversarial challenge
- scenario generation
- play-session actor policies

This matters because the best research model is not necessarily the best formalization or simulation model.

### Capability detection

The provider layer should detect:
- web search availability
- tool use
- max concurrency
- context window
- streaming support
- structured JSON reliability

The UI should warn when a selected model is weak for a required phase.

## Computation engine

### Supported algorithms

All formal computation runs on Layer 1 and writes results to Layer 3.

#### 1) Nash equilibrium
For eligible normal-form representations.

Use when:
- strategy sets are sufficiently specified
- payoffs are available in usable form
- players are defined
- the formalization is ready

#### 2) Backward induction
For extensive-form models with:
- explicit terminal payoffs
- information sets
- clear move ordering

#### 3) Expected utility
For trees / scenarios where payoffs and probabilities are modeled well enough.

#### 4) Dominance elimination
For normal-form simplification and strategy pruning.

#### 5) Bayesian updating
For models with explicit priors, types, or latent factors.

#### 6) Cross-game cascade analysis
For tracing how outcomes in one game propagate into others through typed cross-game links.

#### 7) Sensitivity analysis
Mandatory companion to any solver output.

#### 8) Dependency-aware scenario analysis
Uses latent factors and conditional estimates to avoid naive multiplication where possible.

#### 9) Playout engine
A simulation engine for turn-by-turn strategic exploration.

### Solver readiness gates

No solver should produce a polished-looking result without a readiness gate.

Examples:

| Solver | Minimum requirements |
|--------|----------------------|
| Nash | complete strategy set, usable payoff representation, defined players |
| Backward induction | ordered tree, terminal payoffs, information sets |
| Expected utility | probabilities or conditional forecasts, terminal payoffs |
| Bayesian update | priors / factor states, observation-to-belief mapping |
| Cascade | typed cross-game links with valid targets |

If requirements are only partially met, the app may still show exploratory output, but it must label it as such.

### Sensitivity is not optional

Every result should answer:
- what assumption changes this result?
- which payoff estimate matters most?
- which latent factor is load-bearing?
- what evidence update would flip the conclusion?

### Playout / simulation engine

This is one of the most important v3 additions.

#### Headless Engine with Hook API

The engine is UI-agnostic. Any layout can consume it:

```typescript
class PlayEngine {
  // Lifecycle
  startSession(playbook: Playbook): PlaySession
  pauseSession(sessionId: string): void
  resumeSession(sessionId: string): PlaySession
  endSession(sessionId: string): PlaySessionSummary

  // Turns
  submitMove(turnId: string, edgeId: string, rationale: string): PlayTurn
  injectShock(description: string, patches: EffectPatch[]): PlayTurn
  cancelAITurn(attemptId: string): void

  // Branching
  quickRewind(): PlaySession
  forkBranch(fromTurnId: string, name: string): PlayBranch
  switchBranch(branchId: string): void
  compareBranches(leftId: string, rightId: string): BranchComparison
}

// React hooks — thin wrappers
function usePlaySession(): PlaySessionState
function useAITurnProgress(): AITurnProgress | null
function useBranchComparison(leftId: string, rightId: string): BranchComparison
function useTurnHistory(branchId: string): ReadonlyArray<PlayTurn>
```

The simulation engine supports:

- **role assignment**
  - human-controlled actor
  - AI-controlled actor
  - equilibrium-following actor
  - heuristic actor
  - scripted actor

- **branching**
  - fork from any decision point
  - compare branches side-by-side
  - save branch as scenario or playbook

- **shock injection**
  - add a new sanction
  - leadership change
  - oil spike
  - domestic unrest
  - alliance fracture
  - surprise military success / failure

- **belief and payoff updates**
  - new move changes beliefs
  - cross-game links propagate effects
  - terminal outcomes can spawn new games

- **audit trail**
  - why each move was taken
  - which evidence or assumptions drove it
  - what changed in the model after the move

This is how the product becomes a living strategic sandbox instead of just a static model viewer.

## Game theory domain knowledge

The AI prompt layer should carry a summarized but strong domain library.

### Core strategic labels to detect

- Chicken / brinkmanship
- Prisoner's Dilemma
- Coordination
- Attrition / war of attrition
- Deterrence
- Coercive bargaining
- Repeated game
- Coalition bargaining
- Bayesian / incomplete information
- Signaling
- Domestic political game
- Economic hostage / choke-point game

### Critical concepts

- Nash equilibrium
- Subgame perfect equilibrium
- Audience costs
- Commitment problems
- Discount factors
- Incomplete information
- Signaling costs
- Adverse selection in repeated interaction
- Nested / linked games
- Asymmetric conflict
- Agenda control inside coalitions
- Escalation ladders
- Time inconsistency
- Outside options and reservation utility

### Historical analogs as structured aids, not proof

The app may use historical analogs, but analogs should be explicit and bounded.

An analog is useful for:
- suggesting possible missing games
- suggesting strategy sets
- suggesting timing patterns
- identifying common commitment or signaling failures

An analog is not proof that the current case will unfold the same way.

If analogs are modeled, they should appear as evidence/inference support objects, not as hidden prompt magic.

## Benchmark suite

v3 should use a broader benchmark suite than v1 and a more disciplined one than v2.

### Core benchmark categories

1. **Textbook games**
   - PD, Chicken, coordination, signaling toy model
   - purpose: solver correctness and UI sanity

2. **Historical crisis**
   - the founding US-Iran 2026 case
   - purpose: multi-game identification, linked-game reasoning, uncertainty handling

3. **Historical sequential crisis**
   - e.g. Cuban Missile Crisis or similar sequential deterrence case
   - purpose: tree modeling, backward induction, signaling

4. **Business / regulatory strategy**
   - antitrust, standards war, cartel coordination, platform bargaining
   - purpose: non-military generality

5. **Labor / negotiation**
   - strike, repeated bargaining, deadline pressure
   - purpose: attrition, repeated interaction, audience-cost dynamics

6. **Live update benchmark**
   - a case with evidence arriving in stages
   - purpose: update discipline, stale-model detection, scenario revision

7. **Counterfactual benchmark**
   - intentionally perturb one major assumption
   - purpose: sensitivity and invalidation quality

### Benchmark metrics

- **Provenance score:** can claims and estimates be traced cleanly?
- **Epistemic layering score:** are fact, claim, inference, and assumption properly separated?
- **Formal adequacy score:** did the system use the right solver on the right structure?
- **Uncertainty calibration:** are ranges and confidence levels sensible?
- **Prediction coherence:** do scenarios update coherently when evidence changes?
- **Playout realism:** are simulation branches internally consistent and well-rationalized?
- **Bundle reproducibility:** can the analysis be replayed from the bundle?
- **Coverage:** did the model find the relevant games, players, and dependencies?

## Prompt version control

Prompt versioning remains a first-class feature.

### Core model

- official prompts ship with the app and are immutable
- users can fork them
- prompt versions are tracked per phase
- runs can be replayed against cached evidence
- official updates show diffs
- prompt sets can be exported and imported

### v3 emphasis

Prompt debugging should be especially strong for:
- evidence normalization
- formalization
- adversarial challenge
- simulation policy prompts

Those are the phases where small prompt changes can create major epistemic drift.

## Development priorities

This is a build order by dependency, not a "shrink the vision" roadmap.

### Phase 1 — Core foundations
1. Tauri scaffold + React + Vite + TypeScript strict mode
2. Layered architecture (canonical / view / derived)
3. `.gta.json` analysis file support
4. SQLite workspace + bundle manifest primitives
5. Core canonical schema with evidence ladder
6. Command/event spine with undo/redo
7. Referential integrity layer and inverse index
8. Schema migration pipeline
9. View synchronization foundation (Zustand selectors + coordination bus)
10. Graph view + Evidence notebook shell
11. Provider auth and routing basics
12. Prompt workbench baseline

Phase 1 migration is lightweight: format version stamping and additive-default normalization only. Full migration recovery, lossy tracking, and per-step validation are added when the schema stabilizes (late Phase 2 or Phase 3).

### Phase 2 — Strategic modeling core
1. StrategicGame + Formalization split
2. Matrix view + Tree view
3. Player lens + Timeline view
4. Assumption editing and contradiction surfacing
5. Cross-game link editor with typed semantics
6. Latent factor modeling
7. Basic scenario authoring

### Phase 3 — AI pipeline depth
1. Research subagents with source capture
2. Evidence normalization pipeline
3. Game / player identification
4. Formalization proposal pipeline
5. Adversarial challenge phase
6. Update-on-new-evidence flow
7. Structured diff review UI

### Phase 4 — Computation and readiness
1. Solver readiness engine
2. Expected utility
3. Dominance elimination
4. Backward induction
5. Nash solver (TS first, Rust/WASM for larger problems)
6. Bayesian updating
7. Cascade analysis
8. Dependency-aware scenario calculations
9. Mandatory sensitivity layer

### Phase 5 — Play-out engine
1. Play view
2. Role assignment (human / AI / heuristic / equilibrium)
3. Branching and branch comparison
4. Shock injection
5. Cascade inspector
6. Play-session persistence to SQLite

### Phase 6 — Reproducibility and ecosystem
1. Full `.gtbundle` export / import
2. Replay runs from saved bundles
3. Community prompt sharing
4. Benchmark harness
5. Preloaded example analyses
6. Cost / quota tracking dashboard
7. OpenRouter + local model polish

## Coding conventions

- **TypeScript strict mode.** No `any`.
- **Tagged unions over magic strings** for actors, formalizations, policies, and evidence relations.
- **Bare numbers for strategic estimates are bugs.**
- **Canonical writes go through validators** and structured diffs only.
- **Source snapshots are immutable once captured** inside a bundle.
- **Derived results never overwrite canonical data.**
- **Every solver result must carry readiness metadata.**
- **Every scenario must carry invalidators.**
- **Every play turn must record rationale and supporting refs.**
- **All AI outputs are schema-validated** before merge.
- **Unit tests for compute.** Integration tests for pipeline. Replay tests for bundles. Regression suite for benchmark cases.
- **Deterministic replay where possible.** Simulation runs should accept a seed.
- **Accessibility first.** All views keyboard navigable.
- **All canonical mutations go through the command/event spine.** No direct store writes.
- **Commands are serializable.** Important for reproducibility and debugging.
- **Events are append-only.** Never mutate a committed event.
- **ID-keyed maps in memory, arrays in JSON.** The serialization layer handles conversion.
- **Referential integrity is declared, not ad-hoc.** Use the reference schema for all entity relationships.
- **Schema migrations are testable.** Every migration step has a round-trip test with fixture data.
- **Zustand selectors are narrow.** Subscribe to the smallest data slice needed.
- **Coordination bus is ephemeral.** Never persist bus state; never derive model state from bus events.
- **Effect patches are immutable.** Once created, a patch is never modified — only accepted, rejected, or superseded.
- **Resolver outputs include full audit trails.** Every merge decision is traceable.

## Infrastructure design decisions summary

| Decision | Choice | Rationale |
|---|---|---|
| Mutation model | Command/event | Single system handles undo, integrity, sync, audit |
| Undo model | Cursor into event log | Clean, no revert-of-revert chains |
| Integrity on user delete | Cascade-aware warn-then-act | Decisive but informed |
| Integrity on AI update | Soft delete (mark stale) | Conservative, preserves analyst work |
| In-memory data structure | ID-keyed maps | Stable patches, O(1) lookups |
| Schema versioning | Monotonic integer | Simple, unambiguous |
| Schema migration | Declarative diffing + hand-written transforms | Low friction for additive, explicit for breaking |
| View data sync | Zustand selectors | Standard React, minimal re-renders |
| View coordination | Lightweight event bus | Imperative signals without render waterfalls |
| Selection state | Three-tier (bus + store + URL) | Each tier serves its own purpose |
| Cross-game effects | Two-stage patch + resolver | Inspectable, deterministic, auditable |
| Resolver conflict policy | Priority-first, then mode | Importance over mechanical type |
| Play-out architecture | Headless engine + hook API | UI-agnostic, swappable layouts |
| Branching model | All turns belong to branches | Single source of truth |
| Rewind | Quick (last turn) + fork (earlier) | Fast iteration + preserved history |
| State restoration | Checkpoint-based | O(1) branch switching |
| Branch comparison | Cumulative from fork | Most useful for "what if" analysis |
| AI pipeline errors | Structured PhaseResult, sequential merge for concurrent proposals | Human-in-the-loop, no auto-retry |
| Event log persistence | Session-scoped undo, SQLite-backed audit trail | Snapshot load, not event replay |
| Quick rewind | Discarded turns preserved in branch log | Auditability over convenience |

## Final product test

If the app is working well, a serious user should be able to do the following:

- pick a world event
- inspect the sources behind the model
- see several competing strategic framings
- choose a formalization appropriate to the question
- understand where the assumptions are
- run formal analysis only when justified
- compare multiple future scenarios
- play the event forward turn by turn
- inject a shock and watch linked games update
- export the model in a lightweight file
- export the full bundle for audit and replay

That is the bar for v3.
