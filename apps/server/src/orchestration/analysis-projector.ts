/**
 * Analysis projector — folds analysis events into the AnalysisReadModelSlice.
 *
 * This is a pure function that takes the current analysis slice and an event,
 * and returns the updated slice. It mirrors the pattern in projector.ts but
 * operates on the analysis-specific read model state.
 */
import type { OrchestrationEvent } from "@t3tools/contracts";

import type {
  AnalysisReadModelSlice,
  AnalysisEntityId,
  AnalysisRelationshipId,
  AnalysisPhase,
} from "./analysis-schemas.ts";
import {
  createEmptyAnalysisSlice,
  ANALYSIS_PHASES,
} from "./analysis-schemas.ts";

/**
 * Project a single event onto the analysis read model slice.
 * Returns the updated slice, or the original slice if the event is not
 * analysis-related.
 */
export function projectAnalysisEvent(
  slice: AnalysisReadModelSlice,
  event: OrchestrationEvent,
): AnalysisReadModelSlice {
  // Only handle analysis.* events
  const eventType = event.type as string;
  if (!eventType.startsWith("analysis.")) {
    return slice;
  }

  const payload = event.payload as Record<string, unknown>;

  switch (eventType) {
    case "analysis.started": {
      return {
        ...createEmptyAnalysisSlice(),
        activeRunId: payload.runId as AnalysisReadModelSlice["activeRunId"],
        status: "running",
        topic: payload.topic as string as AnalysisReadModelSlice["topic"],
        provider:
          payload.provider as string as AnalysisReadModelSlice["provider"],
        model: payload.model as string as AnalysisReadModelSlice["model"],
        phases: (payload.phases as AnalysisPhase[]) ?? [...ANALYSIS_PHASES],
        startedAt: payload.startedAt as string,
      };
    }

    case "analysis.phase.began": {
      return {
        ...slice,
        currentPhase: payload.phase as AnalysisPhase,
      };
    }

    case "analysis.entity.created": {
      return {
        ...slice,
        entities: [
          ...slice.entities,
          {
            entityId: payload.entityId as AnalysisEntityId,
            phase: payload.phase as AnalysisPhase,
            type: payload.entityType as string,
            source: payload.source as "ai" | "human" | "computed",
          },
        ],
      };
    }

    case "analysis.entity.updated": {
      // The read model slice tracks entity summaries only, not full data.
      // Updates don't change the summary fields, so this is a no-op for the slice.
      return slice;
    }

    case "analysis.entity.deleted": {
      const deletedEntityId = payload.entityId as AnalysisEntityId;
      return {
        ...slice,
        entities: slice.entities.filter((e) => e.entityId !== deletedEntityId),
        // Also remove relationships referencing this entity
        relationships: slice.relationships.filter(
          (r) =>
            r.fromEntityId !== deletedEntityId &&
            r.toEntityId !== deletedEntityId,
        ),
      };
    }

    case "analysis.relationship.created": {
      return {
        ...slice,
        relationships: [
          ...slice.relationships,
          {
            relationshipId: payload.relationshipId as AnalysisRelationshipId,
            fromEntityId: payload.fromEntityId as AnalysisEntityId,
            toEntityId: payload.toEntityId as AnalysisEntityId,
            type: payload.relationshipType as string,
          },
        ],
      };
    }

    case "analysis.phase.completed": {
      const completedPhase = payload.phase as AnalysisPhase;
      return {
        ...slice,
        currentPhase: null,
        completedPhases: slice.completedPhases.includes(completedPhase)
          ? slice.completedPhases
          : [...slice.completedPhases, completedPhase],
      };
    }

    case "analysis.loopback.recorded": {
      return {
        ...slice,
        loopbackTriggers: [
          ...slice.loopbackTriggers,
          {
            triggerType:
              payload.triggerType as AnalysisReadModelSlice["loopbackTriggers"][number]["triggerType"],
            targetPhase: payload.targetPhase as AnalysisPhase,
            recordedAt: payload.recordedAt as string,
          },
        ],
      };
    }

    case "analysis.rolled-back": {
      const toPhase = payload.toPhase as AnalysisPhase;
      const entitiesRemoved = new Set(
        payload.entitiesRemoved as AnalysisEntityId[],
      );
      const relationshipsRemoved = new Set(
        payload.relationshipsRemoved as AnalysisRelationshipId[],
      );

      // Remove entities and relationships that were rolled back
      const remainingEntities = slice.entities.filter(
        (e) => !entitiesRemoved.has(e.entityId),
      );
      const remainingRelationships = slice.relationships.filter(
        (r) => !relationshipsRemoved.has(r.relationshipId),
      );

      // Trim completed phases: keep only phases up to and including toPhase
      const toPhaseIndex = ANALYSIS_PHASES.indexOf(toPhase);
      const retainedPhases = new Set(
        ANALYSIS_PHASES.slice(0, toPhaseIndex + 1),
      );
      const completedPhases = slice.completedPhases.filter((p) =>
        retainedPhases.has(p),
      );

      return {
        ...slice,
        currentPhase: toPhase,
        completedPhases,
        entities: remainingEntities,
        relationships: remainingRelationships,
      };
    }

    case "analysis.aborted": {
      return {
        ...slice,
        status: "aborted",
        currentPhase: null,
        completedAt: payload.abortedAt as string,
      };
    }

    case "analysis.completed": {
      return {
        ...slice,
        status: "completed",
        currentPhase: null,
        completedAt: payload.completedAt as string,
      };
    }

    default:
      return slice;
  }
}
