import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEval } from "../eval-runner";

vi.mock("../../services/analysis-service", () => ({
  runPhase: vi.fn().mockResolvedValue({
    success: true,
    entities: [
      { ref: "p1", type: "player", data: { name: "Player 1" } },
      { ref: "p2", type: "player", data: { name: "Player 2" } },
    ],
    relationships: [],
  }),
}));

vi.mock("../model-graders", () => ({
  runModelGraders: vi.fn().mockResolvedValue([]),
}));

describe("runEval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs a single fixture/phase/trial and returns a report", async () => {
    const fixture = {
      name: "test",
      topic: "simple test",
      complexityTier: "trivial" as const,
      phases: {
        "player-identification": {
          entityCountRange: [2, 6] as [number, number],
        },
      },
    };
    const reports = await runEval({ fixtures: [fixture], trials: 1 });
    expect(reports).toHaveLength(1);
    expect(reports[0].fixture).toBe("test");
    expect(reports[0].phase).toBe("player-identification");
    expect(reports[0].trials).toHaveLength(1);
    expect(reports[0].trials[0].success).toBe(true);
  });

  it("in chain mode, passes phase output as prior context to next phase", async () => {
    const { runPhase } = await import("../../services/analysis-service");
    const mockRunPhase = vi.mocked(runPhase);

    const fixture = {
      name: "chain-test",
      topic: "test",
      complexityTier: "trivial" as const,
      phases: {
        "situational-grounding": {
          entityCountRange: [1, 10] as [number, number],
        },
        "player-identification": {
          entityCountRange: [1, 10] as [number, number],
        },
      },
    };
    await runEval({ fixtures: [fixture], trials: 1, chain: true });
    const secondCall = mockRunPhase.mock.calls[1];
    expect(secondCall[2]?.priorEntities).toBeDefined();
  });
});
