# Phase 4: Persistence Consolidation (Single Source of Truth)

## Context

The T3 migration eng review codex outside voice identified 4 sources of truth for entity state:

1. **`graph_entities` / `graph_relationships` SQLite tables** — normalized, per-workspace
2. **`workspace_json` column** in workspaces table — serialized snapshot of entire analysis
3. **Domain events** — audit trail of all mutations
4. **`.gta` files** — portable export format

These can silently drift. For example, `analysis.reset` writes a partial snapshot into `workspace_json` that may disagree with the graph tables. The fix: designate the normalized graph tables as THE canonical source, and make everything else derive from them.

**Depends on:** Phase 1 (code quality cleanup) should be done first since entity-graph-service changes overlap.

## Changes

### 1. Make workspace_json derive from graph tables on save

**Files to modify:**
- `server/services/workspace/workspace-repository.ts`
- `server/services/entity-graph-service.ts`
- `server/services/command-handlers.ts` (if it writes workspace_json directly)

**What to do:**
- When saving workspace state, serialize the entity graph FROM the graph tables (via `entity-graph-repository`), not from the in-memory `analysis` object.
- The `workspace_json` column should be a denormalized cache of what's in the graph tables — updated atomically when graph tables change.
- If `workspace_json` is read before graph tables exist (cold start, legacy workspace), fall back to parsing `workspace_json` and migrating to graph tables.

### 2. Make .gta export read from graph tables

**Files to modify:**
- `src/services/analysis/analysis-file.ts`
- `src/services/analysis/analysis-persistence.ts`

**What to do:**
- When exporting a `.gta` file, the data should come from the server (which reads from graph tables), not from the renderer's in-memory Zustand store.
- If the export currently reads from `entity-graph-store` (Zustand), change it to fetch from the server API instead.
- This may require a new API endpoint or extending an existing one to return the full serializable analysis.

### 3. Remove workspace_json entity duplication

**Files to modify:**
- `server/services/workspace/workspace-repository.ts`

**What to do:**
- After the above changes, `workspace_json` no longer needs to contain entity/relationship data — it only needs workspace-level metadata (topic, layout preferences, etc.).
- Slim down the `workspace_json` schema to exclude entity data.
- Add a migration (schema v8) that strips entity data from existing `workspace_json` values.
- OR: if `workspace_json` serves other purposes beyond entities, keep it but ensure entity data is never read from it when graph tables exist.

### 4. Document the canonical source hierarchy

**File to create or modify:** Add a comment at the top of `entity-graph-service.ts` or `entity-graph-repository.ts`:

```
// CANONICAL SOURCE OF TRUTH HIERARCHY:
// 1. graph_entities + graph_relationships (SQLite) — canonical
// 2. In-memory analysis cache — write-through from (1), rebuilt on startup
// 3. workspace_json — derived snapshot, rebuilt from (1) on save
// 4. .gta files — portable export, serialized from (1) via API
// 5. Domain events — audit trail, NOT a source of entity state
```

## Investigation needed

Before implementing, you should:

1. **Read `workspace-repository.ts`** to understand how `workspace_json` is written and read.
2. **Read `analysis-file.ts` and `analysis-persistence.ts`** to understand how `.gta` export works.
3. **Read `command-handlers.ts`** to find where `analysis.reset` writes to `workspace_json`.
4. **Grep for `workspace_json`** across the codebase to find all read/write sites.
5. **Determine if `workspace_json` has non-entity data** (topic, layout, etc.) that needs to be preserved.

The exact implementation depends on what you find. The goal is clear: graph tables are canonical, everything else derives.

## Acceptance Criteria

- `bun run typecheck` passes
- `bun run test` passes
- `bun run build` passes
- Entity data is never read from `workspace_json` when graph tables exist
- `.gta` export serializes from graph tables (via server), not renderer memory
- No scenario exists where `workspace_json` entity data disagrees with graph tables
- Clear comment documents the source hierarchy

## What NOT to change

- Do not modify the graph_entities/graph_relationships schema — they're already correct
- Do not remove domain events — they serve the audit trail purpose
- Do not change the .gta file format — only change WHERE the data comes from
- Do not break backward compatibility for existing .gta files
- Do not remove workspace_json entirely — it may hold non-entity metadata
