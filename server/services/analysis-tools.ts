import type {
  AnalysisEntity,
  EntityData,
  EntityType,
  RelationshipType,
} from "../../shared/types/entity";
import type { AnalysisProgressEvent } from "../../shared/types/events";
import type { MethodologyPhase } from "../../shared/types/methodology";
import * as entityGraphService from "./entity-graph-service";
import {
  PHASE_ENTITY_SCHEMAS,
  isSupportedPhase,
  validateEntity,
  validatePhaseInvariants,
} from "./analysis-entity-schemas";

const { getAnalysis, getRelationships } = entityGraphService;

export interface AnalysisToolContext {
  workspaceId?: string;
  threadId?: string;
  runId?: string;
  phaseTurnId?: string;
}

export const LOOPBACK_TRIGGER_TYPES = [
  "new_player",
  "objective_changed",
  "new_game",
  "game_reframed",
  "repeated_dominates",
  "new_cross_game_link",
  "escalation_revision",
  "institutional_change",
  "assumption_invalidated",
  "model_unexplained_fact",
  "behavioral_overlay_change",
  "meta_check_blind_spot",
] as const;

export type LoopbackTriggerType = (typeof LOOPBACK_TRIGGER_TYPES)[number];

export interface LoopbackTriggerRecord {
  trigger_type: LoopbackTriggerType;
  justification: string;
  timestamp: number;
}

const loopbackTriggersByRun = new Map<string, LoopbackTriggerRecord[]>();
const UNASSIGNED_RUN_KEY = "__unassigned__";

function resolveRunKey(context?: AnalysisToolContext | string): string {
  if (typeof context === "string" && context.trim().length > 0) {
    return context;
  }

  if (
    typeof context === "object" &&
    context !== null &&
    context.runId &&
    context.runId.trim().length > 0
  ) {
    return context.runId;
  }

  const envRunId = process.env.ANALYSIS_RUN_ID;
  if (envRunId && envRunId.trim().length > 0) {
    return envRunId;
  }

  return UNASSIGNED_RUN_KEY;
}

function assertTriggerType(
  value: string,
): asserts value is LoopbackTriggerType {
  if ((LOOPBACK_TRIGGER_TYPES as readonly string[]).includes(value)) {
    return;
  }

  throw new Error(
    `Unsupported trigger_type: ${value}. Allowed: ${LOOPBACK_TRIGGER_TYPES.join(", ")}`,
  );
}

export function getEntity(
  id: string,
  _context?: AnalysisToolContext,
): AnalysisEntity | null {
  return getAnalysis().entities.find((entity) => entity.id === id) ?? null;
}

export function queryEntities(
  filters: {
    phase?: string;
    type?: string;
    stale?: boolean;
  },
  _context?: AnalysisToolContext,
): AnalysisEntity[] {
  let entities = getAnalysis().entities;

  if (filters.phase) {
    entities = entities.filter(
      (entity) => entity.phase === (filters.phase as MethodologyPhase),
    );
  }

  if (filters.type) {
    entities = entities.filter((entity) => entity.type === filters.type);
  }

  if (typeof filters.stale === "boolean") {
    entities = entities.filter((entity) => entity.stale === filters.stale);
  }

  return entities;
}

export function queryRelationships(
  filters: {
    entityId?: string;
    type?: string;
  },
  _context?: AnalysisToolContext,
) {
  return getRelationships({
    entityId: filters.entityId,
    type: filters.type as RelationshipType | undefined,
  });
}

export function requestLoopback(
  args: { trigger_type: string; justification: string },
  context?: AnalysisToolContext,
) {
  assertTriggerType(args.trigger_type);

  const runKey = resolveRunKey(context);
  const existing = loopbackTriggersByRun.get(runKey) ?? [];
  existing.push({
    trigger_type: args.trigger_type,
    justification: args.justification,
    timestamp: Date.now(),
  });
  loopbackTriggersByRun.set(runKey, existing);

  return {
    accepted: true,
    queued: true,
  };
}

export function getRecordedLoopbackTriggers(
  runId?: string,
): LoopbackTriggerRecord[] {
  return [...(loopbackTriggersByRun.get(resolveRunKey(runId)) ?? [])];
}

export function clearRecordedLoopbackTriggers(runId?: string): void {
  loopbackTriggersByRun.delete(resolveRunKey(runId));
}

export function _resetLoopbackTriggersForTest(): void {
  loopbackTriggersByRun.clear();
}

// ── Analysis-write context and handlers (tool-based phases) ──

export interface AnalysisWriteCounters {
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  relationshipsCreated: number;
  phaseCompleted: boolean;
}

export interface AnalysisWriteContext extends AnalysisToolContext {
  phase: MethodologyPhase;
  allowedEntityTypes: string[];
  /** Mutable counters — reset by orchestrator before each phase. */
  counters?: AnalysisWriteCounters;
  /** Optional callback to emit real-time progress events during tool execution. */
  onProgress?: (event: AnalysisProgressEvent) => void;
}

export function analysisCreateEntity(
  args: {
    ref: string;
    type: string;
    phase: string;
    data: Record<string, unknown>;
    confidence?: string;
    rationale?: string;
  },
  ctx: AnalysisWriteContext,
): { id: string; ref: string; type: string } | { error: string } {
  if (!ctx.allowedEntityTypes.includes(args.type)) {
    return {
      error: `Entity type "${args.type}" is not allowed in phase "${ctx.phase}". Allowed: ${ctx.allowedEntityTypes.join(", ")}`,
    };
  }

  if (!isSupportedPhase(ctx.phase)) {
    return { error: `Unsupported phase "${ctx.phase}"` };
  }

  const schemas = PHASE_ENTITY_SCHEMAS[ctx.phase];
  const candidate = {
    id: null,
    ref: args.ref,
    type: args.type,
    phase: ctx.phase,
    data: args.data,
    confidence: args.confidence ?? "medium",
    rationale: args.rationale ?? "",
  };

  const validation = validateEntity(candidate, schemas);
  if (!validation.success) {
    const msg = validation.error.issues
      .map((issue: { message: string }) => issue.message)
      .join("; ");
    return { error: `Entity validation failed: ${msg}` };
  }

  // Safe casts: Zod validation above confirmed type and data match the phase schema
  const created = entityGraphService.createEntity(
    {
      type: args.type as EntityType,
      phase: ctx.phase,
      data: args.data as EntityData,
      confidence: (args.confidence as "high" | "medium" | "low") ?? "medium",
      rationale: args.rationale ?? "",
      revision: 1,
      stale: false,
    },
    { source: "phase-derived", runId: ctx.runId, phase: ctx.phase },
  );

  if (ctx.counters) ctx.counters.entitiesCreated++;
  ctx.onProgress?.({
    type: "entity_created_during_phase",
    phase: ctx.phase,
    runId: ctx.runId ?? "",
    entityId: created.id,
    entityType: args.type,
    entityRef: args.ref,
  });
  return { id: created.id, ref: args.ref, type: args.type };
}

export function analysisUpdateEntity(
  args: {
    id: string;
    updates: Record<string, unknown>;
  },
  ctx: AnalysisWriteContext,
): { id: string; type: string; updated: true } | { error: string } {
  const analysis = entityGraphService.getAnalysis();
  const entity = analysis.entities.find((e) => e.id === args.id);

  if (!entity) {
    return { error: `Entity "${args.id}" not found` };
  }
  if (entity.phase !== ctx.phase) {
    return {
      error: `Entity "${args.id}" belongs to phase "${entity.phase}", not "${ctx.phase}"`,
    };
  }
  if (entity.provenance?.source === "user-edited") {
    return {
      error: `Entity "${args.id}" is user-edited and cannot be modified by analysis`,
    };
  }

  const updated = entityGraphService.updateEntity(args.id, args.updates, {
    source: "phase-derived",
    runId: ctx.runId,
  });

  if (!updated) {
    return { error: `Failed to update entity "${args.id}"` };
  }

  if (ctx.counters) ctx.counters.entitiesUpdated++;
  ctx.onProgress?.({
    type: "entity_updated_during_phase",
    phase: ctx.phase,
    runId: ctx.runId ?? "",
    entityId: updated.id,
    entityType: updated.type,
  });
  return { id: updated.id, type: updated.type, updated: true };
}

export function analysisDeleteEntity(
  args: { id: string },
  ctx: AnalysisWriteContext,
): { id: string; deleted: true } | { error: string } {
  const analysis = entityGraphService.getAnalysis();
  const entity = analysis.entities.find((e) => e.id === args.id);

  if (!entity) {
    return { error: `Entity "${args.id}" not found` };
  }
  if (entity.phase !== ctx.phase) {
    return {
      error: `Entity "${args.id}" belongs to phase "${entity.phase}", not "${ctx.phase}"`,
    };
  }
  if (entity.provenance?.source === "user-edited") {
    return {
      error: `Entity "${args.id}" is user-edited and cannot be deleted by analysis`,
    };
  }

  entityGraphService.removeEntity(args.id);
  if (ctx.counters) ctx.counters.entitiesDeleted++;
  ctx.onProgress?.({
    type: "entity_deleted_during_phase",
    phase: ctx.phase,
    runId: ctx.runId ?? "",
    entityId: args.id,
  });
  return { id: args.id, deleted: true };
}

export function analysisCreateRelationship(
  args: {
    type: string;
    fromEntityId: string;
    toEntityId: string;
    metadata?: Record<string, unknown>;
  },
  ctx: AnalysisWriteContext,
):
  | { id: string; type: string; fromEntityId: string; toEntityId: string }
  | { error: string } {
  const analysis = entityGraphService.getAnalysis();
  const entityIds = new Set(analysis.entities.map((e) => e.id));

  if (!entityIds.has(args.fromEntityId)) {
    return { error: `Source entity "${args.fromEntityId}" not found` };
  }
  if (!entityIds.has(args.toEntityId)) {
    return { error: `Target entity "${args.toEntityId}" not found` };
  }

  const created = entityGraphService.createRelationship(
    {
      type: args.type as RelationshipType,
      fromEntityId: args.fromEntityId,
      toEntityId: args.toEntityId,
      metadata: args.metadata,
    },
    { source: "phase-derived", runId: ctx.runId, phase: ctx.phase },
  );

  if (ctx.counters) ctx.counters.relationshipsCreated++;
  return {
    id: created.id,
    type: created.type,
    fromEntityId: created.fromEntityId,
    toEntityId: created.toEntityId,
  };
}

export function analysisDeleteRelationship(
  args: { id: string },
  _ctx: AnalysisWriteContext,
): { id: string; deleted: true } | { error: string } {
  const analysis = entityGraphService.getAnalysis();
  const relationship = analysis.relationships.find((r) => r.id === args.id);

  if (!relationship) {
    return { error: `Relationship "${args.id}" not found` };
  }
  if (relationship.provenance?.source === "user-edited") {
    return {
      error: `Relationship "${args.id}" is user-edited and cannot be deleted by analysis`,
    };
  }

  entityGraphService.removeRelationship(args.id);
  return { id: args.id, deleted: true };
}

export function analysisCompletePhase(
  _args: { retained_entity_refs?: string[]; notes?: string },
  ctx: AnalysisWriteContext,
): { success: true; phase: string } | { success: false; error: string } {
  if (!isSupportedPhase(ctx.phase)) {
    return { success: false, error: `Unsupported phase "${ctx.phase}"` };
  }

  ctx.onProgress?.({
    type: "phase_completion_requested",
    phase: ctx.phase,
    runId: ctx.runId ?? "",
  });

  const phaseEntities = entityGraphService
    .getEntitiesByPhase(ctx.phase)
    .map((e) => ({
      type: e.type,
      data: e.data as Record<string, unknown>,
    }));

  const invariantResult = validatePhaseInvariants(ctx.phase, phaseEntities);
  if (!invariantResult.success) {
    return { success: false, error: invariantResult.error };
  }

  if (ctx.counters) ctx.counters.phaseCompleted = true;
  return { success: true, phase: ctx.phase };
}
