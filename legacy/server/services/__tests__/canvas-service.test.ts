import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  layoutEntities,
  groupEntities,
  emitFocusEvent,
  onFocusRequest,
  _resetForTest as resetCanvas,
} from "../canvas-service";
import {
  newAnalysis,
  createEntity,
  getAnalysis,
  getIsDirty,
  _resetForTest as resetGraph,
} from "../entity-graph-service";

// ── Fixtures ──

function makeFact(content = "A fact") {
  return createEntity(
    {
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact" as const,
        date: "2026-03-19",
        source: "test",
        content,
        category: "action" as const,
      },
      confidence: "high" as const,
      rationale: "test",
      revision: 1,
      stale: false,
    },
    { source: "phase-derived", runId: "run-1" },
  );
}

function makePlayer(name = "USA") {
  return createEntity(
    {
      type: "player",
      phase: "player-identification",
      data: {
        type: "player" as const,
        name,
        playerType: "primary" as const,
        knowledge: [],
      },
      confidence: "high" as const,
      rationale: "primary actor",
      revision: 1,
      stale: false,
    },
    { source: "phase-derived", runId: "run-1" },
  );
}

function makeGame(name = "Tariff Game") {
  return createEntity(
    {
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game" as const,
        name,
        gameType: "prisoners-dilemma" as const,
        timing: "simultaneous" as const,
        description: "",
      },
      confidence: "high" as const,
      rationale: "baseline game",
      revision: 1,
      stale: false,
    },
    { source: "phase-derived", runId: "run-1" },
  );
}

// ── Setup ──

beforeEach(() => {
  resetGraph();
  resetCanvas();
  newAnalysis("Test");
});

// ── layoutEntities ──

describe("layoutEntities", () => {
  it("throws an explicit renderer-owned error", () => {
    makeFact();
    makePlayer();
    makeGame();

    expect(() => layoutEntities("column")).toThrow(
      'Layout strategy "column" is renderer-owned and not available via the server canvas service.',
    );
  });

  it("does not mutate the entity graph", () => {
    const fact = makeFact();

    expect(() => layoutEntities("column")).toThrow();

    const entity = getAnalysis().entities.find((e) => e.id === fact.id)!;
    expect(entity.provenance?.source).toBe("phase-derived");
    expect(getIsDirty()).toBe(true);
  });

  it("throws for unknown strategies through the same renderer-owned boundary", () => {
    expect(() => layoutEntities("radial")).toThrow(
      'Layout strategy "radial" is renderer-owned and not available via the server canvas service.',
    );
  });
});

// ── groupEntities ──

describe("groupEntities", () => {
  it("tags entities with the group label (typed, no as-any cast)", () => {
    const f1 = makeFact("Fact 1");
    const f2 = makeFact("Fact 2");

    groupEntities([f1.id, f2.id], "Trade Wars");

    const entities = getAnalysis().entities;
    const g1 = entities.find((e) => e.id === f1.id)!;
    const g2 = entities.find((e) => e.id === f2.id)!;

    // group is a typed field on AnalysisEntity, no cast needed
    expect(g1.group).toBe("Trade Wars");
    expect(g2.group).toBe("Trade Wars");
  });

  it("uses ai-edited provenance source for grouping", () => {
    const f1 = makeFact("Fact 1");
    groupEntities([f1.id], "Group A");

    const entity = getAnalysis().entities.find((e) => e.id === f1.id)!;
    expect(entity.provenance?.source).toBe("ai-edited");
  });

  it("marks the entity graph as dirty", () => {
    const f1 = makeFact();
    groupEntities([f1.id], "Group A");
    expect(getIsDirty()).toBe(true);
  });
});

// ── emitFocusEvent / onFocusRequest ──

describe("emitFocusEvent", () => {
  it("calls registered focus callbacks", () => {
    const cb = vi.fn();
    onFocusRequest(cb);

    emitFocusEvent("entity-123");

    expect(cb).toHaveBeenCalledWith("entity-123");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("supports multiple listeners", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onFocusRequest(cb1);
    onFocusRequest(cb2);

    emitFocusEvent("entity-456");

    expect(cb1).toHaveBeenCalledWith("entity-456");
    expect(cb2).toHaveBeenCalledWith("entity-456");
  });

  it("unsubscribe removes the listener", () => {
    const cb = vi.fn();
    const unsub = onFocusRequest(cb);

    unsub();
    emitFocusEvent("entity-789");

    expect(cb).not.toHaveBeenCalled();
  });

  it("does nothing with no listeners", () => {
    // Should not throw
    expect(() => emitFocusEvent("entity-000")).not.toThrow();
  });
});
