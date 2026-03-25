/**
 * Analysis decider — pure function: AnalysisCommand + AnalysisReadModelSlice → events.
 *
 * This is the analysis aggregate's decision logic, separated from the main
 * orchestration decider. The main decider delegates to this for analysis.*
 * commands. Events produced here use the "analysis" aggregate kind and are
 * folded by the analysis projector slice.
 */
import type { OrchestrationEvent } from "@t3tools/contracts";
import { Effect } from "effect";

import { OrchestrationCommandInvariantError } from "./Errors.ts";
import type {
  AnalysisCommand,
  AnalysisPhase,
  AnalysisReadModelSlice,
} from "./analysis-schemas.ts";
import { ANALYSIS_PHASES, loopbackTargetPhase } from "./analysis-schemas.ts";

type AnalysisEventBase = Omit<
  OrchestrationEvent,
  "sequence" | "type" | "payload"
>;

function withAnalysisEventBase(input: {
  readonly commandId: string;
  readonly runId: string;
  readonly occurredAt: string;
}): AnalysisEventBase {
  return {
    eventId: crypto.randomUUID() as OrchestrationEvent["eventId"],
    aggregateKind: "analysis" as OrchestrationEvent["aggregateKind"],
    aggregateId: input.runId as OrchestrationEvent["aggregateId"],
    occurredAt: input.occurredAt,
    commandId: input.commandId as OrchestrationEvent["commandId"],
    causationEventId: null,
    correlationId: input.commandId as OrchestrationEvent["correlationId"],
    metadata: {},
  };
}

function invariant(
  commandType: string,
  detail: string,
): Effect.Effect<never, OrchestrationCommandInvariantError> {
  return Effect.fail(
    new OrchestrationCommandInvariantError({ commandType, detail }),
  );
}

/**
 * Decide an analysis command against the analysis read-model slice.
 * Returns one or more events (without sequence numbers — those are assigned
 * by the event store on append).
 */
export const decideAnalysisCommand = Effect.fn("decideAnalysisCommand")(
  function* ({
    command,
    analysis,
  }: {
    readonly command: AnalysisCommand;
    readonly analysis: AnalysisReadModelSlice;
  }): Effect.fn.Return<
    | Omit<OrchestrationEvent, "sequence">
    | ReadonlyArray<Omit<OrchestrationEvent, "sequence">>,
    OrchestrationCommandInvariantError
  > {
    switch (command.type) {
      // ── analysis.start ──
      case "analysis.start": {
        if (analysis.status === "running") {
          return yield* invariant(
            command.type,
            "An analysis is already running. Abort or complete it before starting a new one.",
          );
        }

        const runId = crypto.randomUUID();
        const occurredAt = command.createdAt;

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId,
            occurredAt,
          }),
          type: "analysis.started" as OrchestrationEvent["type"],
          payload: {
            runId,
            topic: command.topic,
            provider: command.provider,
            model: command.model,
            phases: [...ANALYSIS_PHASES],
            startedAt: occurredAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.phase.begin ──
      case "analysis.phase.begin": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const phaseIndex = ANALYSIS_PHASES.indexOf(command.phase);
        if (phaseIndex === -1) {
          return yield* invariant(
            command.type,
            `Unknown phase '${command.phase}'.`,
          );
        }

        // Phase must be in sequence: either it's the first phase, or the previous phase is completed
        if (phaseIndex > 0) {
          const prevPhase = ANALYSIS_PHASES[phaseIndex - 1]!;
          if (!analysis.completedPhases.includes(prevPhase)) {
            return yield* invariant(
              command.type,
              `Phase '${command.phase}' cannot begin before '${prevPhase}' is completed.`,
            );
          }
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.phase.began" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            phase: command.phase,
            phaseIndex,
            beganAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.entity.create ──
      case "analysis.entity.create": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }
        if (analysis.currentPhase === null) {
          return yield* invariant(
            command.type,
            "No phase is currently active.",
          );
        }

        const existingEntity = analysis.entities.find(
          (e) => e.entityId === command.entityId,
        );
        if (existingEntity) {
          return yield* invariant(
            command.type,
            `Entity '${command.entityId}' already exists in the current run.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.entity.created" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            phase: command.phase,
            entityId: command.entityId,
            entityType: command.entityType,
            entityData: command.entityData,
            confidence: command.confidence,
            rationale: command.rationale,
            source: command.source,
            createdAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.entity.update ──
      case "analysis.entity.update": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const entityToUpdate = analysis.entities.find(
          (e) => e.entityId === command.entityId,
        );
        if (!entityToUpdate) {
          return yield* invariant(
            command.type,
            `Entity '${command.entityId}' does not exist in the current run.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.entity.updated" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            entityId: command.entityId,
            updates: command.updates,
            ...(command.source !== undefined ? { source: command.source } : {}),
            updatedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.entity.delete ──
      case "analysis.entity.delete": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const entityToDelete = analysis.entities.find(
          (e) => e.entityId === command.entityId,
        );
        if (!entityToDelete) {
          return yield* invariant(
            command.type,
            `Entity '${command.entityId}' does not exist in the current run.`,
          );
        }
        if (entityToDelete.source === "human") {
          return yield* invariant(
            command.type,
            `Entity '${command.entityId}' has source 'human' and cannot be deleted by the analysis pipeline.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.entity.deleted" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            entityId: command.entityId,
            deletedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.relationship.create ──
      case "analysis.relationship.create": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const fromEntity = analysis.entities.find(
          (e) => e.entityId === command.fromEntityId,
        );
        if (!fromEntity) {
          return yield* invariant(
            command.type,
            `From entity '${command.fromEntityId}' does not exist in the current run.`,
          );
        }
        const toEntity = analysis.entities.find(
          (e) => e.entityId === command.toEntityId,
        );
        if (!toEntity) {
          return yield* invariant(
            command.type,
            `To entity '${command.toEntityId}' does not exist in the current run.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.relationship.created" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            relationshipId: command.relationshipId,
            fromEntityId: command.fromEntityId,
            toEntityId: command.toEntityId,
            relationshipType: command.relationshipType,
            ...(command.metadata !== undefined
              ? { metadata: command.metadata }
              : {}),
            source: command.source,
            createdAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.phase.complete ──
      case "analysis.phase.complete": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }
        if (analysis.currentPhase !== command.phase) {
          return yield* invariant(
            command.type,
            `Phase '${command.phase}' is not the current active phase.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.phase.completed" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            phase: command.phase,
            completedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.loopback ──
      case "analysis.loopback": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const targetPhase = loopbackTargetPhase(command.triggerType);

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.loopback.recorded" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            triggerType: command.triggerType,
            targetPhase,
            justification: command.justification,
            recordedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.rollback ──
      case "analysis.rollback": {
        if (analysis.status !== "running" && analysis.status !== "aborting") {
          return yield* invariant(
            command.type,
            "Analysis must be running or aborting to perform a rollback.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        const toPhaseIndex = ANALYSIS_PHASES.indexOf(command.toPhase);
        if (toPhaseIndex === -1) {
          return yield* invariant(
            command.type,
            `Unknown phase '${command.toPhase}'.`,
          );
        }

        // Find entities and relationships created in phases after toPhase
        const phasesToRemove = ANALYSIS_PHASES.slice(toPhaseIndex + 1);
        const phasesToRemoveSet = new Set<AnalysisPhase>(phasesToRemove);

        // Preserve source="human" entities — they were user-contributed and
        // must survive rollback (same invariant as analysis.entity.delete).
        const entitiesToRemove = analysis.entities
          .filter((e) => phasesToRemoveSet.has(e.phase) && e.source !== "human")
          .map((e) => e.entityId);

        const entityIdsToRemoveSet = new Set(entitiesToRemove);
        const relationshipsToRemove = analysis.relationships
          .filter(
            (r) =>
              entityIdsToRemoveSet.has(r.fromEntityId) ||
              entityIdsToRemoveSet.has(r.toEntityId),
          )
          .map((r) => r.relationshipId);

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.rolled-back" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            toPhase: command.toPhase,
            entitiesRemoved: entitiesToRemove,
            relationshipsRemoved: relationshipsToRemove,
            rolledBackAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.abort ──
      case "analysis.abort": {
        if (analysis.status !== "running" && analysis.status !== "aborting") {
          return yield* invariant(
            command.type,
            "Analysis must be running or aborting to abort.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.aborted" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            abortedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      // ── analysis.complete ──
      case "analysis.complete": {
        if (analysis.status !== "running") {
          return yield* invariant(
            command.type,
            "No analysis is currently running.",
          );
        }
        if (analysis.activeRunId !== command.runId) {
          return yield* invariant(
            command.type,
            `Run '${command.runId}' is not the active run.`,
          );
        }

        return {
          ...withAnalysisEventBase({
            commandId: command.commandId,
            runId: command.runId,
            occurredAt: command.createdAt,
          }),
          type: "analysis.completed" as OrchestrationEvent["type"],
          payload: {
            runId: command.runId,
            summary: {
              entityCount: analysis.entities.length,
              relationshipCount: analysis.relationships.length,
              phasesCompleted: analysis.completedPhases.length,
            },
            completedAt: command.createdAt,
          },
        } as unknown as Omit<OrchestrationEvent, "sequence">;
      }

      default: {
        command satisfies never;
        const fallback = command as never as { type: string };
        return yield* invariant(
          fallback.type,
          `Unknown analysis command type: ${fallback.type}`,
        );
      }
    }
  },
);
