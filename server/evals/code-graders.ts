import type { GraderResult, PhaseExpectations } from "./eval-types";
import { ALLOWED_ENTITY_TYPES } from "./eval-types";

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
  const allowedTypes = ALLOWED_ENTITY_TYPES[phase] ?? [];
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
    const missingRelationshipTypes = expectations.requiredRelationshipTypes.filter(
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
  const entityRefs = new Set(entities.map((e) => e.ref).filter(Boolean));
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

  return results;
}
