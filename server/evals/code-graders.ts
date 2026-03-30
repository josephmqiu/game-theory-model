import type { GraderResult, PhaseExpectations } from "./eval-types";
import {
  PHASE_ENTITY_TYPES,
  PHASE_ENTITY_SCHEMAS,
  validateEntity,
  validatePhaseInvariants,
  isSupportedPhase,
} from "../services/analysis-entity-schemas";
import type { SupportedPhase } from "../services/analysis-entity-schemas";

interface GradeableEntity {
  type: string;
  ref?: string;
  data?: Record<string, unknown> & { category?: string };
  [key: string]: unknown;
}

interface GradeableRelationship {
  id: string;
  type?: string;
  fromEntityId: string;
  toEntityId: string;
  [key: string]: unknown;
}

export function runCodeGraders(
  entities: GradeableEntity[],
  relationships: GradeableRelationship[],
  phase: string,
  expectations: PhaseExpectations,
  priorContext?: string,
): GraderResult[] {
  const results: GraderResult[] = [];

  // 1. entity-count: entities.length within expectations.entityCountRange
  const [min, max] = expectations.entityCountRange;
  const count = entities.length;
  const entityCountPassed = count >= min && count <= max;
  results.push({
    grader: "entity-count",
    passed: entityCountPassed,
    score: entityCountPassed ? 1 : 0,
    message: entityCountPassed
      ? `Entity count ${count} is within range [${min}, ${max}]`
      : `Entity count ${count} is outside range [${min}, ${max}]`,
  });

  // 2. allowed-types: every entity.type in ALLOWED_ENTITY_TYPES[phase]
  const allowedTypes =
    PHASE_ENTITY_TYPES[phase as keyof typeof PHASE_ENTITY_TYPES] ?? [];
  const invalidTypes = entities
    .map((e) => e.type)
    .filter((t) => !allowedTypes.includes(t));
  const allowedTypesPassed = invalidTypes.length === 0;
  results.push({
    grader: "allowed-types",
    passed: allowedTypesPassed,
    score: allowedTypesPassed ? 1 : 0,
    message: allowedTypesPassed
      ? `All entity types are allowed for phase "${phase}"`
      : `Invalid entity types for phase "${phase}": ${invalidTypes.join(", ")}`,
  });

  // 3. forbidden-pattern: no regex from expectations.forbiddenPatterns matches JSON.stringify(entities)
  if (expectations.forbiddenPatterns?.length) {
    const serialized = JSON.stringify(entities);
    let forbiddenPassed = true;
    const messages: string[] = [];

    for (const p of expectations.forbiddenPatterns) {
      let matched = false;
      try {
        const re = new RegExp(p, "i");
        matched = re.test(serialized);
      } catch {
        // Invalid regex — treat as a match
        matched = true;
        messages.push(`[invalid regex: ${p}]`);
      }
      if (matched) {
        forbiddenPassed = false;
        if (!messages.some((m) => m.includes(p))) {
          messages.push(`Forbidden pattern matched: ${p}`);
        }
      }
    }

    results.push({
      grader: "forbidden-pattern",
      passed: forbiddenPassed,
      score: forbiddenPassed ? 1 : 0,
      message: forbiddenPassed
        ? "No forbidden patterns matched"
        : messages.join("; "),
    });
  }

  // 4. required-pattern: each regex from expectations.requiredPatterns matches
  if (expectations.requiredPatterns?.length) {
    const serialized = JSON.stringify(entities);
    let requiredPassed = true;
    const messages: string[] = [];

    for (const p of expectations.requiredPatterns) {
      let found = false;
      try {
        const re = new RegExp(p, "i");
        found = re.test(serialized);
      } catch {
        // Invalid regex — treat as missing
        found = false;
        messages.push(`[invalid regex: ${p}]`);
      }
      if (!found) {
        requiredPassed = false;
        if (!messages.some((m) => m.includes(p))) {
          messages.push(`Required pattern not found: ${p}`);
        }
      }
    }

    results.push({
      grader: "required-pattern",
      passed: requiredPassed,
      score: requiredPassed ? 1 : 0,
      message: requiredPassed
        ? "All required patterns found"
        : messages.join("; "),
    });
  }

  // 5. required-fact-categories: expected Phase 1 fact categories are present
  if (expectations.requiredFactCategories?.length) {
    const categories = new Set(
      entities
        .filter((e) => e.type === "fact")
        .map((e) => e.data?.category)
        .filter((category): category is string => Boolean(category)),
    );
    const missingCategories = expectations.requiredFactCategories.filter(
      (category) => !categories.has(category),
    );
    const categoriesPassed = missingCategories.length === 0;
    results.push({
      grader: "required-fact-categories",
      passed: categoriesPassed,
      score: categoriesPassed ? 1 : 0,
      message: categoriesPassed
        ? "All required fact categories are present"
        : `Missing fact categories: ${missingCategories.join(", ")}`,
    });
  }

  // 6. distinct-fact-categories: ensure adequate category diversity for Phase 1
  if (expectations.minDistinctFactCategories != null) {
    const categoryCount = new Set(
      entities
        .filter((e) => e.type === "fact")
        .map((e) => e.data?.category)
        .filter((category): category is string => Boolean(category)),
    ).size;
    const distinctPassed =
      categoryCount >= expectations.minDistinctFactCategories;
    results.push({
      grader: "distinct-fact-categories",
      passed: distinctPassed,
      score: distinctPassed ? 1 : 0,
      message: distinctPassed
        ? `Observed ${categoryCount} distinct fact categories`
        : `Observed ${categoryCount} distinct fact categories, expected at least ${expectations.minDistinctFactCategories}`,
    });
  }

  // 7. allowed-relationship-types: every relationship.type is permitted for the phase
  if (expectations.allowedRelationshipTypes?.length) {
    const invalidRelationshipTypes = relationships
      .map((r) => r.type ?? "(missing)")
      .filter(
        (type) =>
          !expectations.allowedRelationshipTypes!.includes(
            type as (typeof expectations.allowedRelationshipTypes)[number],
          ),
      );
    const relationshipTypesPassed = invalidRelationshipTypes.length === 0;
    results.push({
      grader: "allowed-relationship-types",
      passed: relationshipTypesPassed,
      score: relationshipTypesPassed ? 1 : 0,
      message: relationshipTypesPassed
        ? "All relationship types are allowed"
        : `Invalid relationship types: ${invalidRelationshipTypes.join(", ")}`,
    });
  }

  // 8. required-relationship-types: expected relationship types are present
  if (expectations.requiredRelationshipTypes?.length) {
    const relationshipTypes = new Set(
      relationships
        .map((r) => r.type)
        .filter((type): type is string => Boolean(type)),
    );
    const missingRelationshipTypes =
      expectations.requiredRelationshipTypes.filter(
        (type) => !relationshipTypes.has(type),
      );
    const requiredRelationshipTypesPassed =
      missingRelationshipTypes.length === 0;
    results.push({
      grader: "required-relationship-types",
      passed: requiredRelationshipTypesPassed,
      score: requiredRelationshipTypesPassed ? 1 : 0,
      message: requiredRelationshipTypesPassed
        ? "All required relationship types are present"
        : `Missing relationship types: ${missingRelationshipTypes.join(", ")}`,
    });
  }

  // 9. relationship-refs: every relationship fromEntityId/toEntityId resolves to an entity ref
  // Include refs from prior phase context (prior entities may be referenced via ID or ref)
  const entityRefs = new Set(entities.map((e) => e.ref).filter(Boolean));
  if (priorContext) {
    try {
      const priorEntities = JSON.parse(priorContext) as Array<{
        ref?: string;
        id?: string;
      }>;
      for (const pe of priorEntities) {
        if (pe.ref) entityRefs.add(pe.ref);
        if (pe.id) entityRefs.add(pe.id);
      }
    } catch {
      /* ignore parse errors */
    }
  }
  const danglingRefs = relationships.flatMap((r) => {
    const dangling: string[] = [];
    if (!entityRefs.has(r.fromEntityId))
      dangling.push(`${r.id}.fromEntityId="${r.fromEntityId}"`);
    if (!entityRefs.has(r.toEntityId))
      dangling.push(`${r.id}.toEntityId="${r.toEntityId}"`);
    return dangling;
  });
  const refsPassed = danglingRefs.length === 0;
  results.push({
    grader: "relationship-refs",
    passed: refsPassed,
    score: refsPassed ? 1 : 0,
    message: refsPassed
      ? "All relationship refs resolve to known entities"
      : `Dangling relationship refs: ${danglingRefs.join(", ")}`,
  });

  // 10. entity-type-mix: per-type count constraints (e.g. ≥1 player AND ≥1 objective)
  if (expectations.entityTypeMix) {
    const typeMixFailures: string[] = [];
    for (const [typeName, [tMin, tMax]] of Object.entries(
      expectations.entityTypeMix,
    )) {
      const typeCount = entities.filter((e) => e.type === typeName).length;
      if (typeCount < tMin || typeCount > tMax) {
        typeMixFailures.push(
          `${typeName}: ${typeCount} (expected [${tMin}, ${tMax}])`,
        );
      }
    }
    const typeMixPassed = typeMixFailures.length === 0;
    results.push({
      grader: "entity-type-mix",
      passed: typeMixPassed,
      score: typeMixPassed ? 1 : 0,
      message: typeMixPassed
        ? "Entity type mix within expected ranges"
        : `Entity type mix violations: ${typeMixFailures.join("; ")}`,
    });
  }

  // 11. cross-phase-refs: entities that reference prior-phase IDs have valid references
  if (expectations.requireCrossPhaseRefs && priorContext) {
    const priorIds = new Set<string>();
    try {
      const priorEntities = JSON.parse(priorContext) as Array<{
        ref?: string;
        id?: string;
      }>;
      for (const pe of priorEntities) {
        if (pe.ref) priorIds.add(pe.ref);
        if (pe.id) priorIds.add(pe.id);
      }
    } catch {
      /* ignore */
    }

    if (priorIds.size > 0) {
      const danglingCrossRefs: string[] = [];
      for (const entity of entities) {
        const data = entity.data as Record<string, unknown> | undefined;
        if (!data) continue;

        // Check known cross-phase reference fields
        const refFields: string[] = [];
        if (Array.isArray(data.dependencies)) refFields.push("dependencies");
        if (Array.isArray(data.key_assumptions))
          refFields.push("key_assumptions");
        if (Array.isArray(data.model_basis)) refFields.push("model_basis");
        if (Array.isArray(data.source_entity_ids))
          refFields.push("source_entity_ids");
        if (Array.isArray(data.supporting_scenarios))
          refFields.push("supporting_scenarios");

        for (const field of refFields) {
          const refs = data[field] as string[];
          for (const ref of refs) {
            // Cross-phase ref must exist in priorContext OR in current entities
            if (!priorIds.has(ref) && !entityRefs.has(ref)) {
              danglingCrossRefs.push(
                `${entity.type}/${entity.ref ?? "?"}.${field}="${ref}"`,
              );
            }
          }
        }
      }

      const crossRefsPassed = danglingCrossRefs.length === 0;
      results.push({
        grader: "cross-phase-refs",
        passed: crossRefsPassed,
        score: crossRefsPassed ? 1 : 0,
        message: crossRefsPassed
          ? "All cross-phase references resolve"
          : `Dangling cross-phase refs: ${danglingCrossRefs.slice(0, 5).join("; ")}`,
      });
    }
  }

  // 12. central-thesis-present: scenarios phase must produce exactly 1 central-thesis
  if (phase === "scenarios" && entities.length > 0) {
    const thesisCount = entities.filter(
      (e) => e.type === "central-thesis",
    ).length;
    const thesisPassed = thesisCount === 1;
    results.push({
      grader: "central-thesis-present",
      passed: thesisPassed,
      score: thesisPassed ? 1 : 0,
      message: thesisPassed
        ? "Exactly 1 central-thesis entity present"
        : `Expected exactly 1 central-thesis, found ${thesisCount}`,
    });
  }

  // 13. meta-check-completeness: meta-check must have exactly 10 questions numbered 1-10
  if (phase === "meta-check" && entities.length > 0) {
    const metaCheck = entities.find((e) => e.type === "meta-check");
    if (metaCheck) {
      const questions = (metaCheck.data as any)?.questions as
        | Array<{ question_number?: number; answer?: string }>
        | undefined;
      const questionNumbers = new Set(
        (questions ?? []).map((q) => q.question_number),
      );
      const hasAll10 =
        questions?.length === 10 &&
        Array.from({ length: 10 }, (_, i) => i + 1).every((n) =>
          questionNumbers.has(n),
        );
      const allAnswered =
        questions?.every(
          (q) => typeof q.answer === "string" && q.answer.length > 0,
        ) ?? false;
      const completePassed = Boolean(hasAll10 && allAnswered);
      results.push({
        grader: "meta-check-completeness",
        passed: completePassed,
        score: completePassed ? 1 : 0,
        message: completePassed
          ? "Meta-check has all 10 questions with answers"
          : `Meta-check incomplete: ${questions?.length ?? 0} questions, ${hasAll10 ? "all numbered" : "missing numbers"}, ${allAnswered ? "all answered" : "some unanswered"}`,
      });
    }
  }

  // 14. phase-invariants (production): structural requirements per phase
  // (e.g. player-identification needs >=1 player, scenarios probabilities ~100%)
  if (isSupportedPhase(phase as any)) {
    const invariantResult = validatePhaseInvariants(
      phase as SupportedPhase,
      entities.map((e) => ({
        type: e.type,
        data: (e.data ?? {}) as Record<string, unknown>,
      })),
    );
    results.push({
      grader: "phase-invariants",
      passed: invariantResult.success,
      score: invariantResult.success ? 1 : 0,
      message: invariantResult.success
        ? "Phase invariants satisfied"
        : `Phase invariant violation: ${(invariantResult as { error: string }).error}`,
    });
  }

  // 15. schema-validation: validate each entity against its phase Zod schema
  if (isSupportedPhase(phase as any)) {
    const schemas = PHASE_ENTITY_SCHEMAS[phase as SupportedPhase] ?? [];
    if (schemas.length > 0 && entities.length > 0) {
      const failures: string[] = [];
      for (const entity of entities) {
        const result = validateEntity(entity, schemas);
        if (!result.success) {
          const issues = result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .slice(0, 3)
            .join("; ");
          failures.push(`${entity.type}/${entity.ref ?? "?"}: ${issues}`);
        }
      }
      const schemaPassed = failures.length === 0;
      results.push({
        grader: "schema-validation",
        passed: schemaPassed,
        score: schemaPassed ? 1 : 0,
        message: schemaPassed
          ? "All entities pass Zod schema validation"
          : `Schema violations: ${failures.slice(0, 5).join("; ")}`,
      });
    }
  }

  return results;
}
