import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEval } from "../eval-runner";

const mockRunPhase = vi.fn().mockResolvedValue({
  success: true,
  entities: [
    { ref: "p1", type: "player", data: { name: "Player 1" } },
    { ref: "p2", type: "player", data: { name: "Player 2" } },
  ],
  relationships: [],
});

describe("runEval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPhase.mockResolvedValue({
      success: true,
      entities: [
        { ref: "p1", type: "player", data: { name: "Player 1" } },
        { ref: "p2", type: "player", data: { name: "Player 2" } },
      ],
      relationships: [],
    });
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
    const reports = await runEval({
      fixtures: [fixture],
      trials: 1,
      fast: true,
      runPhaseImpl: mockRunPhase,
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].fixture).toBe("test");
    expect(reports[0].phase).toBe("player-identification");
    expect(reports[0].trials).toHaveLength(1);
    expect(reports[0].trials[0].success).toBe(true);
  });

  it("in chain mode, passes phase output as prior context to next phase", async () => {
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
    await runEval({
      fixtures: [fixture],
      trials: 1,
      chain: true,
      fast: true,
      runPhaseImpl: mockRunPhase,
    });
    const secondCall = mockRunPhase.mock.calls[1];
    expect(secondCall[2]?.phaseBrief).toBeDefined();
  });

  it("isolates entity graph state between trials", async () => {
    // Track the topic passed to each runPhase call to verify isolation
    // happens (newAnalysis is called with fixture.topic before each trial)
    let callCount = 0;
    const mockPhase = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        success: true,
        entities: [
          {
            ref: `e-${callCount}`,
            type: "fact",
            data: { category: "rule", content: `Entity ${callCount}` },
          },
        ],
        relationships: [],
      });
    });

    const fixture = {
      name: "isolation-test",
      topic: "isolation test",
      complexityTier: "trivial" as const,
      phases: {
        "situational-grounding": {
          entityCountRange: [1, 3] as [number, number],
        },
      },
    };
    const reports = await runEval({
      fixtures: [fixture],
      trials: 3,
      fast: true,
      runPhaseImpl: mockPhase,
    });

    // Each trial should see exactly 1 entity (not accumulated from prior trials)
    for (const trial of reports[0].trials) {
      expect(trial.entityCount).toBe(1);
    }
  });

  it("computes aggregate metrics (passAtK, SEM, CI95)", async () => {
    // Two trials: one passes entity-count [2,6], one fails (8 entities)
    let callIndex = 0;
    const mockPhase = vi.fn().mockImplementation(() => {
      callIndex++;
      const entityCount = callIndex === 1 ? 2 : 8;
      return Promise.resolve({
        success: true,
        entities: Array.from({ length: entityCount }, (_, i) => ({
          id: null,
          ref: `p-${i}`,
          type: "player",
          phase: "player-identification",
          confidence: "high",
          rationale: "test",
          data: {
            type: "player",
            name: `Player ${i}`,
            playerType: "primary",
          },
        })),
        relationships: [],
      });
    });

    const fixture = {
      name: "metrics-test",
      topic: "metrics test",
      complexityTier: "trivial" as const,
      phases: {
        "player-identification": {
          entityCountRange: [2, 6] as [number, number],
        },
      },
    };
    const reports = await runEval({
      fixtures: [fixture],
      trials: 2,
      fast: true,
      runPhaseImpl: mockPhase,
    });

    const report = reports[0];
    expect(report.passRate).toBe(0.5);
    expect(report.passAtK).toBeDefined();
    expect(report.passHatK).toBeDefined();
    expect(report.sem).toBeDefined();
    expect(report.ci95).toBeDefined();
    expect(report.ci95![0]).toBeLessThanOrEqual(report.passRate);
    expect(report.ci95![1]).toBeGreaterThanOrEqual(report.passRate);
    expect(report.meanLatencyMs).toBeDefined();
    expect(report.medianLatencyMs).toBeDefined();
  });

  it("error in one trial does not corrupt next trial", async () => {
    let callCount = 0;
    const mockPhase = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({
          success: false,
          entities: [],
          relationships: [],
          error: "Simulated failure",
        });
      }
      return Promise.resolve({
        success: true,
        entities: [
          { ref: `e-${callCount}`, type: "fact", data: { category: "rule" } },
        ],
        relationships: [],
      });
    });

    const fixture = {
      name: "error-recovery",
      topic: "error test",
      complexityTier: "trivial" as const,
      phases: {
        "situational-grounding": {
          entityCountRange: [1, 3] as [number, number],
        },
      },
    };
    const reports = await runEval({
      fixtures: [fixture],
      trials: 3,
      fast: true,
      runPhaseImpl: mockPhase,
    });

    const trials = reports[0].trials;
    expect(trials[0].success).toBe(true);
    expect(trials[0].entityCount).toBe(1);
    expect(trials[1].success).toBe(false);
    expect(trials[2].success).toBe(true);
    expect(trials[2].entityCount).toBe(1); // Not accumulated from prior trials
  });

  it("captures transcript from assistantResponse", async () => {
    mockRunPhase.mockResolvedValue({
      success: true,
      entities: [{ ref: "p1", type: "player", data: { name: "Player 1" } }],
      relationships: [],
      assistantResponse: "Analysis complete with 1 player entity.",
    });

    const fixture = {
      name: "transcript-test",
      topic: "transcript test",
      complexityTier: "trivial" as const,
      phases: {
        "player-identification": {
          entityCountRange: [1, 6] as [number, number],
        },
      },
    };
    const reports = await runEval({
      fixtures: [fixture],
      trials: 1,
      fast: true,
      runPhaseImpl: mockRunPhase,
    });

    expect(reports[0].trials[0].transcript).toBe(
      "Analysis complete with 1 player entity.",
    );
  });
});
