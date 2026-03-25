/**
 * Analysis CQRS aggregate schemas.
 *
 * These are server-internal schemas for the game-theory analysis domain.
 * They extend the T3 orchestration engine with analysis-specific commands,
 * events, and read-model state. The analysis aggregate tracks the lifecycle
 * of a structured analytical run through methodology phases, managing
 * entities and relationships as a lightweight orchestration projection.
 *
 * The canonical entity/relationship data lives in EntityGraphService;
 * these schemas drive it via a reactor, not replace it.
 */
import { Schema } from "effect";
import {
  CommandId,
  IsoDateTime,
  TrimmedNonEmptyString,
} from "@t3tools/contracts";

// ── Branded IDs ──

const makeEntityId = <Brand extends string>(brand: Brand) =>
  TrimmedNonEmptyString.pipe(Schema.brand(brand));

export const AnalysisRunId = makeEntityId("AnalysisRunId");
export type AnalysisRunId = typeof AnalysisRunId.Type;

export const AnalysisEntityId = makeEntityId("AnalysisEntityId");
export type AnalysisEntityId = typeof AnalysisEntityId.Type;

export const AnalysisRelationshipId = makeEntityId("AnalysisRelationshipId");
export type AnalysisRelationshipId = typeof AnalysisRelationshipId.Type;

// ── Enums ──

export const AnalysisPhase = Schema.Literals([
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "formal-modeling",
  "assumptions",
  "elimination",
  "scenarios",
  "meta-check",
]);
export type AnalysisPhase = typeof AnalysisPhase.Type;

export const AnalysisStatus = Schema.Literals([
  "idle",
  "running",
  "aborting",
  "completed",
  "aborted",
]);
export type AnalysisStatus = typeof AnalysisStatus.Type;

export const AnalysisEntitySource = Schema.Literals([
  "ai",
  "human",
  "computed",
]);
export type AnalysisEntitySource = typeof AnalysisEntitySource.Type;

export const AnalysisEntityConfidence = Schema.Literals([
  "high",
  "medium",
  "low",
]);
export type AnalysisEntityConfidence = typeof AnalysisEntityConfidence.Type;

export const LoopbackTriggerType = Schema.Literals([
  "revalidation",
  "human-edit",
  "confidence-drop",
  "cross-game-conflict",
]);
export type LoopbackTriggerType = typeof LoopbackTriggerType.Type;

// ── Read Model: Analysis Slice ──

export const AnalysisEntitySummary = Schema.Struct({
  entityId: AnalysisEntityId,
  phase: AnalysisPhase,
  type: TrimmedNonEmptyString,
  source: AnalysisEntitySource,
});
export type AnalysisEntitySummary = typeof AnalysisEntitySummary.Type;

export const AnalysisRelationshipSummary = Schema.Struct({
  relationshipId: AnalysisRelationshipId,
  fromEntityId: AnalysisEntityId,
  toEntityId: AnalysisEntityId,
  type: TrimmedNonEmptyString,
});
export type AnalysisRelationshipSummary =
  typeof AnalysisRelationshipSummary.Type;

export const AnalysisLoopbackRecord = Schema.Struct({
  triggerType: LoopbackTriggerType,
  targetPhase: AnalysisPhase,
  recordedAt: IsoDateTime,
});
export type AnalysisLoopbackRecord = typeof AnalysisLoopbackRecord.Type;

export const AnalysisReadModelSlice = Schema.Struct({
  activeRunId: Schema.NullOr(AnalysisRunId),
  status: AnalysisStatus,
  topic: Schema.NullOr(TrimmedNonEmptyString),
  provider: Schema.NullOr(TrimmedNonEmptyString),
  model: Schema.NullOr(TrimmedNonEmptyString),
  currentPhase: Schema.NullOr(AnalysisPhase),
  phases: Schema.Array(AnalysisPhase),
  completedPhases: Schema.Array(AnalysisPhase),
  entities: Schema.Array(AnalysisEntitySummary),
  relationships: Schema.Array(AnalysisRelationshipSummary),
  loopbackTriggers: Schema.Array(AnalysisLoopbackRecord),
  startedAt: Schema.NullOr(IsoDateTime),
  completedAt: Schema.NullOr(IsoDateTime),
});
export type AnalysisReadModelSlice = typeof AnalysisReadModelSlice.Type;

export function createEmptyAnalysisSlice(): AnalysisReadModelSlice {
  return {
    activeRunId: null,
    status: "idle",
    topic: null,
    provider: null,
    model: null,
    currentPhase: null,
    phases: [],
    completedPhases: [],
    entities: [],
    relationships: [],
    loopbackTriggers: [],
    startedAt: null,
    completedAt: null,
  };
}

// ── Commands ──

export const AnalysisStartCommand = Schema.Struct({
  type: Schema.Literal("analysis.start"),
  commandId: CommandId,
  topic: TrimmedNonEmptyString,
  provider: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
});
export type AnalysisStartCommand = typeof AnalysisStartCommand.Type;

export const AnalysisPhaseBeginCommand = Schema.Struct({
  type: Schema.Literal("analysis.phase.begin"),
  commandId: CommandId,
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  createdAt: IsoDateTime,
});
export type AnalysisPhaseBeginCommand = typeof AnalysisPhaseBeginCommand.Type;

export const AnalysisEntityCreateCommand = Schema.Struct({
  type: Schema.Literal("analysis.entity.create"),
  commandId: CommandId,
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  entityId: AnalysisEntityId,
  entityType: TrimmedNonEmptyString,
  entityData: Schema.Unknown,
  confidence: AnalysisEntityConfidence,
  rationale: Schema.String,
  source: AnalysisEntitySource,
  createdAt: IsoDateTime,
});
export type AnalysisEntityCreateCommand =
  typeof AnalysisEntityCreateCommand.Type;

export const AnalysisEntityUpdateCommand = Schema.Struct({
  type: Schema.Literal("analysis.entity.update"),
  commandId: CommandId,
  runId: AnalysisRunId,
  entityId: AnalysisEntityId,
  updates: Schema.Unknown,
  source: Schema.optional(AnalysisEntitySource),
  createdAt: IsoDateTime,
});
export type AnalysisEntityUpdateCommand =
  typeof AnalysisEntityUpdateCommand.Type;

export const AnalysisEntityDeleteCommand = Schema.Struct({
  type: Schema.Literal("analysis.entity.delete"),
  commandId: CommandId,
  runId: AnalysisRunId,
  entityId: AnalysisEntityId,
  createdAt: IsoDateTime,
});
export type AnalysisEntityDeleteCommand =
  typeof AnalysisEntityDeleteCommand.Type;

export const AnalysisRelationshipCreateCommand = Schema.Struct({
  type: Schema.Literal("analysis.relationship.create"),
  commandId: CommandId,
  runId: AnalysisRunId,
  relationshipId: AnalysisRelationshipId,
  fromEntityId: AnalysisEntityId,
  toEntityId: AnalysisEntityId,
  relationshipType: TrimmedNonEmptyString,
  metadata: Schema.optional(Schema.Unknown),
  source: AnalysisEntitySource,
  createdAt: IsoDateTime,
});
export type AnalysisRelationshipCreateCommand =
  typeof AnalysisRelationshipCreateCommand.Type;

export const AnalysisPhaseCompleteCommand = Schema.Struct({
  type: Schema.Literal("analysis.phase.complete"),
  commandId: CommandId,
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  createdAt: IsoDateTime,
});
export type AnalysisPhaseCompleteCommand =
  typeof AnalysisPhaseCompleteCommand.Type;

export const AnalysisLoopbackCommand = Schema.Struct({
  type: Schema.Literal("analysis.loopback"),
  commandId: CommandId,
  runId: AnalysisRunId,
  triggerType: LoopbackTriggerType,
  justification: Schema.String,
  createdAt: IsoDateTime,
});
export type AnalysisLoopbackCommand = typeof AnalysisLoopbackCommand.Type;

export const AnalysisRollbackCommand = Schema.Struct({
  type: Schema.Literal("analysis.rollback"),
  commandId: CommandId,
  runId: AnalysisRunId,
  toPhase: AnalysisPhase,
  createdAt: IsoDateTime,
});
export type AnalysisRollbackCommand = typeof AnalysisRollbackCommand.Type;

export const AnalysisAbortCommand = Schema.Struct({
  type: Schema.Literal("analysis.abort"),
  commandId: CommandId,
  runId: AnalysisRunId,
  createdAt: IsoDateTime,
});
export type AnalysisAbortCommand = typeof AnalysisAbortCommand.Type;

export const AnalysisCompleteCommand = Schema.Struct({
  type: Schema.Literal("analysis.complete"),
  commandId: CommandId,
  runId: AnalysisRunId,
  createdAt: IsoDateTime,
});
export type AnalysisCompleteCommand = typeof AnalysisCompleteCommand.Type;

export const AnalysisCommand = Schema.Union([
  AnalysisStartCommand,
  AnalysisPhaseBeginCommand,
  AnalysisEntityCreateCommand,
  AnalysisEntityUpdateCommand,
  AnalysisEntityDeleteCommand,
  AnalysisRelationshipCreateCommand,
  AnalysisPhaseCompleteCommand,
  AnalysisLoopbackCommand,
  AnalysisRollbackCommand,
  AnalysisAbortCommand,
  AnalysisCompleteCommand,
]);
export type AnalysisCommand = typeof AnalysisCommand.Type;

// ── Event Payloads ──

export const AnalysisStartedPayload = Schema.Struct({
  runId: AnalysisRunId,
  topic: TrimmedNonEmptyString,
  provider: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
  phases: Schema.Array(AnalysisPhase),
  startedAt: IsoDateTime,
});
export type AnalysisStartedPayload = typeof AnalysisStartedPayload.Type;

export const AnalysisPhaseBeganPayload = Schema.Struct({
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  phaseIndex: Schema.Number,
  beganAt: IsoDateTime,
});
export type AnalysisPhaseBeganPayload = typeof AnalysisPhaseBeganPayload.Type;

export const AnalysisEntityCreatedPayload = Schema.Struct({
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  entityId: AnalysisEntityId,
  entityType: TrimmedNonEmptyString,
  entityData: Schema.Unknown,
  confidence: AnalysisEntityConfidence,
  rationale: Schema.String,
  source: AnalysisEntitySource,
  createdAt: IsoDateTime,
});
export type AnalysisEntityCreatedPayload =
  typeof AnalysisEntityCreatedPayload.Type;

export const AnalysisEntityUpdatedPayload = Schema.Struct({
  runId: AnalysisRunId,
  entityId: AnalysisEntityId,
  updates: Schema.Unknown,
  source: Schema.optional(AnalysisEntitySource),
  updatedAt: IsoDateTime,
});
export type AnalysisEntityUpdatedPayload =
  typeof AnalysisEntityUpdatedPayload.Type;

export const AnalysisEntityDeletedPayload = Schema.Struct({
  runId: AnalysisRunId,
  entityId: AnalysisEntityId,
  deletedAt: IsoDateTime,
});
export type AnalysisEntityDeletedPayload =
  typeof AnalysisEntityDeletedPayload.Type;

export const AnalysisRelationshipCreatedPayload = Schema.Struct({
  runId: AnalysisRunId,
  relationshipId: AnalysisRelationshipId,
  fromEntityId: AnalysisEntityId,
  toEntityId: AnalysisEntityId,
  relationshipType: TrimmedNonEmptyString,
  metadata: Schema.optional(Schema.Unknown),
  source: AnalysisEntitySource,
  createdAt: IsoDateTime,
});
export type AnalysisRelationshipCreatedPayload =
  typeof AnalysisRelationshipCreatedPayload.Type;

export const AnalysisPhaseCompletedPayload = Schema.Struct({
  runId: AnalysisRunId,
  phase: AnalysisPhase,
  completedAt: IsoDateTime,
});
export type AnalysisPhaseCompletedPayload =
  typeof AnalysisPhaseCompletedPayload.Type;

export const AnalysisLoopbackRecordedPayload = Schema.Struct({
  runId: AnalysisRunId,
  triggerType: LoopbackTriggerType,
  targetPhase: AnalysisPhase,
  justification: Schema.String,
  recordedAt: IsoDateTime,
});
export type AnalysisLoopbackRecordedPayload =
  typeof AnalysisLoopbackRecordedPayload.Type;

export const AnalysisRolledBackPayload = Schema.Struct({
  runId: AnalysisRunId,
  toPhase: AnalysisPhase,
  entitiesRemoved: Schema.Array(AnalysisEntityId),
  relationshipsRemoved: Schema.Array(AnalysisRelationshipId),
  rolledBackAt: IsoDateTime,
});
export type AnalysisRolledBackPayload = typeof AnalysisRolledBackPayload.Type;

export const AnalysisAbortedPayload = Schema.Struct({
  runId: AnalysisRunId,
  abortedAt: IsoDateTime,
});
export type AnalysisAbortedPayload = typeof AnalysisAbortedPayload.Type;

export const AnalysisCompletedPayload = Schema.Struct({
  runId: AnalysisRunId,
  summary: Schema.Struct({
    entityCount: Schema.Number,
    relationshipCount: Schema.Number,
    phasesCompleted: Schema.Number,
  }),
  completedAt: IsoDateTime,
});
export type AnalysisCompletedPayload = typeof AnalysisCompletedPayload.Type;

// ── Loopback trigger → target phase mapping ──

const TRIGGER_TARGET_PHASE: Record<LoopbackTriggerType, AnalysisPhase> = {
  revalidation: "situational-grounding",
  "human-edit": "situational-grounding",
  "confidence-drop": "baseline-model",
  "cross-game-conflict": "formal-modeling",
};

export function loopbackTargetPhase(
  trigger: LoopbackTriggerType,
): AnalysisPhase {
  return TRIGGER_TARGET_PHASE[trigger];
}

// ── Analysis event types ──

export const AnalysisEventType = Schema.Literals([
  "analysis.started",
  "analysis.phase.began",
  "analysis.entity.created",
  "analysis.entity.updated",
  "analysis.entity.deleted",
  "analysis.relationship.created",
  "analysis.phase.completed",
  "analysis.loopback.recorded",
  "analysis.rolled-back",
  "analysis.aborted",
  "analysis.completed",
]);
export type AnalysisEventType = typeof AnalysisEventType.Type;

// ── V3 analysis phases in order (no revalidation) ──

export const ANALYSIS_PHASES: ReadonlyArray<AnalysisPhase> = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "formal-modeling",
  "assumptions",
  "elimination",
  "scenarios",
  "meta-check",
];
