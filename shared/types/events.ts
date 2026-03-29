import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "./entity";
import type { RuntimeError } from "./runtime-error";

export interface PhaseSummary {
  entitiesCreated: number;
  relationshipsCreated: number;
  entitiesUpdated: number;
  durationMs: number;
}

export type AnalysisPhaseActivityKind = "note" | "tool" | "web-search";

export interface PhaseStartedEvent {
  type: "phase_started";
  phase: string;
  runId: string;
}

export interface PhaseActivityEvent {
  type: "phase_activity";
  phase: string;
  runId: string;
  kind: AnalysisPhaseActivityKind;
  message: string;
  toolName?: string;
  query?: string;
}

export interface PhaseCompletedEvent {
  type: "phase_completed";
  phase: string;
  runId: string;
  summary: PhaseSummary;
}

export interface AnalysisCompletedEvent {
  type: "analysis_completed";
  runId: string;
}

export interface AnalysisFailedEvent {
  type: "analysis_failed";
  runId: string;
  error: RuntimeError;
}

export interface SynthesisStartedEvent {
  type: "synthesis_started";
  runId: string;
}

export interface SynthesisCompletedEvent {
  type: "synthesis_completed";
  runId: string;
}

export interface EntityCreatedDuringPhaseEvent {
  type: "entity_created_during_phase";
  phase: string;
  runId: string;
  entityId: string;
  entityType: string;
  entityRef?: string;
}

export interface EntityUpdatedDuringPhaseEvent {
  type: "entity_updated_during_phase";
  phase: string;
  runId: string;
  entityId: string;
  entityType: string;
}

export interface EntityDeletedDuringPhaseEvent {
  type: "entity_deleted_during_phase";
  phase: string;
  runId: string;
  entityId: string;
}

export interface PhaseCompletionRequestedEvent {
  type: "phase_completion_requested";
  phase: string;
  runId: string;
}

export type AnalysisProgressEvent =
  | PhaseStartedEvent
  | PhaseActivityEvent
  | PhaseCompletedEvent
  | AnalysisCompletedEvent
  | AnalysisFailedEvent
  | SynthesisStartedEvent
  | SynthesisCompletedEvent
  | EntityCreatedDuringPhaseEvent
  | EntityUpdatedDuringPhaseEvent
  | EntityDeletedDuringPhaseEvent
  | PhaseCompletionRequestedEvent;

export type AnalysisMutationEvent =
  | { type: "entity_created"; entity: AnalysisEntity }
  | { type: "entity_deleted"; entityId: string }
  | { type: "relationship_created"; relationship: AnalysisRelationship }
  | { type: "relationship_deleted"; relationshipId: string }
  | {
      type: "entity_updated";
      entity: AnalysisEntity;
      previousProvenance: EntityProvenance;
    }
  | { type: "relationship_updated"; relationship: AnalysisRelationship }
  | { type: "stale_marked"; entityIds: string[] }
  | { type: "state_changed" };

export type AnalysisEvent = AnalysisProgressEvent | AnalysisMutationEvent;
