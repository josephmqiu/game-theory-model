import { describe, it, expect } from "vitest";
import {
  validateEntity,
  validateRelationships,
  validateAnalysis,
} from "../entity-validation";
import type {
  AnalysisEntity,
  AnalysisRelationship,
  Analysis,
} from "@/types/entity";

const makeEntity = (
  overrides: Partial<AnalysisEntity> = {},
): AnalysisEntity => ({
  id: "e1",
  type: "fact",
  phase: "situational-grounding",
  data: {
    type: "fact",
    date: "2026-01-01",
    source: "Reuters",
    content: "Test fact",
    category: "action",
  },
  position: { x: 0, y: 0 },
  confidence: "high",
  source: "ai",
  rationale: "Test",
  revision: 1,
  stale: false,
  ...overrides,
});

const makeRelationship = (
  overrides: Partial<AnalysisRelationship> = {},
): AnalysisRelationship => ({
  id: "r1",
  type: "supports",
  fromEntityId: "e1",
  toEntityId: "e2",
  ...overrides,
});

describe("validateEntity", () => {
  it("accepts a valid entity", () => {
    expect(validateEntity(makeEntity()).success).toBe(true);
  });

  it("rejects entity with invalid data type", () => {
    const entity = makeEntity({
      data: {
        type: "fact",
        date: "",
        source: "",
        content: "",
        category: "invalid" as any,
      },
    });
    expect(validateEntity(entity).success).toBe(false);
  });

  it("validates a player entity", () => {
    const entity = makeEntity({
      id: "p1",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "USA",
        playerType: "primary",
        knowledge: [],
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates a game entity", () => {
    const entity = makeEntity({
      id: "g1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Trade War",
        gameType: "chicken",
        timing: "simultaneous",
        description: "",
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates a strategy entity", () => {
    const entity = makeEntity({
      id: "s1",
      type: "strategy",
      phase: "baseline-model",
      data: {
        type: "strategy",
        name: "Escalate",
        feasibility: "actual",
        description: "",
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates an objective entity", () => {
    const entity = makeEntity({
      id: "o1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Maintain trade surplus",
        priority: "high",
        stability: "stable",
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates a payoff entity", () => {
    const entity = makeEntity({
      id: "pay1",
      type: "payoff",
      phase: "baseline-model",
      data: {
        type: "payoff",
        rank: 1,
        value: 10,
        rationale: "Best outcome",
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates an institutional-rule entity", () => {
    const entity = makeEntity({
      id: "ir1",
      type: "institutional-rule",
      phase: "baseline-model",
      data: {
        type: "institutional-rule",
        name: "WTO Rules",
        ruleType: "international",
        effectOnStrategies: "Limits tariff escalation",
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });

  it("validates an escalation-rung entity", () => {
    const entity = makeEntity({
      id: "er1",
      type: "escalation-rung",
      phase: "baseline-model",
      data: {
        type: "escalation-rung",
        action: "Impose sanctions",
        reversibility: "partially-reversible",
        climbed: false,
        order: 2,
      },
    });
    expect(validateEntity(entity).success).toBe(true);
  });
});

describe("validateRelationships", () => {
  it("accepts valid relationships", () => {
    const entities = [makeEntity({ id: "e1" }), makeEntity({ id: "e2" })];
    const relationships = [
      makeRelationship({ fromEntityId: "e1", toEntityId: "e2" }),
    ];
    const result = validateRelationships(relationships, entities);
    expect(result.danglingRefs).toHaveLength(0);
  });

  it("detects dangling fromEntityId", () => {
    const entities = [makeEntity({ id: "e2" })];
    const relationships = [
      makeRelationship({ fromEntityId: "missing", toEntityId: "e2" }),
    ];
    const result = validateRelationships(relationships, entities);
    expect(result.danglingRefs).toHaveLength(1);
    expect(result.danglingRefs[0]).toEqual(
      expect.objectContaining({ field: "from", entityId: "missing" }),
    );
  });

  it("detects dangling toEntityId", () => {
    const entities = [makeEntity({ id: "e1" })];
    const relationships = [
      makeRelationship({ fromEntityId: "e1", toEntityId: "missing" }),
    ];
    const result = validateRelationships(relationships, entities);
    expect(result.danglingRefs).toHaveLength(1);
    expect(result.danglingRefs[0]).toEqual(
      expect.objectContaining({ field: "to", entityId: "missing" }),
    );
  });
});

describe("validateAnalysis", () => {
  it("detects duplicate entity IDs", () => {
    const analysis: Analysis = {
      id: "a1",
      name: "Test",
      topic: "Test",
      entities: [makeEntity({ id: "dup" }), makeEntity({ id: "dup" })],
      relationships: [],
      phases: [],
    };
    const result = validateAnalysis(analysis);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ type: "duplicate-id" }),
    );
  });

  it("catches invalid entities", () => {
    const analysis: Analysis = {
      id: "a1",
      name: "Test",
      topic: "Test",
      entities: [
        makeEntity({
          id: "bad",
          data: {
            type: "fact",
            date: "",
            source: "",
            content: "",
            category: "invalid" as any,
          },
        }),
      ],
      relationships: [],
      phases: [],
    };
    const result = validateAnalysis(analysis);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ type: "invalid-entity", entityId: "bad" }),
    );
  });

  it("catches dangling relationship refs", () => {
    const analysis: Analysis = {
      id: "a1",
      name: "Test",
      topic: "Test",
      entities: [makeEntity({ id: "e1" })],
      relationships: [
        makeRelationship({ fromEntityId: "e1", toEntityId: "ghost" }),
      ],
      phases: [],
    };
    const result = validateAnalysis(analysis);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ type: "dangling-ref" }),
    );
  });

  it("passes a valid analysis", () => {
    const analysis: Analysis = {
      id: "a1",
      name: "Test Analysis",
      topic: "Trade conflict",
      entities: [makeEntity({ id: "e1" }), makeEntity({ id: "e2" })],
      relationships: [
        makeRelationship({ fromEntityId: "e1", toEntityId: "e2" }),
      ],
      phases: [],
    };
    const result = validateAnalysis(analysis);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
