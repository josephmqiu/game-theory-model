import type { AnalysisEntity, RelationshipType } from "../../shared/types/entity";
import type { MethodologyPhase } from "../../shared/types/methodology";
import { getAnalysis, getRelationships } from "./entity-graph-service";

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
] as const;

export type LoopbackTriggerType = (typeof LOOPBACK_TRIGGER_TYPES)[number];

export interface LoopbackTriggerRecord {
  trigger_type: LoopbackTriggerType;
  justification: string;
  timestamp: number;
}

const loopbackTriggersByRun = new Map<string, LoopbackTriggerRecord[]>();
const UNASSIGNED_RUN_KEY = "__unassigned__";

function resolveRunKey(explicitRunId?: string): string {
  if (explicitRunId && explicitRunId.trim().length > 0) {
    return explicitRunId;
  }

  const envRunId = process.env.ANALYSIS_RUN_ID;
  if (envRunId && envRunId.trim().length > 0) {
    return envRunId;
  }

  return UNASSIGNED_RUN_KEY;
}

function assertTriggerType(value: string): asserts value is LoopbackTriggerType {
  if ((LOOPBACK_TRIGGER_TYPES as readonly string[]).includes(value)) {
    return;
  }

  throw new Error(
    `Unsupported trigger_type: ${value}. Allowed: ${LOOPBACK_TRIGGER_TYPES.join(", ")}`,
  );
}

export function getEntity(id: string): AnalysisEntity | null {
  return getAnalysis().entities.find((entity) => entity.id === id) ?? null;
}

export function queryEntities(filters: {
  phase?: string;
  type?: string;
  stale?: boolean;
}): AnalysisEntity[] {
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

export function queryRelationships(filters: {
  entityId?: string;
  type?: string;
}) {
  return getRelationships({
    entityId: filters.entityId,
    type: filters.type as RelationshipType | undefined,
  });
}

export function requestLoopback(
  args: { trigger_type: string; justification: string },
  runId?: string,
) {
  assertTriggerType(args.trigger_type);

  const runKey = resolveRunKey(runId);
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
