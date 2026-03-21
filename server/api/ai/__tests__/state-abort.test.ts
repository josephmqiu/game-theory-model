import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis } from "../../../../shared/types/entity";

const getAnalysisMock = vi.fn();
const getActiveStatusMock = vi.fn();
const isRunningMock = vi.fn();
const abortMock = vi.fn();

vi.mock("../../../services/entity-graph-service", () => ({
  getAnalysis: () => getAnalysisMock(),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  getActiveStatus: () => getActiveStatusMock(),
  isRunning: () => isRunningMock(),
  abort: () => abortMock(),
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
  });

  it("returns idle run status from the current analysis when no run is active", async () => {
    getActiveStatusMock.mockReturnValue(null);

    const route = (await import("../state")).default;
    const result = route({} as never);

    expect(result.analysis.topic).toBe("Trade conflict");
    expect(result.runStatus).toEqual({
      status: "idle",
      runId: null,
      activePhase: null,
      progress: {
        completed: 1,
        total: 9,
      },
    });
  });

  it("returns active run status while analysis is running", async () => {
    getActiveStatusMock.mockReturnValue({
      runId: "run-123",
      status: "running",
      activePhase: "player-identification",
      phasesCompleted: 1,
      totalPhases: 9,
    });

    const route = (await import("../state")).default;
    const result = route({} as never);

    expect(result.runStatus).toEqual({
      status: "running",
      runId: "run-123",
      activePhase: "player-identification",
      progress: {
        completed: 1,
        total: 9,
      },
    });
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
