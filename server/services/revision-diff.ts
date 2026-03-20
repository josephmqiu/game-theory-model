import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../shared/types/entity";
import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  PhaseOutputEntity,
  PhaseOutputRelationship,
} from "./analysis-service";
import * as entityGraphService from "./entity-graph-service";

interface CommitPhaseSnapshotInput {
  phase: MethodologyPhase;
  runId: string;
  entities: PhaseOutputEntity[];
  relationships: PhaseOutputRelationship[];
  allowLargeReductionCommit?: boolean;
}

interface AppliedCommitSummary {
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  relationshipsCreated: number;
  relationshipsDeleted: number;
  currentPhaseEntityIds: string[];
}

interface AppliedCommitResult {
  status: "applied";
  summary: AppliedCommitSummary;
}

interface RetryRequiredResult {
  status: "retry_required";
  originalAiEntityCount: number;
  returnedAiEntityCount: number;
  retryMessage: string;
}

export type CommitPhaseSnapshotResult =
  | AppliedCommitResult
  | RetryRequiredResult;

interface ExistingEntityBinding {
  kind: "existing";
  entity: AnalysisEntity;
}

interface NewEntityBinding {
  kind: "new";
  entity: PhaseOutputEntity;
}

type RefBinding = ExistingEntityBinding | NewEntityBinding;

interface ResolvedRelationship {
  type: PhaseOutputRelationship["type"];
  fromEntityId: string;
  toEntityId: string;
  metadata?: Record<string, unknown>;
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

function assertUniqueBatchEntities(entities: PhaseOutputEntity[]): void {
  const seenRefs = new Set<string>();
  const seenIds = new Set<string>();

  for (const entity of entities) {
    if (seenRefs.has(entity.ref)) {
      throw new Error(`Duplicate entity ref "${entity.ref}" in phase snapshot`);
    }
    seenRefs.add(entity.ref);

    if (entity.id !== null) {
      if (seenIds.has(entity.id)) {
        throw new Error(`Duplicate entity id "${entity.id}" in phase snapshot`);
      }
      seenIds.add(entity.id);
    }
  }
}

function buildRefBindings(
  phase: MethodologyPhase,
  entities: PhaseOutputEntity[],
  entityById: Map<string, AnalysisEntity>,
): Map<string, RefBinding> {
  const bindings = new Map<string, RefBinding>();

  for (const entity of entities) {
    if (entity.phase !== phase) {
      throw new Error(
        `Entity "${entity.ref}" has phase "${entity.phase}" but expected "${phase}"`,
      );
    }

    if (entity.id === null) {
      bindings.set(entity.ref, { kind: "new", entity });
      continue;
    }

    const existing = entityById.get(entity.id);
    if (!existing) {
      throw new Error(`Unknown entity id "${entity.id}" in phase snapshot`);
    }
    if (existing.phase !== phase) {
      throw new Error(
        `Entity id "${entity.id}" belongs to phase "${existing.phase}", not "${phase}"`,
      );
    }

    bindings.set(entity.ref, { kind: "existing", entity: existing });
  }

  return bindings;
}

function resolveRelationshipEndpoint(
  rawId: string,
  phase: MethodologyPhase,
  refBindings: Map<string, RefBinding>,
  currentPhaseIds: Set<string>,
  entityById: Map<string, AnalysisEntity>,
): string {
  const binding = refBindings.get(rawId);
  if (binding) {
    if (binding.kind === "existing") {
      return binding.entity.id;
    }
    return rawId;
  }

  if (currentPhaseIds.has(rawId)) {
    throw new Error(
      `Relationship endpoint "${rawId}" must use a batch ref, not a current-phase server id`,
    );
  }

  const crossPhaseTarget = entityById.get(rawId);
  if (!crossPhaseTarget) {
    throw new Error(`Relationship endpoint "${rawId}" does not exist`);
  }

  if (crossPhaseTarget.phase === phase) {
    throw new Error(
      `Relationship endpoint "${rawId}" must use a batch ref for phase "${phase}"`,
    );
  }

  return rawId;
}

function preflightRelationships(
  phase: MethodologyPhase,
  relationships: PhaseOutputRelationship[],
  refBindings: Map<string, RefBinding>,
  currentPhaseIds: Set<string>,
  entityById: Map<string, AnalysisEntity>,
): ResolvedRelationship[] {
  return relationships.map((relationship) => ({
    type: relationship.type,
    fromEntityId: resolveRelationshipEndpoint(
      relationship.fromEntityId,
      phase,
      refBindings,
      currentPhaseIds,
      entityById,
    ),
    toEntityId: resolveRelationshipEndpoint(
      relationship.toEntityId,
      phase,
      refBindings,
      currentPhaseIds,
      entityById,
    ),
    metadata: relationship.metadata,
  }));
}

function buildRetryMessage(
  returnedAiEntityCount: number,
  originalAiEntityCount: number,
): string {
  return (
    "Your previous response appeared truncated. " +
    `You returned ${returnedAiEntityCount} entities but ${originalAiEntityCount} existed. ` +
    "Please return the complete revised set."
  );
}

function maybeRequireTruncationRetry(
  originalAiEntityCount: number,
  returnedAiEntityCount: number,
  allowLargeReductionCommit: boolean,
): RetryRequiredResult | null {
  const looksTruncated =
    originalAiEntityCount > 4 && returnedAiEntityCount * 2 < originalAiEntityCount;

  if (!looksTruncated || allowLargeReductionCommit) {
    return null;
  }

  return {
    status: "retry_required",
    originalAiEntityCount,
    returnedAiEntityCount,
    retryMessage: buildRetryMessage(
      returnedAiEntityCount,
      originalAiEntityCount,
    ),
  };
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

export function commitPhaseSnapshot({
  phase,
  runId,
  entities,
  relationships,
  allowLargeReductionCommit = false,
}: CommitPhaseSnapshotInput): CommitPhaseSnapshotResult {
  const analysis = entityGraphService.getAnalysis();
  const entityById = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const currentPhaseEntities = analysis.entities.filter(
    (entity) => entity.phase === phase,
  );
  const currentPhaseIds = new Set(currentPhaseEntities.map((entity) => entity.id));
  const aiOwnedCurrentPhaseEntities = currentPhaseEntities.filter(isAiOwnedEntity);

  assertUniqueBatchEntities(entities);

  const refBindings = buildRefBindings(phase, entities, entityById);
  const preflightedRelationships = preflightRelationships(
    phase,
    relationships,
    refBindings,
    currentPhaseIds,
    entityById,
  );

  const returnedAiEntityCount = entities.filter((entity) => {
    if (entity.id === null) return true;
    const existing = entityById.get(entity.id);
    return existing !== undefined && isAiOwnedEntity(existing);
  }).length;

  const retryRequired = maybeRequireTruncationRetry(
    aiOwnedCurrentPhaseEntities.length,
    returnedAiEntityCount,
    allowLargeReductionCommit,
  );
  if (retryRequired) {
    return retryRequired;
  }

  const refToServerId = new Map<string, string>();
  const retainedAiEntityIds = new Set<string>();
  let entitiesCreated = 0;
  let entitiesUpdated = 0;
  let entitiesDeleted = 0;

  for (const entity of entities) {
    if (entity.id === null) {
      const created = entityGraphService.createEntity(
        {
          type: entity.type,
          phase: entity.phase,
          data: entity.data,
          confidence: entity.confidence,
          rationale: entity.rationale,
          revision: 1,
          stale: false,
        },
        { source: "phase-derived", runId, phase },
      );
      refToServerId.set(entity.ref, created.id);
      entitiesCreated += 1;
      continue;
    }

    const existing = entityById.get(entity.id);
    if (!existing) {
      throw new Error(`Unknown entity id "${entity.id}" in phase snapshot`);
    }

    refToServerId.set(entity.ref, existing.id);

    if (isUserEditedEntity(existing)) {
      continue;
    }

    const updated = entityGraphService.updateEntity(
      existing.id,
      {
        type: entity.type,
        phase: entity.phase,
        data: entity.data,
        confidence: entity.confidence,
        rationale: entity.rationale,
        revision: existing.revision + 1,
        stale: false,
      },
      { source: "phase-derived", runId },
    );

    if (updated === null) {
      throw new Error(`Failed to update entity "${existing.id}"`);
    }

    retainedAiEntityIds.add(existing.id);
    entitiesUpdated += 1;
  }

  for (const existing of aiOwnedCurrentPhaseEntities) {
    if (retainedAiEntityIds.has(existing.id)) continue;
    const removed = entityGraphService.removeEntity(existing.id);
    if (removed) {
      entitiesDeleted += 1;
    }
  }

  const analysisAfterEntityDiff = entityGraphService.getAnalysis();
  const entityByIdAfterDiff = new Map(
    analysisAfterEntityDiff.entities.map((entity) => [entity.id, entity]),
  );
  const relationshipsToReplace = analysisAfterEntityDiff.relationships.filter(
    (relationship) =>
      isAiOwnedRelationshipForPhase(relationship, phase, entityByIdAfterDiff),
  );

  let relationshipsDeleted = 0;
  for (const relationship of relationshipsToReplace) {
    if (entityGraphService.removeRelationship(relationship.id)) {
      relationshipsDeleted += 1;
    }
  }

  let relationshipsCreated = 0;
  for (const relationship of preflightedRelationships) {
    const fromEntityId =
      refToServerId.get(relationship.fromEntityId) ?? relationship.fromEntityId;
    const toEntityId =
      refToServerId.get(relationship.toEntityId) ?? relationship.toEntityId;

    entityGraphService.createRelationship(
      {
        type: relationship.type,
        fromEntityId,
        toEntityId,
        metadata: relationship.metadata,
      },
      { source: "phase-derived", runId, phase },
    );
    relationshipsCreated += 1;
  }

  validateReferentialIntegrity();

  return {
    status: "applied",
    summary: {
      entitiesCreated,
      entitiesUpdated,
      entitiesDeleted,
      relationshipsCreated,
      relationshipsDeleted,
      currentPhaseEntityIds: entityGraphService
        .getEntitiesByPhase(phase)
        .map((entity) => entity.id),
    },
  };
}

export const _private = {
  buildRetryMessage,
  isAiOwnedEntity,
  isAiOwnedRelationshipForPhase,
};
