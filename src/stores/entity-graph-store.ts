// Architecture note: In this Electron app, renderer and main process share JS context.
// The store calls entity-graph-service directly (no IPC). subscribeToService() auto-wires
// mutation event sync at module load. This is the documented projection model for Electron.
// If the app moves to separate processes, this becomes IPC commands + SSE events.

import { create } from "zustand";
import type {
  AnalysisEntity,
  AnalysisFileReference,
  AnalysisRelationship,
  Analysis,
} from "@/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import type { MethodologyPhase, PhaseStatus } from "@/types/methodology";
import * as entityGraphService from "@/services/ai/entity-graph-service";

// ── State shape ──

interface EntityGraphStoreState extends AnalysisFileReference {
  analysis: Analysis;
  isDirty: boolean;
  revision: number;
  pendingEdits: Array<{ id: string; updates: Partial<AnalysisEntity> }>;

  newAnalysis: (topic: string) => void;
  loadAnalysis: (
    analysis: Analysis,
    source?: {
      fileName?: string;
      filePath?: string;
      fileHandle?: FileSystemFileHandle;
    },
  ) => void;
  addEntities: (
    entities: AnalysisEntity[],
    relationships?: AnalysisRelationship[],
  ) => void;
  updateEntity: (id: string, updates: Partial<AnalysisEntity>) => void;
  removeEntity: (id: string) => void;
  addRelationships: (relationships: AnalysisRelationship[]) => void;
  setPhaseStatus: (phase: MethodologyPhase, status: PhaseStatus) => void;
  getPhaseEntities: (phase: MethodologyPhase) => AnalysisEntity[];
  markStale: (entityIds: string[]) => void;
  clearStale: (entityIds: string[]) => void;
  getStaleEntityIds: () => string[];
  getDownstreamEntityIds: (entityId: string) => string[];
  setFileReference: (source: {
    fileName?: string;
    filePath?: string;
    fileHandle?: FileSystemFileHandle;
  }) => void;
  commitSave: (source: {
    fileName?: string;
    filePath?: string;
    fileHandle?: FileSystemFileHandle;
  }) => void;
  markDirty: () => void;
  syncFromService: () => void;
  subscribeToService: () => () => void;
}

// ── Helpers ──

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

/**
 * Sync the store state from entity-graph-service (the source of truth).
 */
function syncFromServiceState(): {
  analysis: Analysis;
  isDirty: boolean;
  revision: number;
} {
  return {
    analysis: entityGraphService.getAnalysis() as Analysis,
    isDirty: entityGraphService.getIsDirty(),
    revision: entityGraphService.getRevision(),
  };
}

// ── Store ──
// This store is a PROJECTION of entity-graph-service.
// Mutations route through service CRUD methods (createEntity, updateEntity, etc.)
// so that provenance stamping and event emission happen in one place.
// The store then syncs its state from the service.
// Mutations that originate from the service (e.g. during AI analysis) sync
// into the store via subscribeToService().

export const useEntityGraphStore = create<EntityGraphStoreState>(
  (set, get) => ({
    analysis: entityGraphService.getAnalysis() as Analysis,
    isDirty: false,
    revision: 0,
    fileName: null,
    filePath: null,
    fileHandle: null,
    pendingEdits: [],

    newAnalysis: (topic) => {
      entityGraphService.newAnalysis(topic);
      set((state) => ({
        analysis: entityGraphService.getAnalysis() as Analysis,
        isDirty: false,
        revision: state.revision + 1,
        fileName: null,
        filePath: null,
        fileHandle: null,
        pendingEdits: [],
      }));
    },

    loadAnalysis: (analysis, source) => {
      entityGraphService.loadAnalysis(analysis, source);
      set((state) => ({
        analysis: entityGraphService.getAnalysis() as Analysis,
        isDirty: false,
        revision: state.revision + 1,
        fileName: source?.fileName ?? null,
        filePath: source?.filePath ?? null,
        fileHandle: source?.fileHandle ?? null,
        pendingEdits: [],
      }));
    },

    addEntities: (entities, relationships) => {
      if (
        entities.length === 0 &&
        (!relationships || relationships.length === 0)
      ) {
        return;
      }

      // Route through service CRUD methods for provenance stamping
      const existingIds = new Set(
        entityGraphService.getAnalysis().entities.map((e) => e.id),
      );

      // Build ID map: caller-provided ID -> service-generated ID
      const idMap = new Map<string, string>();
      for (const entity of entities) {
        if (existingIds.has(entity.id)) continue; // dedup
        const created = entityGraphService.createEntity(
          {
            type: entity.type,
            phase: entity.phase,
            data: entity.data,
            position: entity.position,
            confidence: entity.confidence,
            source: entity.source,
            rationale: entity.rationale,
            revision: entity.revision,
            stale: entity.stale,
          },
          {
            source: entity.provenance?.source ?? "phase-derived",
            runId: entity.provenance?.runId,
            phase: entity.provenance?.phase,
          },
        );
        idMap.set(entity.id, created.id);
      }

      if (relationships) {
        for (const rel of relationships) {
          const fromId = idMap.get(rel.fromEntityId) ?? rel.fromEntityId;
          const toId = idMap.get(rel.toEntityId) ?? rel.toEntityId;
          try {
            entityGraphService.createRelationship({
              type: rel.type,
              fromEntityId: fromId,
              toEntityId: toId,
              metadata: rel.metadata,
            });
          } catch {
            // Relationship may fail if entity IDs reference entities from
            // a different phase that haven't been remapped in this batch.
          }
        }
      }

      // Sync from service
      set((state) => ({
        ...syncFromServiceState(),
        revision: state.revision + 1,
      }));
    },

    updateEntity: (id, updates) => {
      entityGraphService.updateEntity(id, updates, { source: "ai-edited" });
      set((state) => ({
        ...syncFromServiceState(),
        revision: state.revision + 1,
      }));
    },

    removeEntity: (id) => {
      entityGraphService.removeEntity(id);
      set((state) => ({
        ...syncFromServiceState(),
        revision: state.revision + 1,
      }));
    },

    addRelationships: (relationships) => {
      for (const rel of relationships) {
        try {
          entityGraphService.createRelationship({
            type: rel.type,
            fromEntityId: rel.fromEntityId,
            toEntityId: rel.toEntityId,
            metadata: rel.metadata,
          });
        } catch {
          // Entity IDs may not exist if from a different batch
        }
      }
      set((state) => ({
        ...syncFromServiceState(),
        revision: state.revision + 1,
      }));
    },

    setPhaseStatus: (phase, status) => {
      entityGraphService.setPhaseStatus(phase, status);
      set((state) => ({
        analysis: entityGraphService.getAnalysis() as Analysis,
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    getPhaseEntities: (phase) => {
      return get().analysis.entities.filter((e) => e.phase === phase);
    },

    markStale: (entityIds) => {
      entityGraphService.markStale(entityIds);
      set((state) => ({
        analysis: entityGraphService.getAnalysis() as Analysis,
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    clearStale: (entityIds) => {
      entityGraphService.clearStale(entityIds);
      set((state) => ({
        analysis: entityGraphService.getAnalysis() as Analysis,
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    getStaleEntityIds: () => {
      return get()
        .analysis.entities.filter((e) => e.stale)
        .map((e) => e.id);
    },

    getDownstreamEntityIds: (entityId) => {
      return bfsDownstream(entityId, get().analysis.relationships);
    },

    setFileReference: (source) => {
      entityGraphService.setFileReference(source);
      set((state) => ({
        fileName:
          source.fileName === undefined ? state.fileName : source.fileName,
        filePath:
          source.filePath === undefined ? state.filePath : source.filePath,
        fileHandle:
          source.fileHandle === undefined
            ? state.fileHandle
            : source.fileHandle,
      }));
    },

    commitSave: (source) => {
      entityGraphService.commitSave(source);
      set((state) => ({
        fileName:
          source.fileName === undefined ? state.fileName : source.fileName,
        filePath:
          source.filePath === undefined ? state.filePath : source.filePath,
        fileHandle:
          source.fileHandle === undefined
            ? state.fileHandle
            : source.fileHandle,
        isDirty: false,
      }));
    },

    markDirty: () => {
      entityGraphService.markDirty();
      set({ isDirty: true });
    },

    syncFromService: () => {
      const analysis = entityGraphService.getAnalysis() as Analysis;
      set((state) => ({
        analysis,
        isDirty: entityGraphService.getIsDirty(),
        revision: state.revision + 1,
      }));
    },

    subscribeToService: () => {
      const unsubscribe = entityGraphService.onMutation(() => {
        // On any mutation event from the service, sync the full state
        const analysis = entityGraphService.getAnalysis() as Analysis;
        set((state) => ({
          analysis,
          isDirty: entityGraphService.getIsDirty(),
          revision: state.revision + 1,
        }));
      });

      return unsubscribe;
    },
  }),
);

// Auto-wire: keep the Zustand projection in sync when the service is mutated
// externally (e.g. by the analysis orchestrator during AI runs).
useEntityGraphStore.getState().subscribeToService();
