import {
  entityDataSchema,
  type Analysis,
  type AnalysisEntity,
  type AnalysisRelationship,
} from "@/types/entity";

// ── Result types ──

export interface ValidationResult {
  success: boolean;
  errors: string[];
}

export interface RelationshipValidation {
  danglingRefs: {
    relationshipId: string;
    field: "from" | "to";
    entityId: string;
  }[];
}

export interface AnalysisValidationIssue {
  type: "duplicate-id" | "dangling-ref" | "invalid-entity";
  message: string;
  entityId?: string;
}

export interface AnalysisValidationResult {
  isValid: boolean;
  issues: AnalysisValidationIssue[];
}

// ── Validators ──

/** Validate a single entity's data against its Zod schema. */
export function validateEntity(entity: AnalysisEntity): ValidationResult {
  const result = entityDataSchema.safeParse(entity.data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => i.message),
    };
  }
  return { success: true, errors: [] };
}

/** Check relationships for references to entities that don't exist. */
export function validateRelationships(
  relationships: AnalysisRelationship[],
  entities: AnalysisEntity[],
): RelationshipValidation {
  const entityIds = new Set(entities.map((e) => e.id));
  const danglingRefs: RelationshipValidation["danglingRefs"] = [];

  for (const rel of relationships) {
    if (!entityIds.has(rel.fromEntityId)) {
      danglingRefs.push({
        relationshipId: rel.id,
        field: "from",
        entityId: rel.fromEntityId,
      });
    }
    if (!entityIds.has(rel.toEntityId)) {
      danglingRefs.push({
        relationshipId: rel.id,
        field: "to",
        entityId: rel.toEntityId,
      });
    }
  }

  return { danglingRefs };
}

/** Full analysis validation: duplicate IDs, entity data, relationship refs. */
export function validateAnalysis(analysis: Analysis): AnalysisValidationResult {
  const issues: AnalysisValidationIssue[] = [];

  // Check duplicate entity IDs
  const seen = new Set<string>();
  for (const entity of analysis.entities) {
    if (seen.has(entity.id)) {
      issues.push({
        type: "duplicate-id",
        message: `Duplicate entity ID: ${entity.id}`,
        entityId: entity.id,
      });
    }
    seen.add(entity.id);
  }

  // Validate each entity
  for (const entity of analysis.entities) {
    const result = validateEntity(entity);
    if (!result.success) {
      issues.push({
        type: "invalid-entity",
        message: result.errors.join("; "),
        entityId: entity.id,
      });
    }
  }

  // Validate relationships
  const relResult = validateRelationships(
    analysis.relationships,
    analysis.entities,
  );
  for (const ref of relResult.danglingRefs) {
    issues.push({
      type: "dangling-ref",
      message: `Relationship ${ref.relationshipId} references missing entity ${ref.entityId}`,
    });
  }

  return { isValid: issues.length === 0, issues };
}
