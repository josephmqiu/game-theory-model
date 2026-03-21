import { describe, expect, it } from "vitest";
import { loadFixtures } from "../run-eval";
import {
  ALLOWED_FACT_CATEGORIES,
  ALLOWED_PHASE_1_RELATIONSHIP_TYPES,
} from "../eval-types";

describe("eval fixtures", () => {
  it("use only valid Phase 1 fact categories and relationship types", () => {
    const fixtures = loadFixtures();

    for (const fixture of fixtures) {
      const expectations = fixture.phases["situational-grounding"];
      if (!expectations) continue;

      for (const category of expectations.requiredFactCategories ?? []) {
        expect(ALLOWED_FACT_CATEGORIES.includes(category)).toBe(true);
      }
      for (const type of expectations.allowedRelationshipTypes ?? []) {
        expect(ALLOWED_PHASE_1_RELATIONSHIP_TYPES.includes(type)).toBe(true);
      }
      for (const type of expectations.requiredRelationshipTypes ?? []) {
        expect(ALLOWED_PHASE_1_RELATIONSHIP_TYPES.includes(type)).toBe(true);
      }

      if (expectations.requiredRelationshipTypes?.length) {
        expect(expectations.allowedRelationshipTypes).toBeDefined();
        for (const type of expectations.requiredRelationshipTypes) {
          expect(expectations.allowedRelationshipTypes!.includes(type)).toBe(
            true,
          );
        }
      }
    }
  });

  it("encode key regression guards for trivial, standard, and complex Phase 1 prompts", () => {
    const fixtures = loadFixtures();
    const byName = new Map(fixtures.map((fixture) => [fixture.name, fixture]));

    const rps =
      byName.get("rps")?.phases["situational-grounding"];
    expect(rps?.entityCountRange).toEqual([2, 5]);
    expect(rps?.requiredFactCategories).toEqual(["rule"]);
    expect(rps?.forbiddenPatterns).toEqual(
      expect.arrayContaining(["lizard", "spock", "cheating"]),
    );

    const union =
      byName.get("union-contract")?.phases["situational-grounding"];
    expect(union?.requiredFactCategories).toEqual(
      expect.arrayContaining(["position", "rule"]),
    );

    const semiconductor =
      byName.get("semiconductor-trade")?.phases["situational-grounding"];
    expect(semiconductor?.minDistinctFactCategories).toBeGreaterThanOrEqual(4);
    expect(semiconductor?.requiredPatterns).toEqual(
      expect.arrayContaining(["US|United States", "China", "EU|European Union"]),
    );
    expect(semiconductor?.requiredRelationshipTypes).toEqual(["precedes"]);
  });
});
