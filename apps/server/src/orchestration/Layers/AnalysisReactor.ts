/**
 * AnalysisReactor — reacts to analysis CQRS events by calling domain services.
 *
 * This is the glue between the CQRS event stream and the EntityGraphService.
 * When analysis events fire (entity created, updated, deleted, etc.), this
 * reactor applies them to the canonical entity store and pushes WS events
 * to the frontend.
 *
 * Follows the same pattern as ProviderCommandReactor: listens to the
 * orchestration engine's domain event stream, filters for analysis events,
 * and processes them via a drainable worker queue.
 *
 * @module AnalysisReactor
 */
import type { OrchestrationEvent } from "@t3tools/contracts";
import { Effect, Layer, Stream } from "effect";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";

import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import {
  AnalysisReactor,
  type AnalysisReactorShape,
} from "../Services/AnalysisReactor.ts";
import * as EntityGraphService from "../../domain/entity-graph-service.ts";
import type { MethodologyPhase } from "../../domain/types/methodology.ts";
import type { RelationshipType } from "../../domain/types/entity.ts";
import type { AnalysisEntityId } from "../analysis-schemas.ts";

// ── Event type guard ──

type AnalysisEventType =
  | "analysis.started"
  | "analysis.phase.began"
  | "analysis.entity.created"
  | "analysis.entity.updated"
  | "analysis.entity.deleted"
  | "analysis.relationship.created"
  | "analysis.loopback.recorded"
  | "analysis.rolled-back"
  | "analysis.phase.completed"
  | "analysis.completed"
  | "analysis.aborted";

const HANDLED_EVENT_TYPES = new Set<string>([
  "analysis.started",
  "analysis.phase.began",
  "analysis.entity.created",
  "analysis.entity.updated",
  "analysis.entity.deleted",
  "analysis.relationship.created",
  "analysis.loopback.recorded",
  "analysis.rolled-back",
  "analysis.phase.completed",
  "analysis.completed",
  "analysis.aborted",
]);

function isAnalysisEvent(event: OrchestrationEvent): boolean {
  return HANDLED_EVENT_TYPES.has(event.type as string);
}

// ── Reactor Implementation ──

const make = Effect.gen(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;

  const processAnalysisEvent = (event: OrchestrationEvent) =>
    Effect.gen(function* () {
      const eventType = event.type as string as AnalysisEventType;
      const payload = event.payload as Record<string, unknown>;

      switch (eventType) {
        // ── analysis.started ──
        // Initialize a fresh analysis in the entity graph service
        case "analysis.started": {
          const topic = payload.topic as string;
          EntityGraphService.newAnalysis(topic);
          yield* Effect.logInfo("analysis reactor: new analysis started", {
            runId: payload.runId,
            topic,
          });
          break;
        }

        // ── analysis.phase.began ──
        // Set the phase status to "running" in the entity graph
        case "analysis.phase.began": {
          const phase = payload.phase as string as MethodologyPhase;
          EntityGraphService.setPhaseStatus(phase, "running");

          yield* Effect.logDebug("analysis reactor: phase began", {
            runId: payload.runId,
            phase,
            phaseIndex: payload.phaseIndex,
          });
          break;
        }

        // ── analysis.entity.created ──
        // Create the entity in the canonical store
        case "analysis.entity.created": {
          const runId = payload.runId as string;
          const phase = payload.phase as string as MethodologyPhase;
          const entityData = payload.entityData as Record<string, unknown>;
          const confidence =
            (payload.confidence as "high" | "medium" | "low") ?? "medium";
          const rationale = (payload.rationale as string) ?? "";
          const source = payload.source as string;

          EntityGraphService.createEntity(
            {
              type: payload.entityType as string as never,
              phase,
              data: entityData as never,
              confidence,
              rationale,
              revision: 1,
              stale: false,
            },
            {
              source: source === "human" ? "user-edited" : "ai-edited",
              runId,
              phase,
            },
          );

          yield* Effect.logDebug("analysis reactor: entity created", {
            runId,
            entityId: payload.entityId,
            entityType: payload.entityType,
            phase,
          });
          break;
        }

        // ── analysis.entity.updated ──
        // Apply updates to an existing entity
        case "analysis.entity.updated": {
          const runId = payload.runId as string;
          const entityId = payload.entityId as string;
          const updates = payload.updates as Record<string, unknown>;
          const source = payload.source as string | undefined;

          EntityGraphService.updateEntity(entityId, updates as never, {
            source:
              source === "human"
                ? "user-edited"
                : source === "computed"
                  ? "phase-derived"
                  : "ai-edited",
            runId,
          });

          yield* Effect.logDebug("analysis reactor: entity updated", {
            runId,
            entityId,
          });
          break;
        }

        // ── analysis.entity.deleted ──
        // Remove entity and cascade relationships
        case "analysis.entity.deleted": {
          const entityId = payload.entityId as string;
          EntityGraphService.removeEntity(entityId);

          yield* Effect.logDebug("analysis reactor: entity deleted", {
            runId: payload.runId,
            entityId,
          });
          break;
        }

        // ── analysis.relationship.created ──
        // Create relationship in the canonical store
        case "analysis.relationship.created": {
          const runId = payload.runId as string;
          const fromEntityId = payload.fromEntityId as string;
          const toEntityId = payload.toEntityId as string;
          const relationshipType =
            payload.relationshipType as string as RelationshipType;
          const source = payload.source as string;
          const metadata = payload.metadata as
            | Record<string, unknown>
            | undefined;

          try {
            EntityGraphService.createRelationship(
              {
                type: relationshipType,
                fromEntityId,
                toEntityId,
                metadata,
              },
              {
                source: source === "human" ? "user-edited" : "ai-edited",
                runId,
              },
            );
          } catch (error) {
            // Non-fatal: entity may have been deleted between event creation
            // and processing. Log and continue.
            yield* Effect.logWarning(
              "analysis reactor: relationship creation failed",
              {
                runId,
                fromEntityId,
                toEntityId,
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }

          yield* Effect.logDebug("analysis reactor: relationship created", {
            runId,
            relationshipId: payload.relationshipId,
          });
          break;
        }

        // ── analysis.loopback.recorded ──
        // Loopback triggers are tracked in the CQRS read model (projector);
        // the entity graph service has no corresponding state to update.
        // We log the event for observability.
        case "analysis.loopback.recorded": {
          yield* Effect.logInfo("analysis reactor: loopback recorded", {
            runId: payload.runId,
            triggerType: payload.triggerType,
            targetPhase: payload.targetPhase,
            justification: payload.justification,
          });
          break;
        }

        // ── analysis.rolled-back ──
        // Remove all entities that were rolled back
        case "analysis.rolled-back": {
          const entitiesRemoved =
            (payload.entitiesRemoved as AnalysisEntityId[]) ?? [];
          for (const entityId of entitiesRemoved) {
            EntityGraphService.removeEntity(entityId);
          }

          yield* Effect.logInfo("analysis reactor: rolled back", {
            runId: payload.runId,
            toPhase: payload.toPhase,
            entitiesRemoved: entitiesRemoved.length,
          });
          break;
        }

        // ── analysis.phase.completed ──
        // Update phase status in the entity graph
        case "analysis.phase.completed": {
          const phase = payload.phase as string as MethodologyPhase;
          EntityGraphService.setPhaseStatus(phase, "complete");

          yield* Effect.logInfo("analysis reactor: phase completed", {
            runId: payload.runId,
            phase,
          });
          break;
        }

        // ── analysis.completed ──
        // Mark the analysis run as done
        case "analysis.completed": {
          yield* Effect.logInfo("analysis reactor: analysis completed", {
            runId: payload.runId,
          });
          break;
        }

        // ── analysis.aborted ──
        case "analysis.aborted": {
          yield* Effect.logInfo("analysis reactor: analysis aborted", {
            runId: payload.runId,
          });
          break;
        }
      }
    });

  const processAnalysisEventSafely = (event: OrchestrationEvent) =>
    processAnalysisEvent(event).pipe(
      Effect.catch((error: unknown) =>
        Effect.logWarning("analysis reactor: failed to process event", {
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    );

  const worker = yield* makeDrainableWorker(processAnalysisEventSafely);

  const start: AnalysisReactorShape["start"] = Effect.forkScoped(
    Stream.runForEach(
      orchestrationEngine.streamDomainEvents,
      (event: OrchestrationEvent) => {
        if (!isAnalysisEvent(event)) {
          return Effect.void;
        }
        return worker.enqueue(event);
      },
    ),
  ).pipe(Effect.asVoid);

  return {
    start,
    drain: worker.drain,
  } satisfies AnalysisReactorShape;
});

export const AnalysisReactorLive = Layer.effect(AnalysisReactor, make);
