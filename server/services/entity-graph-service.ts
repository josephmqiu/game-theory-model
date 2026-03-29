// Canonical server-side entity store for the Game Theory Analyzer.
// SQLite-backed write-through cache scoped to the active workspace.
// The Zustand entity-graph-store is a client-side projection of this.
//
// SOURCE OF TRUTH HIERARCHY:
//
// 1. graph_entities / graph_relationships / graph_phase_states (SQLite)
//    — Persistent canonical source.
// 2. entity-graph-service in-memory `analysis` (this module)
//    — Write-through cache of (1). Always in sync within a process.
// 3. workspace_json in workspaces table (SQLite)
//    — Non-entity metadata (layout, threads, artifacts).
//    — Entity data derived from (1) at write time. Never read as authoritative.
// 4. Zustand entity-graph-store (renderer)
//    — Client projection. Hydrated from (2) via GET /api/ai/state.
//    — Owns layout. Not authoritative for entities.
// 5. .gta files (disk)
//    — Portable snapshot. Entities from (2) at export. On import, flows into (1).

import { nanoid } from "nanoid";
import type {
  AnalysisEntity,
  AnalysisRelationship,
  Analysis,
  EntityProvenance,
  EntitySource,
  RelationshipType,
} from "../../shared/types/entity";
import type {
  MethodologyPhase,
  PhaseStatus,
} from "../../shared/types/methodology";
import type { AnalysisMutationEvent } from "../../shared/types/events";
import { serverLog } from "../utils/ai-logger";
import { RELATIONSHIP_CATEGORY } from "../../src/types/entity";
import * as runtimeStatus from "./runtime-status";
import {
  normalizePhaseStates,
  upsertPhaseStatus,
} from "../../src/types/methodology";
import type { EntityGraphRepository } from "./workspace/entity-graph-repository";
import { getWorkspaceDatabase } from "./workspace/workspace-db";

// ── Module-level state ──

let analysis: Analysis = createEmptyAnalysis("");
let _workspaceId: string | null = null;
let _analysisId: string | null = null;
let _isDirty = false;
let _revision = 0;
let _fileName: string | null = null;
let _filePath: string | null = null;
let _fileHandle: FileSystemFileHandle | null = null;

const listeners = new Set<(event: AnalysisMutationEvent) => void>();

// ── Batch state ──
// When a batch is active, SQLite writes participate in a single transaction
// and emit() calls are deferred until commitBatch().

interface BatchState {
  /** Snapshot of `analysis` at beginBatch() for rollback */
  snapshot: Analysis;
  /** Deferred mutation events collected during the batch */
  deferredEvents: AnalysisMutationEvent[];
  /** Whether we opened a SQLite transaction (false in unit tests without db) */
  transactionOpen: boolean;
}

let _batch: BatchState | null = null;

// ── SQLite backing ──
// Lazy import to avoid pulling node:sqlite into the module graph eagerly.
// Bun does not support node:sqlite, so static imports break the dev server.

let _repoOverride: EntityGraphRepository | null = null;
let _getWorkspaceDatabase:
  | (() => { entityGraph: EntityGraphRepository })
  | null = null;

function getRepo(): EntityGraphRepository {
  if (_repoOverride) return _repoOverride;
  if (!_getWorkspaceDatabase) {
    // Lazy-bind on first access. Uses dynamic import() to avoid:
    // 1. Static import of node:sqlite (breaks Bun-hosted Vite dev server)
    // 2. Barrel-level side-effect imports (deadlocks vitest mock resolution)
    // The synchronous throw below is caught; callers should ensure
    // _bindWorkspaceDatabaseForInit() was called during server bootstrap.
    throw new Error(
      "entity-graph-service: workspace database not bound. " +
        "Call _bindWorkspaceDatabaseForInit() during server startup.",
    );
  }
  return _getWorkspaceDatabase().entityGraph;
}

/**
 * Wire the workspace database accessor. Must be called once during server
 * bootstrap (e.g. from a Nitro plugin or test setup) before any entity
 * mutations. Avoids pulling node:sqlite into the static import graph.
 */
export function _bindWorkspaceDatabaseForInit(
  accessor: () => { entityGraph: EntityGraphRepository },
): void {
  if (!_getWorkspaceDatabase) {
    _getWorkspaceDatabase = accessor;
  }
}

function hasWorkspaceContext(): boolean {
  return _workspaceId !== null && _analysisId !== null;
}

function persistEntity(entity: AnalysisEntity): void {
  if (!hasWorkspaceContext()) return;
  getRepo().upsertEntity(_workspaceId!, _analysisId!, entity);
}

function persistRelationship(rel: AnalysisRelationship): void {
  if (!hasWorkspaceContext()) return;
  getRepo().upsertRelationship(_workspaceId!, _analysisId!, rel);
}

// ── Helpers ──

function createEmptyAnalysis(topic: string): Analysis {
  return {
    id: nanoid(),
    name: topic,
    topic,
    entities: [],
    relationships: [],
    phases: normalizePhaseStates([], []),
  };
}

function normalizeAnalysis(analysisState: Analysis): Analysis {
  return {
    ...analysisState,
    phases: normalizePhaseStates(analysisState.phases, analysisState.entities),
  };
}

function emit(event: AnalysisMutationEvent): void {
  if (_batch) {
    _batch.deferredEvents.push(event);
    return;
  }
  for (const cb of listeners) {
    cb(event);
  }
}

/**
 * BFS traversal following downstream relationships from a source entity.
 * Returns all transitively reachable toEntityIds (excluding the source).
 */
function bfsDownstream(
  entityId: string,
  relationships: AnalysisRelationship[],
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [entityId];
  visited.add(entityId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const rel of relationships) {
      if (
        rel.fromEntityId === current &&
        RELATIONSHIP_CATEGORY[rel.type] === "downstream" &&
        !visited.has(rel.toEntityId)
      ) {
        visited.add(rel.toEntityId);
        queue.push(rel.toEntityId);
      }
    }
  }

  // Remove the source entity from the result
  visited.delete(entityId);
  return Array.from(visited);
}

function mutate(options?: { markDirty?: boolean }): void {
  if (options?.markDirty ?? true) {
    _isDirty = true;
  }
  _revision += 1;
  runtimeStatus.incrementRevision();
}

function entitySourceForProvenance(
  source: EntityProvenance["source"],
): EntitySource {
  switch (source) {
    case "user-edited":
      return "human";
    case "ai-edited":
    case "phase-derived":
    default:
      return "ai";
  }
}

// ── Initialization ──

/**
 * Hydrate the in-memory cache from SQLite for the given workspace.
 * Called during app startup / workspace open.
 */
export function initializeFromDatabase(workspaceId: string): void {
  const repo = getRepo();
  const meta = repo.getAnalysisMetadata(workspaceId);

  if (!meta) {
    // No existing analysis in graph tables — check workspace_json for migration
    try {
      const db = getWorkspaceDatabase();
      const record = db?.workspaces?.getWorkspace(workspaceId);
      if (record?.workspaceJson) {
        const parsed = JSON.parse(record.workspaceJson);
        if (
          parsed?.analysis &&
          Array.isArray(parsed.analysis.entities) &&
          parsed.analysis.entities.length > 0
        ) {
          loadAnalysis(parsed.analysis, { workspaceId });
          serverLog(undefined, "entity-graph", "migrated-from-workspace-json", {
            workspaceId,
            entityCount: parsed.analysis.entities.length,
          });
          return;
        }
      }
    } catch {
      // workspace DB not available yet — proceed with empty state
    }

    _workspaceId = workspaceId;
    _analysisId = analysis.id;
    return;
  }

  const entities = repo.listEntities(meta.analysisId);
  const relationships = repo.listRelationships(meta.analysisId);
  const phases = repo.listPhaseStates(meta.analysisId);

  const restored: Analysis = {
    id: meta.analysisId,
    name: meta.name,
    topic: meta.topic,
    entities,
    relationships,
    phases,
  };

  _workspaceId = workspaceId;
  _analysisId = meta.analysisId;
  analysis = normalizeAnalysis(restored);
  _isDirty = false;
  _revision = 0;
  _fileName = null;
  _filePath = null;
  _fileHandle = null;

  serverLog(undefined, "entity-graph", "initialized-from-database", {
    workspaceId,
    analysisId: meta.analysisId,
    entityCount: entities.length,
    relationshipCount: relationships.length,
  });
}

export function getWorkspaceId(): string | null {
  return _workspaceId;
}

export function getAnalysisId(): string | null {
  return _analysisId;
}

// ── Core API ──

export function newAnalysis(topic: string, workspaceId?: string): void {
  const newId = nanoid();
  analysis = createEmptyAnalysis(topic);
  analysis.id = newId;

  _workspaceId = workspaceId ?? _workspaceId;
  _analysisId = newId;

  // Persist to SQLite (replaceAnalysis includes metadata insert)
  if (_workspaceId) {
    getRepo().replaceAnalysis(_workspaceId, analysis);
  }

  _isDirty = false;
  _fileName = null;
  _filePath = null;
  _fileHandle = null;
  mutate({ markDirty: false });
}

export function loadAnalysis(
  loaded: Analysis,
  source?: {
    fileName?: string;
    filePath?: string;
    fileHandle?: FileSystemFileHandle;
    workspaceId?: string;
  },
): void {
  analysis = normalizeAnalysis(loaded);
  _analysisId = loaded.id;

  if (source?.workspaceId) {
    _workspaceId = source.workspaceId;
  }

  // Persist to SQLite (replaceAnalysis includes metadata insert)
  if (_workspaceId) {
    getRepo().replaceAnalysis(_workspaceId, analysis);
  }

  _isDirty = false;
  _fileName = source?.fileName ?? null;
  _filePath = source?.filePath ?? null;
  _fileHandle = source?.fileHandle ?? null;
  mutate({ markDirty: false });
}

export function getAnalysis(): Readonly<Analysis> {
  return normalizeAnalysis(analysis);
}

export function createEntity(
  data: Omit<AnalysisEntity, "id" | "provenance" | "source">,
  provenance: {
    source: EntityProvenance["source"];
    runId?: string;
    phase?: string;
  },
): AnalysisEntity {
  const id = nanoid();

  const fullProvenance: EntityProvenance = {
    source: provenance.source,
    runId: provenance.runId,
    phase: provenance.phase,
    timestamp: Date.now(),
  };

  const entity: AnalysisEntity = {
    ...data,
    id,
    source: entitySourceForProvenance(provenance.source),
    provenance: fullProvenance,
  };

  // Dedup by ID — if somehow a duplicate sneaks through
  const existingIds = new Set(analysis.entities.map((e) => e.id));
  if (!existingIds.has(entity.id)) {
    // SQLite first
    persistEntity(entity);

    // In-memory update
    analysis = {
      ...analysis,
      entities: [...analysis.entities, entity],
    };
    mutate();
    emit({ type: "entity_created", entity });
    serverLog(provenance.runId, "entity-graph", "entity-created", {
      id: entity.id,
      type: entity.type,
      phase: provenance.phase,
    });
  }

  return entity;
}

export function createRelationship(
  data: Omit<AnalysisRelationship, "id">,
  provenance?: {
    source: EntityProvenance["source"];
    runId?: string;
    phase?: string;
  },
): AnalysisRelationship {
  // Validate that both entity IDs exist
  const entityIds = new Set(analysis.entities.map((e) => e.id));
  if (!entityIds.has(data.fromEntityId)) {
    throw new Error(
      `createRelationship: fromEntityId "${data.fromEntityId}" does not exist`,
    );
  }
  if (!entityIds.has(data.toEntityId)) {
    throw new Error(
      `createRelationship: toEntityId "${data.toEntityId}" does not exist`,
    );
  }

  const relationship: AnalysisRelationship = {
    ...data,
    id: nanoid(),
    ...(provenance
      ? {
          source: entitySourceForProvenance(provenance.source),
          provenance: {
            source: provenance.source,
            runId: provenance.runId,
            phase: provenance.phase,
            timestamp: Date.now(),
          },
        }
      : {}),
  };

  // SQLite first
  persistRelationship(relationship);

  // In-memory update
  analysis = {
    ...analysis,
    relationships: [...analysis.relationships, relationship],
  };
  mutate();
  emit({ type: "relationship_created", relationship });
  serverLog(provenance?.runId, "entity-graph", "relationship-created", {
    id: relationship.id,
    from: relationship.fromEntityId,
    to: relationship.toEntityId,
    type: relationship.type,
  });

  return relationship;
}

export function updateEntity(
  id: string,
  updates: Partial<Omit<AnalysisEntity, "id" | "provenance" | "source">>,
  provenance: { source: EntityProvenance["source"]; runId?: string },
): AnalysisEntity | null {
  const existing = analysis.entities.find((e) => e.id === id);
  if (!existing) return null;

  const previousProvenance: EntityProvenance = existing.provenance ?? {
    source: "phase-derived",
    timestamp: 0,
  };

  const newProvenance: EntityProvenance = {
    source: provenance.source,
    runId: provenance.runId,
    timestamp: Date.now(),
    previousOrigin: previousProvenance,
  };

  const updated: AnalysisEntity = {
    ...existing,
    ...updates,
    id, // preserve original ID
    source: entitySourceForProvenance(provenance.source),
    provenance: newProvenance,
  };

  // SQLite first
  persistEntity(updated);

  // In-memory update
  analysis = {
    ...analysis,
    entities: analysis.entities.map((e) => (e.id === id ? updated : e)),
  };
  mutate();
  emit({ type: "entity_updated", entity: updated, previousProvenance });
  serverLog(provenance.runId, "entity-graph", "entity-updated", {
    id,
    type: updated.type,
    fields: Object.keys(updates).length,
  });

  // Propagate staleness to downstream dependents so revalidation picks them up
  const downstream = bfsDownstream(id, analysis.relationships);
  if (downstream.length > 0) {
    markStale(downstream);
  }

  return updated;
}

export function updateRelationship(
  id: string,
  updates: Partial<AnalysisRelationship>,
): AnalysisRelationship | null {
  const existing = analysis.relationships.find((r) => r.id === id);
  if (!existing) return null;

  const updated: AnalysisRelationship = {
    ...existing,
    ...updates,
    id, // preserve original ID
  };

  // SQLite first
  persistRelationship(updated);

  // In-memory update
  analysis = {
    ...analysis,
    relationships: analysis.relationships.map((r) =>
      r.id === id ? updated : r,
    ),
  };
  mutate();
  emit({ type: "relationship_updated", relationship: updated });

  return updated;
}

export function removeRelationship(id: string): boolean {
  const relationship = analysis.relationships.find((r) => r.id === id);
  if (!relationship) return false;

  // SQLite first
  if (hasWorkspaceContext()) {
    getRepo().deleteRelationship(id);
  }

  // In-memory update
  analysis = {
    ...analysis,
    relationships: analysis.relationships.filter((r) => r.id !== id),
  };
  mutate();
  emit({ type: "relationship_deleted", relationshipId: relationship.id });

  return true;
}

export function getEntitiesByPhase(phase: MethodologyPhase): AnalysisEntity[] {
  return analysis.entities.filter((e) => e.phase === phase);
}

export function getRelationships(filters?: {
  type?: RelationshipType;
  entityId?: string;
}): AnalysisRelationship[] {
  let result = analysis.relationships;

  if (filters?.type) {
    result = result.filter((r) => r.type === filters.type);
  }

  if (filters?.entityId) {
    result = result.filter(
      (r) =>
        r.fromEntityId === filters.entityId ||
        r.toEntityId === filters.entityId,
    );
  }

  return result;
}

export function markStale(entityIds: string[]): void {
  if (entityIds.length === 0) return;

  // SQLite first
  if (hasWorkspaceContext()) {
    getRepo().updateStaleFlags(entityIds, true);
  }

  // In-memory update
  const idSet = new Set(entityIds);
  analysis = {
    ...analysis,
    entities: analysis.entities.map((e) =>
      idSet.has(e.id) ? { ...e, stale: true } : e,
    ),
  };
  mutate();
  emit({ type: "stale_marked", entityIds });
}

export function clearStale(entityIds: string[]): void {
  if (entityIds.length === 0) return;

  // SQLite first
  if (hasWorkspaceContext()) {
    getRepo().updateStaleFlags(entityIds, false);
  }

  // In-memory update
  const idSet = new Set(entityIds);
  analysis = {
    ...analysis,
    entities: analysis.entities.map((e) =>
      idSet.has(e.id) ? { ...e, stale: false } : e,
    ),
  };
  mutate();
}

export function getStaleEntityIds(): string[] {
  return analysis.entities.filter((e) => e.stale).map((e) => e.id);
}

export function getDownstreamEntityIds(entityId: string): string[] {
  return bfsDownstream(entityId, analysis.relationships);
}

export function removeEntity(id: string): boolean {
  const exists = analysis.entities.some((e) => e.id === id);
  if (!exists) return false;

  const removedRelationshipIds = analysis.relationships
    .filter((r) => r.fromEntityId === id || r.toEntityId === id)
    .map((r) => r.id);

  // SQLite first
  if (hasWorkspaceContext()) {
    getRepo().deleteRelationshipsByEntityIds([id]);
    getRepo().deleteEntity(id);
  }

  // In-memory update
  analysis = {
    ...analysis,
    entities: analysis.entities.filter((e) => e.id !== id),
    relationships: analysis.relationships.filter(
      (r) => r.fromEntityId !== id && r.toEntityId !== id,
    ),
  };
  mutate();
  emit({ type: "entity_deleted", entityId: id });
  for (const relationshipId of removedRelationshipIds) {
    emit({ type: "relationship_deleted", relationshipId });
  }
  return true;
}

export function removePhaseEntities(
  phase: MethodologyPhase,
  runId?: string,
): void {
  const removedIds = new Set<string>();

  const remaining = analysis.entities.filter((e) => {
    if (e.phase !== phase) return true;
    if (runId !== undefined) {
      // Only remove if provenance.runId matches
      if (e.provenance?.runId !== runId) return true;
    } else {
      // No runId: preserve user-edited and ai-edited entities
      const source = e.provenance?.source;
      if (source === "user-edited" || source === "ai-edited") return true;
    }
    removedIds.add(e.id);
    return false;
  });

  // Also remove relationships referencing removed entities
  const remainingRelationships = analysis.relationships.filter(
    (r) => !removedIds.has(r.fromEntityId) && !removedIds.has(r.toEntityId),
  );

  // SQLite first
  if (hasWorkspaceContext() && removedIds.size > 0) {
    const ids = Array.from(removedIds);
    getRepo().deleteRelationshipsByEntityIds(ids);
    getRepo().deleteEntitiesByIds(ids);
  }

  // In-memory update
  analysis = {
    ...analysis,
    entities: remaining,
    relationships: remainingRelationships,
  };
  mutate();
  emit({ type: "state_changed" });
}

export function setPhaseStatus(
  phase: MethodologyPhase,
  status: PhaseStatus,
): void {
  const newPhases = upsertPhaseStatus(
    analysis.phases,
    analysis.entities,
    phase,
    status,
  );

  // SQLite first — persist the updated phase state
  if (hasWorkspaceContext()) {
    const updatedPhase = newPhases.find((p) => p.phase === phase);
    if (updatedPhase) {
      getRepo().upsertPhaseState(
        _workspaceId!,
        _analysisId!,
        phase,
        updatedPhase,
      );
    }
  }

  // In-memory update
  analysis = {
    ...analysis,
    phases: newPhases,
  };
  mutate();
  emit({ type: "state_changed" });
}

// ── Persistence ──

export function getIsDirty(): boolean {
  return _isDirty;
}

export function getRevision(): number {
  return _revision;
}

export function getFileName(): string | null {
  return _fileName;
}

export function getFilePath(): string | null {
  return _filePath;
}

export function getFileHandle(): FileSystemFileHandle | null {
  return _fileHandle;
}

export function setFileReference(source: {
  fileName?: string;
  filePath?: string;
  fileHandle?: FileSystemFileHandle;
}): void {
  if (source.fileName !== undefined) _fileName = source.fileName;
  if (source.filePath !== undefined) _filePath = source.filePath;
  if (source.fileHandle !== undefined) _fileHandle = source.fileHandle;
}

export function commitSave(source: {
  fileName?: string;
  filePath?: string;
  fileHandle?: FileSystemFileHandle;
}): void {
  if (source.fileName !== undefined) _fileName = source.fileName;
  if (source.filePath !== undefined) _filePath = source.filePath;
  if (source.fileHandle !== undefined) _fileHandle = source.fileHandle;
  _isDirty = false;
}

export function markDirty(): void {
  _isDirty = true;
}

// ── Batching ──

/**
 * Begin an atomic batch. All SQLite writes are wrapped in a single transaction
 * and all emit() calls are deferred until commitBatch(). If no workspace
 * context is bound (e.g. unit tests), event deferral still applies but
 * no SQLite transaction is opened.
 */
export function beginBatch(): void {
  if (_batch) {
    throw new Error(
      "entity-graph-service: beginBatch() called while a batch is already active",
    );
  }
  let transactionOpen = false;
  if (hasWorkspaceContext()) {
    getWorkspaceDatabase().db.exec("SAVEPOINT entity_batch");
    transactionOpen = true;
  }
  _batch = {
    snapshot: analysis,
    deferredEvents: [],
    transactionOpen,
  };
}

/**
 * Commit the active batch. Commits the SQLite transaction, clears batch state,
 * then emits a single `state_changed` event so clients re-sync.
 * Returns the array of deferred events for logging/debugging.
 */
export function commitBatch(): AnalysisMutationEvent[] {
  if (!_batch) {
    throw new Error(
      "entity-graph-service: commitBatch() called without an active batch",
    );
  }
  const { deferredEvents, transactionOpen } = _batch;
  if (transactionOpen) {
    try {
      getWorkspaceDatabase().db.exec("RELEASE entity_batch");
    } catch (error) {
      // RELEASE failed — roll back to the savepoint. Restore in-memory state.
      getWorkspaceDatabase().db.exec("ROLLBACK TO entity_batch");
      analysis = _batch.snapshot;
      _batch = null;
      throw error;
    }
  }
  _batch = null;
  // Emit a single state_changed so clients re-fetch the full graph.
  emit({ type: "state_changed" });
  return deferredEvents;
}

/**
 * Roll back the active batch. Rolls back the SQLite transaction, restores the
 * in-memory analysis to its pre-batch snapshot, and discards all deferred events.
 */
export function rollbackBatch(): void {
  if (!_batch) {
    throw new Error(
      "entity-graph-service: rollbackBatch() called without an active batch",
    );
  }
  const { transactionOpen, snapshot } = _batch;
  if (transactionOpen) {
    getWorkspaceDatabase().db.exec("ROLLBACK TO entity_batch");
  }
  analysis = snapshot;
  _batch = null;
}

/** Returns true if a batch is currently active. */
export function isBatching(): boolean {
  return _batch !== null;
}

// ── Events ──

export function onMutation(
  callback: (event: AnalysisMutationEvent) => void,
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// ── Testing ──

/** Reset all module state. Only for use in tests. */
export function _resetForTest(): void {
  analysis = createEmptyAnalysis("");
  _workspaceId = null;
  _analysisId = null;
  _isDirty = false;
  _revision = 0;
  _fileName = null;
  _filePath = null;
  _fileHandle = null;
  _repoOverride = null;
  _batch = null;
  listeners.clear();
}

/** Override the repository for testing. Only for use in tests. */
export function _setRepoForTest(repo: EntityGraphRepository | null): void {
  _repoOverride = repo;
}
