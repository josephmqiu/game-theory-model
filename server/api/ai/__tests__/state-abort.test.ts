import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis } from "../../../../shared/types/entity";

const getAnalysisMock = vi.fn();
const getSnapshotMock = vi.fn();
const getRevisionMock = vi.fn();
const isRunningMock = vi.fn();
const abortMock = vi.fn();

vi.mock("../../../services/entity-graph-service", () => ({
  getAnalysis: () => getAnalysisMock(),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  isRunning: () => isRunningMock(),
  abort: () => abortMock(),
}));

vi.mock("../../../services/runtime-status", () => ({
  getSnapshot: () => getSnapshotMock(),
  getRevision: () => getRevisionMock(),
}));

function createAnalysis(): Analysis {
  return {
    id: "analysis-1",
    name: "Trade conflict",
    topic: "Trade conflict",
    entities: [],
    relationships: [],
    phases: [
      {
        phase: "situational-grounding",
        status: "complete",
        entityIds: [],
      },
      {
        phase: "player-identification",
        status: "running",
        entityIds: [],
      },
      {
        phase: "baseline-model",
        status: "pending",
        entityIds: [],
      },
      {
        phase: "historical-game",
        status: "pending",
        entityIds: [],
      },
      {
        phase: "assumptions",
        status: "pending",
        entityIds: [],
      },
    ],
  };
}

describe("/api/ai/state and /api/ai/abort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnalysisMock.mockReturnValue(createAnalysis());
    getRevisionMock.mockReturnValue(0);
  });

  it("returns runtime-status snapshot and revision from the server-owned state", async () => {
    getSnapshotMock.mockReturnValue({
      status: "running",
      kind: "revalidation",
      runId: "reval-123",
      activePhase: "player-identification",
      progress: {
        completed: 1,
        total: 3,
      },
      deferredRevalidationPending: true,
    });
    getRevisionMock.mockReturnValue(17);

    const route = (await import("../state")).default;
    const result = await route({} as never);

    expect(result.analysis.topic).toBe("Trade conflict");
    expect(result.runStatus).toEqual({
      status: "running",
      kind: "revalidation",
      runId: "reval-123",
      activePhase: "player-identification",
      progress: {
        completed: 1,
        total: 3,
      },
      deferredRevalidationPending: true,
    });
    expect(result.revision).toBe(17);
  });

  it("returns aborted true when a run is active", async () => {
    isRunningMock.mockReturnValue(true);

    const route = (await import("../abort")).default;
    const result = route({} as never);

    expect(result).toEqual({ aborted: true });
    expect(abortMock).toHaveBeenCalledTimes(1);
  });

  it("returns aborted false when no run is active", async () => {
    isRunningMock.mockReturnValue(false);

    const route = (await import("../abort")).default;
    const result = route({} as never);

    expect(result).toEqual({ aborted: false });
    expect(abortMock).not.toHaveBeenCalled();
  });
});
