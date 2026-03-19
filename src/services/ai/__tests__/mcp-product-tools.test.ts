import { describe, it, expect, beforeEach } from "vitest";
import {
  newAnalysis,
  createEntity,
  getAnalysis,
  _resetForTest,
} from "../entity-graph-service";
import {
  handleGetEntities,
  handleCreateEntity,
  handleUpdateEntity,
  handleGetRelationships,
  handleCreateRelationship,
  handleUpdateRelationship,
} from "@/mcp/server";

// ── Fixtures ──

function makeFactData() {
  return {
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: "A fact",
      category: "action" as const,
    },
    position: { x: 0, y: 0 },
    confidence: "high" as const,
    source: "ai" as const,
    rationale: "test rationale",
    revision: 1,
    stale: false,
  };
}

function makePlayerData() {
  return {
    type: "player" as const,
    phase: "player-identification" as const,
    data: {
      type: "player" as const,
      name: "USA",
      playerType: "primary" as const,
      knowledge: [],
    },
    position: { x: 100, y: 100 },
    confidence: "high" as const,
    source: "ai" as const,
    rationale: "primary actor",
    revision: 1,
    stale: false,
  };
}

const defaultProvenance = {
  source: "phase-derived" as const,
  runId: "run-1",
  phase: "situational-grounding",
};

// ── Setup ──

beforeEach(() => {
  _resetForTest();
  newAnalysis("US-China trade war");
});

// ── get_entities ──

describe("handleGetEntities", () => {
  it("returns all entities when no filters", () => {
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const result = JSON.parse(handleGetEntities({}));
    expect(result).toHaveLength(2);
  });

  it("filters by phase", () => {
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const result = JSON.parse(
      handleGetEntities({ phase: "situational-grounding" }),
    );
    expect(result).toHaveLength(2);
    expect(result.every((e: any) => e.phase === "situational-grounding")).toBe(
      true,
    );
  });

  it("filters by entity type", () => {
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const result = JSON.parse(handleGetEntities({ type: "player" }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("player");
  });
});

// ── create_entity ──

describe("handleCreateEntity", () => {
  it("returns side-effect summary with created entity and ai-edited provenance", () => {
    const result = JSON.parse(
      handleCreateEntity({
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "test",
          content: "New fact",
          category: "action",
        },
        confidence: "high",
        rationale: "test",
      }),
    );

    // Side-effect summary shape
    expect(result.created).toHaveLength(1);
    expect(result.updated).toEqual([]);
    expect(result.staleMarked).toEqual([]);
    expect(result.grouped).toEqual([]);

    const entity = result.created[0];
    expect(entity.id).toBeTruthy();
    expect(entity.type).toBe("fact");
    expect(entity.provenance.source).toBe("ai-edited");
    expect(entity.provenance.timestamp).toBeGreaterThan(0);

    // Verify it was actually stored
    expect(getAnalysis().entities).toHaveLength(1);
  });

  it("uses default position and confidence when omitted", () => {
    const result = JSON.parse(
      handleCreateEntity({
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "China",
          playerType: "primary",
          knowledge: [],
        },
      }),
    );

    const entity = result.created[0];
    expect(entity.position).toEqual({ x: 0, y: 0 });
    expect(entity.confidence).toBe("medium");
  });

  it("includes runId in provenance when provided", () => {
    const result = JSON.parse(
      handleCreateEntity({
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "test",
          content: "Fact with runId",
          category: "action",
        },
        runId: "run-42",
      }),
    );

    const entity = result.created[0];
    expect(entity.provenance.source).toBe("ai-edited");
    expect(entity.provenance.runId).toBe("run-42");
  });
});

// ── update_entity ──

describe("handleUpdateEntity", () => {
  it("returns side-effect summary with updated entity and chained previousOrigin", () => {
    const entity = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      handleUpdateEntity({
        id: entity.id,
        rationale: "updated rationale",
      }),
    );

    // Side-effect summary shape
    expect(result.created).toEqual([]);
    expect(result.updated).toHaveLength(1);
    expect(result.staleMarked).toEqual([]);
    expect(result.grouped).toEqual([]);

    const updated = result.updated[0];
    expect(updated.rationale).toBe("updated rationale");
    expect(updated.provenance.source).toBe("ai-edited");
    expect(updated.provenance.previousOrigin).toBeDefined();
    expect(updated.provenance.previousOrigin.source).toBe("phase-derived");
  });

  it("returns error for nonexistent ID", () => {
    const result = JSON.parse(
      handleUpdateEntity({ id: "nonexistent-id", rationale: "nope" }),
    );

    expect(result.error).toContain("nonexistent-id");
    expect(result.error).toContain("not found");
  });

  it("includes runId in provenance when provided", () => {
    const entity = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      handleUpdateEntity({
        id: entity.id,
        rationale: "updated with runId",
        runId: "run-99",
      }),
    );

    const updated = result.updated[0];
    expect(updated.provenance.source).toBe("ai-edited");
    expect(updated.provenance.runId).toBe("run-99");
  });
});

// ── get_relationships ──

describe("handleGetRelationships", () => {
  it("returns all relationships when no filters", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    handleCreateRelationship({
      type: "supports",
      from: e1.id,
      to: e2.id,
    });

    const result = JSON.parse(handleGetRelationships({}));
    expect(result).toHaveLength(1);
  });

  it("filters by type", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);

    handleCreateRelationship({
      type: "supports",
      from: e1.id,
      to: e2.id,
    });
    handleCreateRelationship({
      type: "contradicts",
      from: e2.id,
      to: e3.id,
    });

    const result = JSON.parse(handleGetRelationships({ type: "supports" }));
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("supports");
  });

  it("filters by entityId", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);

    handleCreateRelationship({
      type: "supports",
      from: e1.id,
      to: e2.id,
    });
    handleCreateRelationship({
      type: "contradicts",
      from: e2.id,
      to: e3.id,
    });

    // e2 is involved in both
    const result = JSON.parse(handleGetRelationships({ entityId: e2.id }));
    expect(result).toHaveLength(2);
  });
});

// ── create_relationship ──

describe("handleCreateRelationship", () => {
  it("creates a relationship between existing entities", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const result = JSON.parse(
      handleCreateRelationship({
        type: "supports",
        from: e1.id,
        to: e2.id,
      }),
    );

    expect(result.id).toBeTruthy();
    expect(result.type).toBe("supports");
    expect(result.fromEntityId).toBe(e1.id);
    expect(result.toEntityId).toBe(e2.id);

    // Verify it was stored
    expect(getAnalysis().relationships).toHaveLength(1);
  });

  it("validates entity IDs exist — returns error for invalid from", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      handleCreateRelationship({
        type: "supports",
        from: "nonexistent",
        to: e1.id,
      }),
    );

    expect(result.error).toContain("fromEntityId");
    expect(result.error).toContain("nonexistent");
  });

  it("validates entity IDs exist — returns error for invalid to", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      handleCreateRelationship({
        type: "supports",
        from: e1.id,
        to: "nonexistent",
      }),
    );

    expect(result.error).toContain("toEntityId");
    expect(result.error).toContain("nonexistent");
  });

  it("passes meta through as metadata", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      handleCreateRelationship({
        type: "supports",
        from: e1.id,
        to: e2.id,
        meta: { strength: "strong" },
      }),
    );

    expect(result.metadata).toEqual({ strength: "strong" });
  });
});

// ── update_relationship ──

describe("handleUpdateRelationship", () => {
  it("updates an existing relationship", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    const created = JSON.parse(
      handleCreateRelationship({
        type: "supports",
        from: e1.id,
        to: e2.id,
      }),
    );

    const result = JSON.parse(
      handleUpdateRelationship({ id: created.id, type: "contradicts" }),
    );

    expect(result.type).toBe("contradicts");
    expect(result.id).toBe(created.id);
  });

  it("returns error for nonexistent relationship", () => {
    const result = JSON.parse(
      handleUpdateRelationship({ id: "nonexistent", type: "links" }),
    );

    expect(result.error).toContain("nonexistent");
    expect(result.error).toContain("not found");
  });
});
