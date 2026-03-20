import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "./entity";

export interface PhaseSummary {
  entitiesCreated: number;
  relationshipsCreated: number;
  entitiesUpdated: number;
  durationMs: number;
}

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

export type AnalysisMutationEvent =
  | { type: "entity_created"; entity: AnalysisEntity }
  | { type: "relationship_created"; relationship: AnalysisRelationship }
  | {
      type: "entity_updated";
      entity: AnalysisEntity;
      previousProvenance: EntityProvenance;
    }
  | { type: "relationship_updated"; relationship: AnalysisRelationship }
  | { type: "stale_marked"; entityIds: string[] }
  | { type: "state_changed" };

export type AnalysisEvent = AnalysisProgressEvent | AnalysisMutationEvent;

export type ChatEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolName: string; input: unknown }
  | { type: "tool_call_result"; toolName: string; output: unknown }
  | { type: "tool_call_error"; toolName: string; error: string }
  | { type: "turn_complete" }
  | { type: "error"; message: string; recoverable: boolean };
