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
 * Push the store's current analysis state to the entity-graph-service.
 * This keeps the service in sync after local mutations.
 */
function pushToService(analysis: Analysis): void {
  entityGraphService.loadAnalysis(analysis);
}

// ── Store ──
// This store is a PROJECTION of entity-graph-service.
// Mutations that originate from the store do local updates first (for backward
// compat with callers that rely on specific entity IDs), then push the result
// to the service via loadAnalysis(). Mutations that originate from the service
// (e.g. during AI analysis) sync into the store via subscribeToService().

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

      set((state) => {
        const existingIds = new Set(state.analysis.entities.map((e) => e.id));
        const deduped = entities.filter((e) => !existingIds.has(e.id));

        // Nothing new to add
        if (
          deduped.length === 0 &&
          (!relationships || relationships.length === 0)
        ) {
          return state;
        }

        const nextAnalysis = {
          ...state.analysis,
          entities: [...state.analysis.entities, ...deduped],
          relationships: relationships
            ? [...state.analysis.relationships, ...relationships]
            : state.analysis.relationships,
        };

        // Sync to service
        pushToService(nextAnalysis);

        return {
          analysis: nextAnalysis,
          isDirty: true,
          revision: state.revision + 1,
        };
      });
    },

    updateEntity: (id, updates) =>
      set((state) => {
        const nextAnalysis = {
          ...state.analysis,
          entities: state.analysis.entities.map((e) =>
            e.id === id ? { ...e, ...updates, id } : e,
          ),
        };

        // Sync to service
        pushToService(nextAnalysis);

        return {
          analysis: nextAnalysis,
          isDirty: true,
          revision: state.revision + 1,
        };
      }),

    removeEntity: (id) =>
      set((state) => {
        const nextAnalysis = {
          ...state.analysis,
          entities: state.analysis.entities.filter((e) => e.id !== id),
          relationships: state.analysis.relationships.filter(
            (r) => r.fromEntityId !== id && r.toEntityId !== id,
          ),
        };

        // Sync to service
        pushToService(nextAnalysis);

        return {
          analysis: nextAnalysis,
          isDirty: true,
          revision: state.revision + 1,
        };
      }),

    addRelationships: (relationships) =>
      set((state) => {
        const nextAnalysis = {
          ...state.analysis,
          relationships: [...state.analysis.relationships, ...relationships],
        };

        // Sync to service
        pushToService(nextAnalysis);

        return {
          analysis: nextAnalysis,
          isDirty: true,
          revision: state.revision + 1,
        };
      }),

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
