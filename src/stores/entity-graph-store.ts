// Architecture: In browser mode, state comes via analysis-client SSE.
// In Electron, local mutations still work.
// This store is now purely a local state container — no server-side service imports.

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  AnalysisEntity,
  AnalysisFileReference,
  AnalysisRelationship,
  Analysis,
} from "../../shared/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import type { MethodologyPhase, PhaseStatus } from "../../shared/types/methodology";
import { V1_PHASES } from "@/types/methodology";

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
  updateEntity: (
    id: string,
    updates: Partial<AnalysisEntity>,
    source?: "ai-edited" | "user-edited",
  ) => void;
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

  // SSE sync methods — used by analysis-client for renderer-side updates
  syncAnalysis: (analysis: Analysis) => void;
  setPhaseStatusLocal: (phase: string, status: PhaseStatus) => void;
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
 * Create an empty analysis with default phase states.
 */
function createEmptyAnalysis(topic: string): Analysis {
  return {
    id: nanoid(),
    name: topic,
    topic,
    entities: [],
    relationships: [],
    phases: V1_PHASES.map((phase) => ({
      phase,
      status: "pending" as const,
      entityIds: [],
    })),
  };
}

// ── Store ──
// This store is a LOCAL state container for the renderer.
// In browser mode, state arrives via analysis-client SSE (syncAnalysis / setPhaseStatusLocal).
// Local mutations (addEntities, updateEntity, etc.) still work for Electron mode
// and for offline/backward-compat scenarios.

export const useEntityGraphStore = create<EntityGraphStoreState>(
  (set, get) => ({
    analysis: createEmptyAnalysis(""),
    isDirty: false,
    revision: 0,
    fileName: null,
    filePath: null,
    fileHandle: null,
    pendingEdits: [],

    newAnalysis: (topic) => {
      set((state) => ({
        analysis: createEmptyAnalysis(topic),
        isDirty: false,
        revision: state.revision + 1,
        fileName: null,
        filePath: null,
        fileHandle: null,
        pendingEdits: [],
      }));
    },

    loadAnalysis: (analysis, source) => {
      set((state) => ({
        analysis,
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
        const newEntities = entities.filter((e) => !existingIds.has(e.id));
        const newRelationships = relationships ?? [];

        return {
          analysis: {
            ...state.analysis,
            entities: [...state.analysis.entities, ...newEntities],
            relationships: [
              ...state.analysis.relationships,
              ...newRelationships,
            ],
          },
          isDirty: true,
          revision: state.revision + 1,
        };
      });
    },

    updateEntity: (id, updates, source) => {
      set((state) => ({
        analysis: {
          ...state.analysis,
          entities: state.analysis.entities.map((e) => {
            if (e.id !== id) return e;
            const provenanceSource = source ?? "user-edited";
            return {
              ...e,
              ...updates,
              provenance: {
                ...e.provenance,
                source: provenanceSource,
                timestamp: Date.now(),
              },
            };
          }),
        },
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    removeEntity: (id) => {
      set((state) => ({
        analysis: {
          ...state.analysis,
          entities: state.analysis.entities.filter((e) => e.id !== id),
          relationships: state.analysis.relationships.filter(
            (r) => r.fromEntityId !== id && r.toEntityId !== id,
          ),
        },
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    addRelationships: (relationships) => {
      set((state) => ({
        analysis: {
          ...state.analysis,
          relationships: [...state.analysis.relationships, ...relationships],
        },
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    setPhaseStatus: (phase, status) => {
      set((state) => ({
        analysis: {
          ...state.analysis,
          phases: state.analysis.phases.map((ps) =>
            ps.phase === phase ? { ...ps, status } : ps,
          ),
        },
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    getPhaseEntities: (phase) => {
      return get().analysis.entities.filter((e) => e.phase === phase);
    },

    markStale: (entityIds) => {
      const idSet = new Set(entityIds);
      set((state) => ({
        analysis: {
          ...state.analysis,
          entities: state.analysis.entities.map((e) =>
            idSet.has(e.id) ? { ...e, stale: true } : e,
          ),
        },
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    clearStale: (entityIds) => {
      const idSet = new Set(entityIds);
      set((state) => ({
        analysis: {
          ...state.analysis,
          entities: state.analysis.entities.map((e) =>
            idSet.has(e.id) ? { ...e, stale: false } : e,
          ),
        },
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
      set({ isDirty: true });
    },

    // syncAnalysis: like loadAnalysis but preserves isDirty and file refs (for SSE sync)
    syncAnalysis: (analysis) =>
      set((state) => ({
        analysis,
        revision: state.revision + 1,
        // Note: does NOT clear isDirty or file refs — those are for save/load lifecycle
      })),

    // setPhaseStatusLocal: local phase status update from SSE progress events
    setPhaseStatusLocal: (phase, status) =>
      set((state) => ({
        analysis: {
          ...state.analysis,
          phases: state.analysis.phases.map((ps) =>
            ps.phase === phase ? { ...ps, status } : ps,
          ),
        },
        revision: state.revision + 1,
      })),
  }),
);
