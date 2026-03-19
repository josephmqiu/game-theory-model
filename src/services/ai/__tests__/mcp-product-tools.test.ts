import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  newAnalysis,
  createEntity,
  createRelationship,
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
  handleStartAnalysis,
  handleGetAnalysisStatus,
  handleGetAnalysisResult,
  handleRevalidateEntities,
  handleLayoutEntities,
  handleFocusEntity,
  handleGroupEntities,
} from "@/mcp/server";

// ── Mocks ──

vi.mock("@/services/ai/analysis-orchestrator", () => ({
  runFull: vi.fn().mockResolvedValue({ runId: "run-mock-123" }),
  getStatus: vi.fn().mockReturnValue({
    runId: "run-mock-123",
    status: "running",
    activePhase: "situational-grounding",
    phasesCompleted: 1,
    totalPhases: 3,
  }),
  getResult: vi.fn().mockReturnValue({
    runId: "run-mock-123",
    entities: [{ id: "e1", type: "fact" }],
    relationships: [{ id: "r1", type: "supports" }],
  }),
}));

vi.mock("@/services/ai/revalidation-service", () => ({
  revalidate: vi.fn().mockReturnValue({ runId: "reval-mock-456" }),
  getRevalStatus: vi.fn().mockImplementation((runId: string) => {
    // Only return status for reval runIds, return null for analysis runIds
    if (runId === "reval-mock-456") {
      return { runId: "reval-mock-456", status: "running", phasesCompleted: 0 };
    }
    return null;
  }),
}));

vi.mock("@/services/ai/canvas-service", () => ({
  layoutEntities: vi.fn(),
  groupEntities: vi.fn(),
  emitFocusEvent: vi.fn(),
}));

// Mock UI stores to prevent provider/model fallback from resolving in tests
vi.mock("@/stores/ai-store", () => ({
  useAIStore: {
    getState: () => ({
      model: "",
      modelGroups: [],
    }),
  },
}));

vi.mock("@/stores/agent-settings-store", () => ({
  useAgentSettingsStore: {
    getState: () => ({
      providers: {},
    }),
  },
}));

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
  vi.clearAllMocks();
});

// ── start_analysis ──

describe("handleStartAnalysis", () => {
  it("calls orchestrator.runFull and returns runId with status", async () => {
    const { runFull } = await import("@/services/ai/analysis-orchestrator");

    const result = JSON.parse(
      await handleStartAnalysis({ topic: "US-China semiconductor trade war" }),
    );

    expect(runFull).toHaveBeenCalledWith(
      "US-China semiconductor trade war",
      undefined,
      undefined,
    );
    expect(result.runId).toBe("run-mock-123");
    expect(result.status).toBe("started");
    expect(result.estimatedPhases).toBe(3);
  });

  it("passes provider and model through to orchestrator.runFull", async () => {
    const { runFull } = await import("@/services/ai/analysis-orchestrator");

    const result = JSON.parse(
      await handleStartAnalysis({
        topic: "NATO expansion",
        provider: "openai",
        model: "gpt-4o",
      }),
    );

    expect(runFull).toHaveBeenCalledWith("NATO expansion", "openai", "gpt-4o");
    expect(result.runId).toBe("run-mock-123");
    expect(result.status).toBe("started");
  });
});

// ── get_analysis_status ──

describe("handleGetAnalysisStatus", () => {
  it("calls orchestrator.getStatus and returns status object", async () => {
    const { getStatus } = await import("@/services/ai/analysis-orchestrator");

    const result = JSON.parse(
      handleGetAnalysisStatus({ runId: "run-mock-123" }),
    );

    expect(getStatus).toHaveBeenCalledWith("run-mock-123");
    expect(result.runId).toBe("run-mock-123");
    expect(result.status).toBe("running");
    expect(result.activePhase).toBe("situational-grounding");
    expect(result.phasesCompleted).toBe(1);
    expect(result.totalPhases).toBe(3);
  });
});

// ── get_analysis_result ──

describe("handleGetAnalysisResult", () => {
  it("calls orchestrator.getResult and returns entities/relationships", async () => {
    const { getResult } = await import("@/services/ai/analysis-orchestrator");

    const result = JSON.parse(
      handleGetAnalysisResult({ runId: "run-mock-123" }),
    );

    expect(getResult).toHaveBeenCalledWith("run-mock-123");
    expect(result.runId).toBe("run-mock-123");
    expect(result.entities).toHaveLength(1);
    expect(result.relationships).toHaveLength(1);
  });
});

// ── revalidate_entities ──

describe("handleRevalidateEntities", () => {
  it("calls revalidationService.revalidate with entityIds and phase", async () => {
    const { revalidate } = await import("@/services/ai/revalidation-service");

    const result = JSON.parse(
      handleRevalidateEntities({
        entityIds: ["e1", "e2"],
        phase: "situational-grounding",
      }),
    );

    expect(revalidate).toHaveBeenCalledWith(
      ["e1", "e2"],
      "situational-grounding",
    );
    expect(result.runId).toBe("reval-mock-456");
    expect(result.status).toBe("running");
  });

  it("passes undefined when no entityIds or phase given", async () => {
    const { revalidate } = await import("@/services/ai/revalidation-service");

    handleRevalidateEntities({});

    expect(revalidate).toHaveBeenCalledWith(undefined, undefined);
  });
});

// ── layout_entities ──

describe("handleLayoutEntities", () => {
  it("calls canvasService.layoutEntities and returns side-effect summary", async () => {
    const { layoutEntities } = await import("@/services/ai/canvas-service");

    const result = JSON.parse(handleLayoutEntities({ strategy: "column" }));

    expect(layoutEntities).toHaveBeenCalledWith("column");
    expect(result).toEqual({
      created: [],
      updated: [],
      staleMarked: [],
      grouped: [],
    });
  });
});

// ── focus_entity ──

describe("handleFocusEntity", () => {
  it("calls canvasService.emitFocusEvent and returns focused id", async () => {
    const { emitFocusEvent } = await import("@/services/ai/canvas-service");

    const result = JSON.parse(handleFocusEntity({ entityId: "entity-abc" }));

    expect(emitFocusEvent).toHaveBeenCalledWith("entity-abc");
    expect(result.focused).toBe("entity-abc");
  });
});

// ── group_entities ──

describe("handleGroupEntities", () => {
  it("calls canvasService.groupEntities and returns side-effect summary", async () => {
    const { groupEntities } = await import("@/services/ai/canvas-service");

    const result = JSON.parse(
      handleGroupEntities({
        entityIds: ["e1", "e2", "e3"],
        label: "Key Players",
      }),
    );

    expect(groupEntities).toHaveBeenCalledWith(
      ["e1", "e2", "e3"],
      "Key Players",
    );
    expect(result).toEqual({
      created: [],
      updated: [],
      staleMarked: [],
      grouped: ["e1", "e2", "e3"],
    });
  });
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

  it("reports newly stale downstream entities in staleMarked", () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    // e1 -> e2 via downstream relationship
    createRelationship({
      type: "depends-on",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const result = JSON.parse(
      handleUpdateEntity({
        id: e1.id,
        rationale: "updated with downstream",
      }),
    );

    expect(result.updated).toHaveLength(1);
    expect(result.staleMarked).toContain(e2.id);
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
