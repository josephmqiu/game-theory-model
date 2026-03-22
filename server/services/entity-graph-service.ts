// Canonical server-side entity store for the Game Theory Analyzer.
// Module-level singleton matching the Zustand pattern — no class.
// The Zustand entity-graph-store will become a client-side projection of this.

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
import {
  normalizePhaseStates,
  upsertPhaseStatus,
} from "../../src/types/methodology";

// ── Module-level state ──

let analysis: Analysis = createEmptyAnalysis("");
let _isDirty = false;
let _revision = 0;
let _fileName: string | null = null;
let _filePath: string | null = null;
let _fileHandle: FileSystemFileHandle | null = null;

const listeners = new Set<(event: AnalysisMutationEvent) => void>();

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

function mutate(): void {
  _isDirty = true;
  _revision += 1;
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

// ── Core API ──

export function newAnalysis(topic: string): void {
  analysis = createEmptyAnalysis(topic);
  _isDirty = false;
  _revision += 1;
  _fileName = null;
  _filePath = null;
  _fileHandle = null;
}

export function loadAnalysis(
  loaded: Analysis,
  source?: {
    fileName?: string;
    filePath?: string;
    fileHandle?: FileSystemFileHandle;
  },
): void {
  analysis = normalizeAnalysis(loaded);
  _isDirty = false;
  _revision += 1;
  _fileName = source?.fileName ?? null;
  _filePath = source?.filePath ?? null;
  _fileHandle = source?.fileHandle ?? null;
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
  // Dedup: if an entity with this data already exists by matching id, skip
  // But since we generate new IDs, dedup by checking if the exact same entity
  // was already added (caller may pass an entity with an id field via spread)
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
  analysis = {
    ...analysis,
    phases: upsertPhaseStatus(
      analysis.phases,
      analysis.entities,
      phase,
      status,
    ),
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
  _isDirty = false;
  _revision = 0;
  _fileName = null;
  _filePath = null;
  _fileHandle = null;
  listeners.clear();
}
