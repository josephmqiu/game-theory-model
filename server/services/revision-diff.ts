import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../shared/types/entity";
import type { MethodologyPhase } from "../../shared/types/methodology";
import * as entityGraphService from "./entity-graph-service";

export interface AppliedCommitSummary {
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  relationshipsCreated: number;
  relationshipsDeleted: number;
  currentPhaseEntityIds: string[];
}

function isUserEditedEntity(entity: AnalysisEntity): boolean {
  return entity.provenance?.source === "user-edited";
}

function isAiOwnedEntity(entity: AnalysisEntity): boolean {
  return !isUserEditedEntity(entity);
}

function relationshipPhaseMatches(
  relationship: AnalysisRelationship,
  phase: MethodologyPhase,
  entityById: Map<string, AnalysisEntity>,
): boolean {
  if (relationship.provenance?.phase) {
    return relationship.provenance.phase === phase;
  }

  const from = entityById.get(relationship.fromEntityId);
  const to = entityById.get(relationship.toEntityId);
  return from?.phase === phase || to?.phase === phase;
}

function isUserOwnedRelationship(relationship: AnalysisRelationship): boolean {
  return relationship.provenance?.source === "user-edited";
}

function isAiOwnedRelationshipForPhase(
  relationship: AnalysisRelationship,
  phase: MethodologyPhase,
  entityById: Map<string, AnalysisEntity>,
): boolean {
  if (isUserOwnedRelationship(relationship)) return false;
  return relationshipPhaseMatches(relationship, phase, entityById);
}

function validateReferentialIntegrity(): void {
  const analysis = entityGraphService.getAnalysis();
  const entityIds = new Set(analysis.entities.map((entity) => entity.id));

  for (const relationship of analysis.relationships) {
    if (!entityIds.has(relationship.fromEntityId)) {
      throw new Error(
        `Referential integrity failure: missing fromEntityId "${relationship.fromEntityId}"`,
      );
    }
    if (!entityIds.has(relationship.toEntityId)) {
      throw new Error(
        `Referential integrity failure: missing toEntityId "${relationship.toEntityId}"`,
      );
    }
  }
}

// ── Phase transaction functions (tool-based phases) ──

interface PhaseTransactionState {
  phase: MethodologyPhase;
  runId: string;
  priorAiEntityIds: string[];
}

let activePhaseTransaction: PhaseTransactionState | null = null;

export function beginPhaseTransaction(
  phase: MethodologyPhase,
  runId: string,
): void {
  if (activePhaseTransaction !== null) {
    throw new Error(
      `Phase transaction already active for "${activePhaseTransaction.phase}"`,
    );
  }

  const phaseEntities = entityGraphService.getEntitiesByPhase(phase);
  const priorAiEntityIds = phaseEntities
    .filter(isAiOwnedEntity)
    .map((e) => e.id);

  entityGraphService.beginBatch();
  activePhaseTransaction = { phase, runId, priorAiEntityIds };
}

export function commitPhaseTransaction(
  retainedEntityIds?: string[],
  counters?: {
    entitiesCreated: number;
    entitiesUpdated: number;
    relationshipsCreated: number;
  },
): AppliedCommitSummary {
  if (activePhaseTransaction === null) {
    throw new Error("No active phase transaction to commit");
  }

  const { phase, priorAiEntityIds } = activePhaseTransaction;

  let entitiesDeleted = 0;
  if (retainedEntityIds) {
    const retainedSet = new Set(retainedEntityIds);
    for (const id of priorAiEntityIds) {
      if (!retainedSet.has(id)) {
        if (entityGraphService.removeEntity(id)) {
          entitiesDeleted += 1;
        }
      }
    }
  }

  validateReferentialIntegrity();
  entityGraphService.commitBatch();

  const currentPhaseEntityIds = entityGraphService
    .getEntitiesByPhase(phase)
    .map((e) => e.id);

  const summary: AppliedCommitSummary = {
    entitiesCreated: counters?.entitiesCreated ?? 0,
    entitiesUpdated: counters?.entitiesUpdated ?? 0,
    entitiesDeleted,
    relationshipsCreated: counters?.relationshipsCreated ?? 0,
    relationshipsDeleted: 0,
    currentPhaseEntityIds,
  };

  activePhaseTransaction = null;
  return summary;
}

export function rollbackPhaseTransaction(): void {
  if (activePhaseTransaction === null) return;

  entityGraphService.rollbackBatch();
  activePhaseTransaction = null;
}

export function getActivePhaseTransaction(): Readonly<PhaseTransactionState> | null {
  return activePhaseTransaction;
}

export const _private = {
  isAiOwnedEntity,
  isAiOwnedRelationshipForPhase,
};
