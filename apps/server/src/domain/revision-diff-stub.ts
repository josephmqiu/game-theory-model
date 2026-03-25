// Deprecated stub for batch phase commits.
//
// Batch phase commits are replaced by individual CQRS tool calls with rollback.
// The analysis agent now creates/updates/deletes entities via tool calls, not
// atomic structured-output batches. This stub exists only to surface errors
// if legacy code paths still reach it.

import type { MethodologyPhase } from "./types/methodology";
import type {
  PhaseOutputEntity,
  PhaseOutputRelationship,
} from "./analysis-service";

export interface CommitPhaseSnapshotInput {
  phase: MethodologyPhase;
  runId: string;
  entities: PhaseOutputEntity[];
  relationships: PhaseOutputRelationship[];
  allowLargeReductionCommit?: boolean;
}

export interface CommitPhaseSnapshotResult {
  status: "applied" | "retry_required" | "skipped";
  summary: {
    entitiesCreated: number;
    entitiesUpdated: number;
    relationshipsCreated: number;
    currentPhaseEntityIds: string[];
  };
  // Only present when status === "retry_required"
  originalAiEntityCount?: number;
  returnedAiEntityCount?: number;
  retryMessage?: string;
}

/**
 * @deprecated Batch phase commits are replaced by CQRS tool calls.
 * This stub throws at runtime to surface any remaining callers that need
 * migration. The return type is kept for backward compatibility so callers
 * compile, but the function never actually returns.
 */
export function commitPhaseSnapshot(
  _input: CommitPhaseSnapshotInput,
): CommitPhaseSnapshotResult {
  throw new Error(
    "commitPhaseSnapshot is deprecated — batch phase commits are replaced by " +
      "individual CQRS tool calls (create_entity, update_entity, delete_entity). " +
      "If this error fires, the calling code path needs migration to the " +
      "agent-driven model. See analysis-schemas.ts for the CQRS command types.",
  );
}
