import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  newAnalysis,
  createEntity,
  createRelationship,
  getAnalysis,
  _resetForTest,
} from "../services/entity-graph-service";
import { _resetForTest as resetCommandBus } from "../services/command-bus";
import {
  handleStartAnalysis,
  handleGetAnalysisStatus,
  handleGetEntity,
  handleQueryEntities,
  handleQueryRelationships,
  handleRequestLoopback,
  handleCreateEntity,
  handleUpdateEntity,
  handleDeleteEntity,
  handleCreateRelationship,
  handleDeleteRelationship,
  handleRerunPhases,
  handleAbortAnalysis,
} from "@/mcp/server";
import {
  _resetLoopbackTriggersForTest,
  getRecordedLoopbackTriggers,
} from "../services/analysis-tools";

vi.mock("../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

vi.mock("../agents/analysis-agent", () => ({
  runFull: vi.fn().mockResolvedValue({ runId: "run-mock-123" }),
  getActiveStatus: vi.fn().mockReturnValue(null),
  abort: vi.fn(),
}));

vi.mock("../services/revalidation-service", () => ({
  revalidate: vi.fn().mockReturnValue({ runId: "reval-mock-456" }),
  getRevalStatus: vi.fn().mockImplementation((runId: string) => {
    if (runId === "reval-mock-456") {
      return { runId, status: "running", phasesCompleted: 0 };
    }
    return null;
  }),
  getActiveRevalStatus: vi.fn().mockReturnValue(null),
}));

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
    confidence: "high" as const,
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
    confidence: "high" as const,
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

beforeEach(async () => {
  _resetForTest();
  resetCommandBus();
  _resetLoopbackTriggersForTest();
  newAnalysis("US-China trade war");
  vi.clearAllMocks();
  const { getActiveStatus } = await import("../agents/analysis-agent");
  const { getActiveRevalStatus } = await import("../services/revalidation-service");
  vi.mocked(getActiveStatus).mockReturnValue(null);
  vi.mocked(getActiveRevalStatus).mockReturnValue(null);
});

describe("handleStartAnalysis", () => {
  it("calls orchestrator.runFull and returns a started payload", async () => {
    const { runFull } = await import("../agents/analysis-agent");

    const result = JSON.parse(
      await handleStartAnalysis({ topic: "US-China semiconductor trade war" }),
    );

    expect(runFull).toHaveBeenCalledWith(
      "US-China semiconductor trade war",
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result).toEqual({
      runId: "run-mock-123",
      status: "started",
      estimatedPhases: 3,
    });
  });

  it("forwards explicit provider and model args without reading renderer stores", async () => {
    const { runFull } = await import("../agents/analysis-agent");

    await handleStartAnalysis({
      topic: "US-China semiconductor trade war",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });

    expect(runFull).toHaveBeenCalledWith(
      "US-China semiconductor trade war",
      "anthropic",
      "claude-sonnet-4-20250514",
      undefined,
      undefined,
    );
  });
});

describe("handleGetAnalysisStatus", () => {
  it("returns the active analysis status when analysis is running", async () => {
    const { getActiveStatus } = await import("../agents/analysis-agent");
    vi.mocked(getActiveStatus).mockReturnValue({
      runId: "run-active",
      status: "running",
      activePhase: "situational-grounding",
      phasesCompleted: 1,
      totalPhases: 3,
    });

    const result = JSON.parse(handleGetAnalysisStatus());
    expect(result).toEqual({
      runId: "run-active",
      status: "running",
      activePhase: "situational-grounding",
      phasesCompleted: 1,
      totalPhases: 3,
    });
  });

  it("falls back to active revalidation status when no analysis run is active", async () => {
    const { getActiveStatus } = await import("../agents/analysis-agent");
    const { getActiveRevalStatus } = await import("../services/revalidation-service");
    vi.mocked(getActiveStatus).mockReturnValue(null);
    vi.mocked(getActiveRevalStatus).mockReturnValue({
      runId: "reval-active",
      status: "running",
      phasesCompleted: 0,
    });

    const result = JSON.parse(handleGetAnalysisStatus());
    expect(result).toEqual({
      runId: "reval-active",
      status: "running",
      phasesCompleted: 0,
    });
  });

  it("returns idle when nothing is currently running", async () => {
    const { getActiveStatus } = await import("../agents/analysis-agent");
    const { getActiveRevalStatus } = await import("../services/revalidation-service");
    vi.mocked(getActiveStatus).mockReturnValue(null);
    vi.mocked(getActiveRevalStatus).mockReturnValue(null);
    expect(JSON.parse(handleGetAnalysisStatus())).toEqual({ status: "idle" });
  });
});

describe("analysis-mode tools", () => {
  it("reads entities and relationships", () => {
    const entity = createEntity(makeFactData(), defaultProvenance);
    const other = createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });
    createRelationship({
      type: "supports",
      fromEntityId: entity.id,
      toEntityId: other.id,
    });

    expect(JSON.parse(handleGetEntity({ id: entity.id })).id).toBe(entity.id);
    expect(
      JSON.parse(
        handleQueryEntities({
          phase: "situational-grounding",
          type: "fact",
          stale: false,
        }),
      ),
    ).toHaveLength(1);
    expect(
      JSON.parse(handleQueryRelationships({ entityId: entity.id })),
    ).toHaveLength(1);
  });

  it("records valid loopback triggers", () => {
    const result = JSON.parse(
      handleRequestLoopback({
        trigger_type: "new_player",
        justification: "A new actor materially changed the game",
      }),
    );

    expect(result).toEqual({ accepted: true, queued: true });
    expect(getRecordedLoopbackTriggers()).toEqual([
      expect.objectContaining({
        trigger_type: "new_player",
        justification: "A new actor materially changed the game",
      }),
    ]);
  });

  it("rejects invalid loopback trigger types", () => {
    expect(() =>
      handleRequestLoopback({
        trigger_type: "totally_invalid",
        justification: "Bad trigger",
      }),
    ).toThrow(/Unsupported trigger_type/);
  });
});

describe("entity CRUD tools", () => {
  it("creates entities with server-owned provenance", async () => {
    const { getActiveStatus } = await import("../agents/analysis-agent");
    vi.mocked(getActiveStatus).mockReturnValue({
      runId: "run-active",
      status: "running",
      activePhase: "situational-grounding",
      phasesCompleted: 0,
      totalPhases: 3,
    });

    const result = JSON.parse(
      await handleCreateEntity({
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

    expect(result.created).toHaveLength(1);
    expect(result.created[0].provenance.source).toBe("ai-edited");
    expect(result.created[0].provenance.runId).toBe("run-active");
  });

  it("updates entities using the nested updates payload", async () => {
    const entity = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(
      await handleUpdateEntity({
        id: entity.id,
        updates: { rationale: "updated rationale" },
      }),
    );

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].rationale).toBe("updated rationale");
    expect(result.updated[0].provenance.source).toBe("ai-edited");
  });

  it("deletes entities by id", async () => {
    const entity = createEntity(makeFactData(), defaultProvenance);

    const result = JSON.parse(await handleDeleteEntity({ id: entity.id }));

    expect(result).toEqual(
      expect.objectContaining({ deleted: true, id: entity.id }),
    );
    expect(getAnalysis().entities).toHaveLength(0);
  });
});

describe("relationship CRUD tools", () => {
  it("creates relationships with contract-aligned input names", async () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const result = JSON.parse(
      await handleCreateRelationship({
        type: "supports",
        fromId: e1.id,
        toId: e2.id,
        metadata: { strength: "strong" },
      }),
    );

    expect(result.type).toBe("supports");
    expect(result.fromEntityId).toBe(e1.id);
    expect(result.toEntityId).toBe(e2.id);
    expect(result.metadata).toEqual({ strength: "strong" });
  });

  it("deletes relationships by id", async () => {
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const relationship = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const result = JSON.parse(
      await handleDeleteRelationship({ id: relationship.id }),
    );

    expect(result).toEqual(
      expect.objectContaining({ deleted: true, id: relationship.id }),
    );
    expect(getAnalysis().relationships).toHaveLength(0);
  });
});

describe("analysis control tools", () => {
  it("reruns from the earliest specified phase", async () => {
    const { revalidate } = await import("../services/revalidation-service");

    const result = JSON.parse(
      handleRerunPhases({
        phases: ["baseline-model", "situational-grounding"],
      }),
    );

    expect(revalidate).toHaveBeenCalledWith(undefined, "situational-grounding");
    expect(result).toEqual({
      runId: "reval-mock-456",
      status: "running",
      startPhase: "situational-grounding",
    });
  });

  it("rejects unsupported rerun phase values", () => {
    expect(
      JSON.parse(handleRerunPhases({ phases: ["totally-invalid"] })),
    ).toEqual({
      error: "Unsupported phases: totally-invalid",
    });
  });

  it("aborts the active analysis run", async () => {
    const { getActiveStatus, abort } = await import("../agents/analysis-agent");
    vi.mocked(getActiveStatus).mockReturnValue({
      runId: "run-active",
      status: "running",
      activePhase: "baseline-model",
      phasesCompleted: 2,
      totalPhases: 3,
    });

    const result = JSON.parse(await handleAbortAnalysis());

    expect(abort).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ aborted: true, runId: "run-active" });
  });

  it("returns idle when abort_analysis is called with no active run", async () => {
    const { getActiveStatus } = await import("../agents/analysis-agent");
    vi.mocked(getActiveStatus).mockReturnValue(null);
    expect(JSON.parse(await handleAbortAnalysis())).toEqual({
      aborted: false,
      status: "idle",
    });
  });
});
