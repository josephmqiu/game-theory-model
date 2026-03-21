import type { GraderResult, PhaseExpectations } from "./eval-types";
import { ALLOWED_ENTITY_TYPES } from "./eval-types";

interface GradeableEntity {
  type: string;
  ref?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface GradeableRelationship {
  id: string;
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

  // 5. relationship-refs: every relationship fromEntityId/toEntityId resolves to an entity ref
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
