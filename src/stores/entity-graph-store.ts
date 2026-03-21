// Architecture: In browser mode, state comes via analysis-client SSE.
// In Electron, local mutations still work.
// This store is now purely a local state container — no server-side service imports.

import { create } from "zustand";
import { nanoid } from "nanoid";
import { layoutEntities } from "@/services/entity/entity-layout";
import type {
  AnalysisEntity,
  AnalysisFileReference,
  AnalysisRelationship,
  Analysis,
  LayoutState,
} from "../../shared/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import type { MethodologyPhase, PhaseStatus } from "../../shared/types/methodology";
import {
  normalizePhaseStates,
  upsertPhaseStatus,
} from "@/types/methodology";

// ── State shape ──

interface EntityGraphStoreState extends AnalysisFileReference {
  analysis: Analysis;
  layout: LayoutState;
  isDirty: boolean;
  revision: number;
  pendingEdits: Array<{ id: string; updates: Partial<AnalysisEntity> }>;

  newAnalysis: (topic: string) => void;
  loadAnalysis: (
    analysis: Analysis,
    layout?: LayoutState,
    source?: {
      fileName?: string;
      filePath?: string;
      fileHandle?: FileSystemFileHandle;
    },
  ) => void;
  setLayout: (layout: LayoutState) => void;
  updateLayout: (updates: LayoutState) => void;
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
  upsertEntityFromServer: (entity: AnalysisEntity) => void;
  removeEntityFromServer: (id: string) => void;
  upsertRelationshipFromServer: (relationship: AnalysisRelationship) => void;
  removeRelationshipFromServer: (id: string) => void;
  markStaleFromServer: (entityIds: string[]) => void;
  syncAnalysisFromServer: (analysis: Analysis) => void;
  reconcileLayout: () => void;
  pinEntityPosition: (id: string, x: number, y: number) => void;
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
    phases: normalizePhaseStates([], []),
  };
}

function normalizeAnalysis(analysis: Analysis): Analysis {
  return {
    ...analysis,
    phases: normalizePhaseStates(analysis.phases, analysis.entities),
  };
}

function pruneLayout(
  layout: LayoutState,
  entities: AnalysisEntity[],
): LayoutState {
  const validIds = new Set(entities.map((entity) => entity.id));
  return Object.fromEntries(
    Object.entries(layout).filter(([entityId]) => validIds.has(entityId)),
  );
}

function reconcileLayoutState(
  layout: LayoutState,
  entities: AnalysisEntity[],
): LayoutState {
  const prunedLayout = pruneLayout(layout, entities);
  const computedPositions = layoutEntities(entities);
  const nextLayout: LayoutState = { ...prunedLayout };

  for (const entity of entities) {
    const existingEntry = prunedLayout[entity.id];
    if (existingEntry?.pinned) {
      nextLayout[entity.id] = existingEntry;
      continue;
    }

    const computedPosition = computedPositions.get(entity.id);
    if (!computedPosition) {
      continue;
    }

    nextLayout[entity.id] = {
      x: computedPosition.x,
      y: computedPosition.y,
      pinned: false,
    };
  }

  return nextLayout;
}

// ── Store ──
// This store is a LOCAL state container for the renderer.
// In browser mode, state arrives via analysis-client SSE (syncAnalysis / setPhaseStatusLocal).
// Local mutations (addEntities, updateEntity, etc.) still work for Electron mode
// and for offline/backward-compat scenarios.

export const useEntityGraphStore = create<EntityGraphStoreState>(
  (set, get) => ({
    analysis: createEmptyAnalysis(""),
    layout: {},
    isDirty: false,
    revision: 0,
    fileName: null,
    filePath: null,
    fileHandle: null,
    pendingEdits: [],

    newAnalysis: (topic) => {
      set((state) => ({
        analysis: createEmptyAnalysis(topic),
        layout: {},
        isDirty: false,
        revision: state.revision + 1,
        fileName: null,
        filePath: null,
        fileHandle: null,
        pendingEdits: [],
      }));
    },

    loadAnalysis: (analysis, layout, source) => {
      const normalizedAnalysis = normalizeAnalysis(analysis);
      set((state) => ({
        analysis: normalizedAnalysis,
        layout: reconcileLayoutState(layout ?? {}, normalizedAnalysis.entities),
        isDirty: false,
        revision: state.revision + 1,
        fileName: source?.fileName ?? null,
        filePath: source?.filePath ?? null,
        fileHandle: source?.fileHandle ?? null,
        pendingEdits: [],
      }));
    },

    setLayout: (layout) => {
      set((state) => ({
        layout: reconcileLayoutState(layout, state.analysis.entities),
        isDirty: true,
        revision: state.revision + 1,
      }));
    },

    updateLayout: (updates) => {
      set((state) => ({
        layout: reconcileLayoutState(
          {
            ...state.layout,
            ...updates,
          },
          state.analysis.entities,
        ),
        isDirty: true,
        revision: state.revision + 1,
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
          layout: reconcileLayoutState(state.layout, [
            ...state.analysis.entities,
            ...newEntities,
          ]),
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
        layout: reconcileLayoutState(
          Object.fromEntries(
            Object.entries(state.layout).filter(([entityId]) => entityId !== id),
          ),
          state.analysis.entities.filter((entity) => entity.id !== id),
        ),
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
          phases: upsertPhaseStatus(
            state.analysis.phases,
            state.analysis.entities,
            phase,
            status,
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

    upsertEntityFromServer: (entity) =>
      set((state) => {
        const exists = state.analysis.entities.some((existing) => existing.id === entity.id);
        const entities = exists
          ? state.analysis.entities.map((existing) =>
              existing.id === entity.id ? entity : existing,
            )
          : [...state.analysis.entities, entity];

        return {
          analysis: {
            ...state.analysis,
            entities,
          },
          layout: reconcileLayoutState(state.layout, entities),
          revision: state.revision + 1,
        };
      }),

    removeEntityFromServer: (id) =>
      set((state) => {
        const entities = state.analysis.entities.filter((entity) => entity.id !== id);
        const relationships = state.analysis.relationships.filter(
          (relationship) =>
            relationship.fromEntityId !== id && relationship.toEntityId !== id,
        );

        return {
          analysis: {
            ...state.analysis,
            entities,
            relationships,
          },
          layout: reconcileLayoutState(state.layout, entities),
          revision: state.revision + 1,
        };
      }),

    upsertRelationshipFromServer: (relationship) =>
      set((state) => {
        const exists = state.analysis.relationships.some(
          (existing) => existing.id === relationship.id,
        );
        const relationships = exists
          ? state.analysis.relationships.map((existing) =>
              existing.id === relationship.id ? relationship : existing,
            )
          : [...state.analysis.relationships, relationship];

        return {
          analysis: {
            ...state.analysis,
            relationships,
          },
          revision: state.revision + 1,
        };
      }),

    removeRelationshipFromServer: (id) =>
      set((state) => ({
        analysis: {
          ...state.analysis,
          relationships: state.analysis.relationships.filter(
            (relationship) => relationship.id !== id,
          ),
        },
        revision: state.revision + 1,
      })),

    markStaleFromServer: (entityIds) => {
      const idSet = new Set(entityIds);
      set((state) => ({
        analysis: {
          ...state.analysis,
          entities: state.analysis.entities.map((entity) =>
            idSet.has(entity.id) ? { ...entity, stale: true } : entity,
          ),
        },
        revision: state.revision + 1,
      }));
    },

    syncAnalysisFromServer: (analysis) =>
      set((state) => ({
        analysis: normalizeAnalysis(analysis),
        layout: reconcileLayoutState(state.layout, analysis.entities),
        revision: state.revision + 1,
      })),

    reconcileLayout: () =>
      set((state) => ({
        layout: reconcileLayoutState(state.layout, state.analysis.entities),
        revision: state.revision + 1,
      })),

    pinEntityPosition: (id, x, y) =>
      set((state) => {
        if (!state.analysis.entities.some((entity) => entity.id === id)) {
          return { revision: state.revision };
        }

        return {
          layout: {
            ...state.layout,
            [id]: { x, y, pinned: true },
          },
          isDirty: true,
          revision: state.revision + 1,
        };
      }),

    // syncAnalysis: like loadAnalysis but preserves isDirty and file refs (for SSE sync)
    syncAnalysis: (analysis) => {
      get().syncAnalysisFromServer(analysis);
    },

    // setPhaseStatusLocal: local phase status update from SSE progress events
    setPhaseStatusLocal: (phase, status) =>
      set((state) => ({
        analysis: {
          ...state.analysis,
          phases: upsertPhaseStatus(
            state.analysis.phases,
            state.analysis.entities,
            phase as MethodologyPhase,
            status,
          ),
        },
        revision: state.revision + 1,
      })),
  }),
);
