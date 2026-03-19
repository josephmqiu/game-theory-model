// Event types emitted during AI-driven analysis.
// Progress events come from the analysis orchestrator (lifecycle/status).
// Mutation events come from entity-graph-service (data changes).

import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "@/types/entity";

export interface PhaseSummary {
  entitiesCreated: number;
  relationshipsCreated: number;
  entitiesUpdated: number;
  durationMs: number;
}

// Progress/lifecycle events — emitted by analysis-orchestrator
export type AnalysisProgressEvent =
  | { type: "phase_started"; phase: string; runId: string }
  | {
      type: "phase_completed";
      phase: string;
      runId: string;
      summary: PhaseSummary;
    }
  | { type: "analysis_completed"; runId: string }
  | { type: "analysis_failed"; runId: string; error: string };

// Mutation events — emitted by entity-graph-service
export type AnalysisMutationEvent =
  | { type: "entity_created"; entity: AnalysisEntity }
  | { type: "relationship_created"; relationship: AnalysisRelationship }
  | {
      type: "entity_updated";
      entity: AnalysisEntity;
      previousProvenance: EntityProvenance;
    }
  | { type: "stale_marked"; entityIds: string[] };

export type AnalysisEvent = AnalysisProgressEvent | AnalysisMutationEvent;

// ── Type Guards ──

const PROGRESS_TYPES = new Set([
  "phase_started",
  "phase_completed",
  "analysis_completed",
  "analysis_failed",
]);

const MUTATION_TYPES = new Set([
  "entity_created",
  "relationship_created",
  "entity_updated",
  "stale_marked",
]);

export function isProgressEvent(
  event: AnalysisEvent,
): event is AnalysisProgressEvent {
  return PROGRESS_TYPES.has(event.type);
}

export function isMutationEvent(
  event: AnalysisEvent,
): event is AnalysisMutationEvent {
  return MUTATION_TYPES.has(event.type);
}
