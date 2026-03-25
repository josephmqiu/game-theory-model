import { describe, expect, it } from "vitest";
import { runCodeGraders } from "../code-graders";

describe("runCodeGraders", () => {
  it("passes when all checks pass", () => {
    const entities = [
      { type: "player", ref: "p1", data: { name: "Alice" } },
      { type: "objective", ref: "o1", data: { name: "Win" } },
    ];
    const relationships = [{ id: "r1", fromEntityId: "p1", toEntityId: "o1" }];
    const results = runCodeGraders(
      entities,
      relationships,
      "player-identification",
      {
        entityCountRange: [2, 6],
      },
    );
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("fails entity-count when out of range", () => {
    const entities = Array.from({ length: 12 }, (_, i) => ({
      type: "player",
      ref: `p${i}`,
    }));
    const results = runCodeGraders(entities, [], "player-identification", {
      entityCountRange: [2, 6],
    });
    const entityCountResult = results.find((r) => r.grader === "entity-count");
    expect(entityCountResult?.passed).toBe(false);
  });

  it("fails forbidden-pattern when matched", () => {
    const entities = [{ type: "player", ref: "p1", data: { name: "Referee" } }];
    const results = runCodeGraders(entities, [], "player-identification", {
      entityCountRange: [1, 6],
      forbiddenPatterns: ["referee"],
    });
    const forbiddenResult = results.find(
      (r) => r.grader === "forbidden-pattern",
    );
    expect(forbiddenResult?.passed).toBe(false);
  });

  it("fails allowed-types when entity type is wrong for phase", () => {
    const entities = [
      { type: "assumption", ref: "a1", data: { name: "Some assumption" } },
    ];
    const results = runCodeGraders(entities, [], "player-identification", {
      entityCountRange: [1, 6],
    });
    const allowedTypesResult = results.find(
      (r) => r.grader === "allowed-types",
    );
    expect(allowedTypesResult?.passed).toBe(false);
  });

  it("fails required-pattern when not found", () => {
    const entities = [{ type: "player", ref: "p1", data: { name: "Alice" } }];
    const results = runCodeGraders(entities, [], "player-identification", {
      entityCountRange: [1, 6],
      requiredPatterns: ["Player 1"],
    });
    const requiredResult = results.find((r) => r.grader === "required-pattern");
    expect(requiredResult?.passed).toBe(false);
  });

  it("passes relationship-refs when all refs resolve", () => {
    const entities = [
      { type: "player", ref: "p1" },
      { type: "objective", ref: "o1" },
    ];
    const relationships = [{ id: "r1", fromEntityId: "p1", toEntityId: "o1" }];
    const results = runCodeGraders(
      entities,
      relationships,
      "player-identification",
      {
        entityCountRange: [1, 6],
      },
    );
    const refsResult = results.find((r) => r.grader === "relationship-refs");
    expect(refsResult?.passed).toBe(true);
  });

  it("fails relationship-refs when ref is dangling", () => {
    const entities = [
      { type: "player", ref: "p1" },
      { type: "objective", ref: "o1" },
    ];
    const relationships = [
      { id: "r1", fromEntityId: "p1", toEntityId: "missing" },
    ];
    const results = runCodeGraders(
      entities,
      relationships,
      "player-identification",
      {
        entityCountRange: [1, 6],
      },
    );
    const refsResult = results.find((r) => r.grader === "relationship-refs");
    expect(refsResult?.passed).toBe(false);
  });

  it("fails entity-count when zero entities and min is 1", () => {
    const results = runCodeGraders([], [], "player-identification", {
      entityCountRange: [1, 5],
    });
    const entityCountResult = results.find((r) => r.grader === "entity-count");
    expect(entityCountResult?.passed).toBe(false);
  });

  it("handles invalid regex in forbidden patterns gracefully", () => {
    const entities = [{ type: "player", ref: "p1", data: { name: "Alice" } }];
    const results = runCodeGraders(entities, [], "player-identification", {
      entityCountRange: [1, 6],
      forbiddenPatterns: ["[invalid(regex"],
    });
    const forbiddenResult = results.find(
      (r) => r.grader === "forbidden-pattern",
    );
    expect(forbiddenResult?.passed).toBe(false);
    expect(forbiddenResult?.message).toContain("[invalid regex:");
  });

  it("fails when required fact categories are missing", () => {
    const entities = [
      {
        type: "fact",
        ref: "fact-1",
        data: { category: "action", content: "A move happened" },
      },
      {
        type: "fact",
        ref: "fact-2",
        data: { category: "economic", content: "Costs changed" },
      },
    ];
    const results = runCodeGraders(
      entities,
      [],
      "situational-grounding",
      {
        entityCountRange: [2, 6],
        requiredFactCategories: ["action", "rule", "position"],
      },
    );
    const categoryResult = results.find(
      (r) => r.grader === "required-fact-categories",
    );
    expect(categoryResult?.passed).toBe(false);
    expect(categoryResult?.message).toContain("rule");
    expect(categoryResult?.message).toContain("position");
  });

  it("fails when fact category diversity is too low", () => {
    const entities = [
      {
        type: "fact",
        ref: "fact-1",
        data: { category: "rule", content: "Rule one" },
      },
      {
        type: "fact",
        ref: "fact-2",
        data: { category: "rule", content: "Rule two" },
      },
      {
        type: "fact",
        ref: "fact-3",
        data: { category: "action", content: "Action" },
      },
    ];
    const results = runCodeGraders(
      entities,
      [],
      "situational-grounding",
      {
        entityCountRange: [2, 6],
        minDistinctFactCategories: 3,
      },
    );
    const distinctResult = results.find(
      (r) => r.grader === "distinct-fact-categories",
    );
    expect(distinctResult?.passed).toBe(false);
  });

  it("fails when relationship types fall outside the allowed Phase 1 set", () => {
    const entities = [
      { type: "fact", ref: "fact-1", data: { category: "action" } },
      { type: "fact", ref: "fact-2", data: { category: "rule" } },
    ];
    const relationships = [
      {
        id: "rel-1",
        type: "supports",
        fromEntityId: "fact-1",
        toEntityId: "fact-2",
      },
      {
        id: "rel-2",
        type: "depends-on",
        fromEntityId: "fact-2",
        toEntityId: "fact-1",
      },
    ];
    const results = runCodeGraders(
      entities,
      relationships,
      "situational-grounding",
      {
        entityCountRange: [2, 6],
        allowedRelationshipTypes: ["supports", "contradicts", "precedes"],
      },
    );
    const relationshipTypeResult = results.find(
      (r) => r.grader === "allowed-relationship-types",
    );
    expect(relationshipTypeResult?.passed).toBe(false);
    expect(relationshipTypeResult?.message).toContain("depends-on");
  });

  it("fails when a required relationship type is missing", () => {
    const entities = [
      { type: "fact", ref: "fact-1", data: { category: "action" } },
      { type: "fact", ref: "fact-2", data: { category: "action" } },
    ];
    const relationships = [
      {
        id: "rel-1",
        type: "supports",
        fromEntityId: "fact-1",
        toEntityId: "fact-2",
      },
    ];
    const results = runCodeGraders(
      entities,
      relationships,
      "situational-grounding",
      {
        entityCountRange: [2, 6],
        requiredRelationshipTypes: ["precedes"],
      },
    );
    const requiredRelationshipTypeResult = results.find(
      (r) => r.grader === "required-relationship-types",
    );
    expect(requiredRelationshipTypeResult?.passed).toBe(false);
    expect(requiredRelationshipTypeResult?.message).toContain("precedes");
  });

  it("catches rps-style Phase 1 drift with forbidden patterns and overproduction", () => {
    const entities = [
      {
        type: "fact",
        ref: "fact-1",
        data: { category: "rule", content: "Rock beats scissors" },
      },
      {
        type: "fact",
        ref: "fact-2",
        data: { category: "rule", content: "Paper beats rock" },
      },
      {
        type: "fact",
        ref: "fact-3",
        data: { category: "rule", content: "Scissors beats paper" },
      },
      {
        type: "fact",
        ref: "fact-4",
        data: { category: "impact", content: "Lizard-Spock variants exist" },
      },
      {
        type: "fact",
        ref: "fact-5",
        data: { category: "impact", content: "Evolutionary biology studies exist" },
      },
    ];
    const results = runCodeGraders(
      entities,
      [],
      "situational-grounding",
      {
        entityCountRange: [3, 4],
        forbiddenPatterns: ["lizard", "evolutionary"],
      },
    );
    expect(results.find((r) => r.grader === "entity-count")?.passed).toBe(
      false,
    );
    expect(
      results.find((r) => r.grader === "forbidden-pattern")?.passed,
    ).toBe(false);
  });
});
