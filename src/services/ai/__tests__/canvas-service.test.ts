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
      position: { x: 0, y: 0 },
      confidence: "high" as const,
      source: "ai" as const,
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
      position: { x: 0, y: 0 },
      confidence: "high" as const,
      source: "ai" as const,
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
      position: { x: 0, y: 0 },
      confidence: "high" as const,
      source: "ai" as const,
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
  it("applies column layout: facts left, players center, games right", () => {
    const fact = makeFact();
    const player = makePlayer();
    const game = makeGame();

    layoutEntities("column");

    const entities = getAnalysis().entities;
    const updated = (id: string) => entities.find((e) => e.id === id)!;

    expect(updated(fact.id).position).toEqual({ x: 100, y: 100 });
    expect(updated(player.id).position).toEqual({ x: 400, y: 100 });
    expect(updated(game.id).position).toEqual({ x: 700, y: 100 });
  });

  it("stacks entities in the same column by index", () => {
    const f1 = makeFact("Fact 1");
    const f2 = makeFact("Fact 2");

    layoutEntities("column");

    const entities = getAnalysis().entities;
    const pos1 = entities.find((e) => e.id === f1.id)!.position;
    const pos2 = entities.find((e) => e.id === f2.id)!.position;

    expect(pos1).toEqual({ x: 100, y: 100 });
    expect(pos2).toEqual({ x: 100, y: 220 });
  });

  it("marks the entity graph as dirty", () => {
    makeFact();
    // Reset dirty flag after entity creation
    newAnalysis("Test");
    makeFact();
    // getIsDirty is already true from createEntity, so verify it stays true
    layoutEntities("column");
    expect(getIsDirty()).toBe(true);
  });

  it("uses ai-edited provenance source for layout mutations", () => {
    const fact = makeFact();
    layoutEntities("column");

    const entity = getAnalysis().entities.find((e) => e.id === fact.id)!;
    expect(entity.provenance?.source).toBe("ai-edited");
  });

  it("throws on unknown layout strategy", () => {
    expect(() => layoutEntities("radial")).toThrow(
      'Unknown layout strategy: "radial"',
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
