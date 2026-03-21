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
});
