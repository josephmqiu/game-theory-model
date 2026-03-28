import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../../shared/types/entity";
import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type { MethodologyPhase } from "../../../shared/types/methodology";

// ── Mock entity-graph-service ──

let mockEntities: AnalysisEntity[] = [];
let mockRelationships: AnalysisRelationship[] = [];
let entityIdCounter = 0;
let relationshipIdCounter = 0;

const mockCreateEntity = vi.fn(
  (partial: Record<string, unknown>, provenance: Record<string, unknown>) => {
    const id = `entity-${++entityIdCounter}`;
    const entity = {
      id,
      ...partial,
      provenance,
      revision: 1,
      stale: false,
      source: "ai",
    } as unknown as AnalysisEntity;
    mockEntities.push(entity);
    return entity;
  },
);

const mockUpdateEntity = vi.fn(
  (id: string, updates: Record<string, unknown>) => {
    const entity = mockEntities.find((e) => e.id === id);
    if (!entity) return null;
    Object.assign(entity, updates);
    return entity;
  },
);

const mockRemoveEntity = vi.fn((id: string) => {
  mockEntities = mockEntities.filter((e) => e.id !== id);
});

const mockCreateRelationship = vi.fn(
  (partial: Record<string, unknown>, provenance: Record<string, unknown>) => {
    const id = `rel-${++relationshipIdCounter}`;
    const rel = {
      id,
      ...partial,
      provenance,
    } as unknown as AnalysisRelationship;
    mockRelationships.push(rel);
    return rel;
  },
);

const mockRemoveRelationship = vi.fn((id: string) => {
  mockRelationships = mockRelationships.filter((r) => r.id !== id);
});

const mockGetEntitiesByPhase = vi.fn((phase: string) =>
  mockEntities.filter((e) => e.phase === phase),
);

vi.mock("../entity-graph-service", () => ({
  getAnalysis: () => ({
    id: "test",
    name: "test",
    topic: "test topic",
    entities: mockEntities,
    relationships: mockRelationships,
    phases: [],
  }),
  getRelationships: vi.fn(() => mockRelationships),
  createEntity: (...args: unknown[]) =>
    mockCreateEntity(
      ...(args as [Record<string, unknown>, Record<string, unknown>]),
    ),
  updateEntity: (...args: unknown[]) =>
    mockUpdateEntity(...(args as [string, Record<string, unknown>])),
  removeEntity: (...args: unknown[]) => mockRemoveEntity(...(args as [string])),
  createRelationship: (...args: unknown[]) =>
    mockCreateRelationship(
      ...(args as [Record<string, unknown>, Record<string, unknown>]),
    ),
  removeRelationship: (...args: unknown[]) =>
    mockRemoveRelationship(...(args as [string])),
  getEntitiesByPhase: (...args: unknown[]) =>
    mockGetEntitiesByPhase(...(args as [string])),
  onMutation: vi.fn(() => vi.fn()),
}));

import {
  analysisCreateEntity,
  analysisUpdateEntity,
  analysisDeleteEntity,
  analysisCreateRelationship,
  analysisDeleteRelationship,
  analysisCompletePhase,
  type AnalysisWriteContext,
} from "../analysis-tools";

// ── Helpers ──

function makeWriteContext(
  phase: MethodologyPhase = "situational-grounding",
  allowedEntityTypes: string[] = ["fact"],
  overrides: Partial<AnalysisWriteContext> = {},
): AnalysisWriteContext {
  return {
    workspaceId: "ws-1",
    threadId: "thread-1",
    runId: "run-1",
    phaseTurnId: "turn-1",
    phase,
    allowedEntityTypes,
    counters: {
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      phaseCompleted: false,
    },
    ...overrides,
  };
}

function makeTestEntity(
  id: string,
  phase: MethodologyPhase,
  type: string = "fact",
  provenance: { source: string } = { source: "phase-derived" },
): AnalysisEntity {
  return {
    id,
    type: type as AnalysisEntity["type"],
    phase,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: `Entity ${id}`,
      category: "action" as const,
    },
    confidence: "high",
    source: "ai",
    rationale: "test",
    revision: 1,
    stale: false,
    provenance: {
      source: provenance.source as "phase-derived" | "user-edited",
      runId: "run-1",
      phase,
      timestamp: Date.now(),
    },
  } as AnalysisEntity;
}

beforeEach(() => {
  mockEntities = [];
  mockRelationships = [];
  entityIdCounter = 0;
  relationshipIdCounter = 0;
  vi.clearAllMocks();
});

// ── analysisCreateEntity ──

describe("analysisCreateEntity", () => {
  it("creates a valid fact entity", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateEntity(
      {
        ref: "fact-1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "Reuters",
          content: "Test fact content",
          category: "action",
        },
        confidence: "high",
        rationale: "Test rationale",
      },
      ctx,
    );

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("ref", "fact-1");
    expect(result).toHaveProperty("type", "fact");
    expect(ctx.counters!.entitiesCreated).toBe(1);
  });

  it("rejects entity type not allowed in phase", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateEntity(
      {
        ref: "player-1",
        type: "player",
        phase: "situational-grounding",
        data: {
          type: "player",
          name: "Test",
          playerType: "primary",
          knowledge: [],
        },
      },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain(
      "not allowed in phase",
    );
    expect(ctx.counters!.entitiesCreated).toBe(0);
  });

  it("rejects invalid entity data (schema violation)", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateEntity(
      {
        ref: "fact-bad",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          // Missing required fields: date, source, content, category
        },
      },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("validation failed");
    expect(ctx.counters!.entitiesCreated).toBe(0);
  });

  it("creates a valid player entity in player-identification phase", () => {
    const ctx = makeWriteContext("player-identification", [
      "player",
      "objective",
    ]);
    const result = analysisCreateEntity(
      {
        ref: "player-us",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "United States",
          playerType: "primary",
          knowledge: ["Public information"],
        },
        confidence: "high",
        rationale: "Primary actor",
      },
      ctx,
    );

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("type", "player");
    expect(ctx.counters!.entitiesCreated).toBe(1);
  });

  it("emits entity_created_during_phase progress event", () => {
    const events: AnalysisProgressEvent[] = [];
    const ctx = makeWriteContext("situational-grounding", ["fact"], {
      onProgress: (e) => events.push(e),
    });

    analysisCreateEntity(
      {
        ref: "fact-1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "Test",
          content: "Test content",
          category: "action",
        },
        confidence: "high",
        rationale: "Test",
      },
      ctx,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "entity_created_during_phase",
      phase: "situational-grounding",
      entityType: "fact",
      entityRef: "fact-1",
    });
  });
});

// ── analysisUpdateEntity ──

describe("analysisUpdateEntity", () => {
  it("updates an existing entity in the correct phase", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact");
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisUpdateEntity(
      { id: "ent-1", updates: { rationale: "Updated rationale" } },
      ctx,
    );

    expect(result).toHaveProperty("updated", true);
    expect(ctx.counters!.entitiesUpdated).toBe(1);
  });

  it("rejects update for entity not found", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisUpdateEntity(
      { id: "nonexistent", updates: { rationale: "Updated" } },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not found");
  });

  it("rejects update for entity in wrong phase", () => {
    const entity = makeTestEntity("ent-1", "player-identification", "player");
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisUpdateEntity(
      { id: "ent-1", updates: { rationale: "Updated" } },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("belongs to phase");
  });

  it("rejects update for user-edited entity", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact", {
      source: "user-edited",
    });
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisUpdateEntity(
      { id: "ent-1", updates: { rationale: "Updated" } },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("user-edited");
  });

  it("emits entity_updated_during_phase progress event", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact");
    mockEntities.push(entity);

    const events: AnalysisProgressEvent[] = [];
    const ctx = makeWriteContext("situational-grounding", ["fact"], {
      onProgress: (e) => events.push(e),
    });

    analysisUpdateEntity(
      { id: "ent-1", updates: { rationale: "Updated" } },
      ctx,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "entity_updated_during_phase",
      phase: "situational-grounding",
      entityId: "ent-1",
    });
  });
  it("rejects update with invalid data that fails schema validation", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact");
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    // Set data to something that violates the fact schema (missing required fields)
    const result = analysisUpdateEntity(
      { id: "ent-1", updates: { data: { invalid: true } } },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("validation failed");
  });
});

// ── analysisDeleteEntity ──

describe("analysisDeleteEntity", () => {
  it("deletes an existing entity in the correct phase", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact");
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisDeleteEntity({ id: "ent-1" }, ctx);

    expect(result).toHaveProperty("deleted", true);
    expect(ctx.counters!.entitiesDeleted).toBe(1);
  });

  it("rejects delete for entity in wrong phase", () => {
    const entity = makeTestEntity("ent-1", "player-identification", "player");
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisDeleteEntity({ id: "ent-1" }, ctx);

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("belongs to phase");
  });

  it("rejects delete for user-edited entity", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact", {
      source: "user-edited",
    });
    mockEntities.push(entity);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisDeleteEntity({ id: "ent-1" }, ctx);

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("user-edited");
  });

  it("emits entity_deleted_during_phase progress event", () => {
    const entity = makeTestEntity("ent-1", "situational-grounding", "fact");
    mockEntities.push(entity);

    const events: AnalysisProgressEvent[] = [];
    const ctx = makeWriteContext("situational-grounding", ["fact"], {
      onProgress: (e) => events.push(e),
    });

    analysisDeleteEntity({ id: "ent-1" }, ctx);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "entity_deleted_during_phase",
      phase: "situational-grounding",
      entityId: "ent-1",
    });
  });
});

// ── analysisCompletePhase ──

describe("analysisCompletePhase", () => {
  it("completes a phase with valid entities", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    // No entities needed for grounding phase — invariants pass trivially
    const result = analysisCompletePhase({}, ctx);

    expect(result).toEqual({ success: true, phase: "situational-grounding" });
    expect(ctx.counters!.phaseCompleted).toBe(true);
  });

  it("emits phase_completion_requested event", () => {
    const events: AnalysisProgressEvent[] = [];
    const ctx = makeWriteContext("situational-grounding", ["fact"], {
      onProgress: (e) => events.push(e),
    });

    analysisCompletePhase({}, ctx);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "phase_completion_requested",
      phase: "situational-grounding",
    });
  });

  it("rejects unsupported phase", () => {
    const ctx = makeWriteContext("unknown-phase" as MethodologyPhase, []);
    const result = analysisCompletePhase({}, ctx);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("Unsupported phase"),
    });
  });
});

// ── validatePhaseInvariants (scenarios probability sum) ──

describe("validatePhaseInvariants — scenarios phase", () => {
  it("rejects scenario probabilities that sum below 95%", () => {
    // Create scenario entities with low probability sum
    mockEntities.push({
      id: "s1",
      type: "scenario",
      phase: "scenarios",
      data: {
        type: "scenario",
        subtype: "baseline",
        narrative: "Test",
        probability: { point: 30, rangeLow: 25, rangeHigh: 35 },
        key_assumptions: [],
        invalidation_conditions: "None",
        model_basis: [],
        cross_game_interactions: "",
        prediction_basis: "equilibrium",
        trigger: null,
        why_unlikely: null,
        consequences: null,
        drift_trajectory: null,
      },
      confidence: "high",
      source: "ai",
      rationale: "test",
      revision: 1,
      stale: false,
    } as unknown as AnalysisEntity);

    mockGetEntitiesByPhase.mockReturnValueOnce(mockEntities);

    const ctx = makeWriteContext("scenarios", ["scenario", "central-thesis"]);
    const result = analysisCompletePhase({}, ctx);

    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toContain(
      "probabilities sum to",
    );
  });

  it("rejects scenario probabilities that sum above 105%", () => {
    mockEntities.push(
      {
        id: "s1",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "baseline",
          narrative: "Test A",
          probability: { point: 70, rangeLow: 65, rangeHigh: 75 },
          key_assumptions: [],
          invalidation_conditions: "None",
          model_basis: [],
          cross_game_interactions: "",
          prediction_basis: "equilibrium",
          trigger: null,
          why_unlikely: null,
          consequences: null,
          drift_trajectory: null,
        },
        confidence: "high",
        source: "ai",
        rationale: "test",
        revision: 1,
        stale: false,
      } as unknown as AnalysisEntity,
      {
        id: "s2",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "tail-risk",
          narrative: "Test B",
          probability: { point: 50, rangeLow: 45, rangeHigh: 55 },
          key_assumptions: [],
          invalidation_conditions: "None",
          model_basis: [],
          cross_game_interactions: "",
          prediction_basis: "discretionary",
          trigger: "test trigger",
          why_unlikely: "test",
          consequences: "test",
          drift_trajectory: "test",
        },
        confidence: "medium",
        source: "ai",
        rationale: "test",
        revision: 1,
        stale: false,
      } as unknown as AnalysisEntity,
    );

    mockGetEntitiesByPhase.mockReturnValueOnce(mockEntities);

    const ctx = makeWriteContext("scenarios", ["scenario", "central-thesis"]);
    const result = analysisCompletePhase({}, ctx);

    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toContain(
      "probabilities sum to",
    );
  });

  it("accepts scenario probabilities that sum to ~100%", () => {
    mockEntities.push(
      {
        id: "s1",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "baseline",
          narrative: "Test A",
          probability: { point: 60, rangeLow: 55, rangeHigh: 65 },
          key_assumptions: [],
          invalidation_conditions: "None",
          model_basis: [],
          cross_game_interactions: "",
          prediction_basis: "equilibrium",
          trigger: null,
          why_unlikely: null,
          consequences: null,
          drift_trajectory: null,
        },
        confidence: "high",
        source: "ai",
        rationale: "test",
        revision: 1,
        stale: false,
      } as unknown as AnalysisEntity,
      {
        id: "s2",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "tail-risk",
          narrative: "Test B",
          probability: { point: 40, rangeLow: 35, rangeHigh: 45 },
          key_assumptions: [],
          invalidation_conditions: "None",
          model_basis: [],
          cross_game_interactions: "",
          prediction_basis: "discretionary",
          trigger: "test trigger",
          why_unlikely: "test",
          consequences: "test",
          drift_trajectory: "test",
        },
        confidence: "medium",
        source: "ai",
        rationale: "test",
        revision: 1,
        stale: false,
      } as unknown as AnalysisEntity,
    );

    mockGetEntitiesByPhase.mockReturnValueOnce(mockEntities);

    const ctx = makeWriteContext("scenarios", ["scenario", "central-thesis"]);
    const result = analysisCompletePhase({}, ctx);

    expect(result).toEqual({ success: true, phase: "scenarios" });
  });
});

// ── analysisCreateRelationship ──

describe("analysisCreateRelationship", () => {
  it("creates a relationship between existing entities", () => {
    mockEntities.push(
      makeTestEntity("ent-1", "situational-grounding", "fact"),
      makeTestEntity("ent-2", "situational-grounding", "fact"),
    );

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateRelationship(
      { type: "supports", fromEntityId: "ent-1", toEntityId: "ent-2" },
      ctx,
    );

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("type", "supports");
    expect(ctx.counters!.relationshipsCreated).toBe(1);
  });

  it("rejects relationship with missing source entity", () => {
    mockEntities.push(makeTestEntity("ent-2", "situational-grounding", "fact"));

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateRelationship(
      { type: "supports", fromEntityId: "nonexistent", toEntityId: "ent-2" },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not found");
  });

  it("rejects relationship with missing target entity", () => {
    mockEntities.push(makeTestEntity("ent-1", "situational-grounding", "fact"));

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateRelationship(
      { type: "supports", fromEntityId: "ent-1", toEntityId: "nonexistent" },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Target entity");
  });

  it("rejects invalid relationship type", () => {
    mockEntities.push(
      makeTestEntity("ent-1", "situational-grounding", "fact"),
      makeTestEntity("ent-2", "situational-grounding", "fact"),
    );

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisCreateRelationship(
      { type: "causes", fromEntityId: "ent-1", toEntityId: "ent-2" },
      ctx,
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain(
      "Invalid relationship type",
    );
  });
});

// ── analysisDeleteRelationship ──

describe("analysisDeleteRelationship", () => {
  it("deletes an existing relationship", () => {
    mockRelationships.push({
      id: "rel-1",
      type: "supports",
      fromEntityId: "ent-1",
      toEntityId: "ent-2",
    } as unknown as AnalysisRelationship);

    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisDeleteRelationship({ id: "rel-1" }, ctx);

    expect(result).toHaveProperty("deleted", true);
  });

  it("rejects deletion of nonexistent relationship", () => {
    const ctx = makeWriteContext("situational-grounding", ["fact"]);
    const result = analysisDeleteRelationship({ id: "nonexistent" }, ctx);

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not found");
  });
});
