import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEval } from "../eval-runner";
import type { PhaseArtifact } from "../eval-types";
import type { MethodologyPhase } from "../../../shared/types/methodology";

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
    const { reports } = await runEval({
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
    const { reports } = await runEval({
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
    const { reports } = await runEval({
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
    const { reports } = await runEval({
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
    const { reports } = await runEval({
      fixtures: [fixture],
      trials: 1,
      fast: true,
      runPhaseImpl: mockRunPhase,
    });

    expect(reports[0].trials[0].transcript).toBe(
      "Analysis complete with 1 player entity.",
    );
  });

  it("saves phase artifacts with entities and relationships from each trial", async () => {
    const fixture = {
      name: "artifact-test",
      topic: "artifact test",
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
    const { artifacts } = await runEval({
      fixtures: [fixture],
      trials: 2,
      fast: true,
      runPhaseImpl: mockRunPhase,
    });

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].fixture).toBe("artifact-test");
    expect(artifacts[0].phase).toBe("situational-grounding");
    expect(artifacts[0].artifactVersion).toBe("1.0.0");
    expect(artifacts[0].trials).toHaveLength(2);
    expect(artifacts[0].trials[0].trial).toBe(1);
    expect(artifacts[0].trials[0].entities).toHaveLength(2);
    expect(artifacts[1].phase).toBe("player-identification");
  });

  it("resume artifacts provide prior context when no chain output exists", async () => {
    const phase1Entities = [
      {
        ref: "f1",
        type: "fact",
        data: { category: "rule", content: "Fact 1" },
      },
    ];
    const resumeArtifacts = new Map<
      string,
      Map<MethodologyPhase, PhaseArtifact>
    >([
      [
        "resume-test",
        new Map<MethodologyPhase, PhaseArtifact>([
          [
            "situational-grounding",
            {
              artifactVersion: "1.0.0",
              fixture: "resume-test",
              phase: "situational-grounding",
              effort: "medium",
              timestamp: "2026-01-01T00:00:00Z",
              model: "test",
              trials: [
                {
                  trial: 1,
                  success: true,
                  entities: phase1Entities,
                  relationships: [],
                },
              ],
            },
          ],
        ]),
      ],
    ]);

    const fixture = {
      name: "resume-test",
      topic: "resume test",
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
      phases: ["player-identification"],
      trials: 1,
      fast: true,
      resumeArtifacts,
      runPhaseImpl: mockRunPhase,
    });

    const call = mockRunPhase.mock.calls[0];
    expect(call[2]?.phaseBrief).toBe(JSON.stringify(phase1Entities));
  });

  it("chain output takes precedence over resume artifacts", async () => {
    const staleEntities = [
      {
        ref: "stale",
        type: "fact",
        data: { category: "rule", content: "Stale" },
      },
    ];
    const resumeArtifacts = new Map<
      string,
      Map<MethodologyPhase, PhaseArtifact>
    >([
      [
        "precedence-test",
        new Map<MethodologyPhase, PhaseArtifact>([
          [
            "situational-grounding",
            {
              artifactVersion: "1.0.0",
              fixture: "precedence-test",
              phase: "situational-grounding",
              effort: "medium",
              timestamp: "2026-01-01T00:00:00Z",
              model: "test",
              trials: [
                {
                  trial: 1,
                  success: true,
                  entities: staleEntities,
                  relationships: [],
                },
              ],
            },
          ],
        ]),
      ],
    ]);

    const fixture = {
      name: "precedence-test",
      topic: "precedence test",
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
      resumeArtifacts,
      runPhaseImpl: mockRunPhase,
    });

    // Phase 2 call should get live chain output (from mockRunPhase), not stale artifact
    const phase2Call = mockRunPhase.mock.calls[1];
    const phaseBrief = phase2Call[2]?.phaseBrief;
    expect(phaseBrief).toBeDefined();
    // Live output has "Player 1" / "Player 2", stale has "Stale"
    expect(phaseBrief).not.toContain("Stale");
    expect(phaseBrief).toContain("Player 1");
  });

  it("per-trial chaining propagates each trial independently", async () => {
    let callCount = 0;
    const perTrialMock = vi.fn().mockImplementation(() => {
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
      name: "per-trial-test",
      topic: "per trial",
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
      trials: 3,
      chain: true,
      chainPerTrial: true,
      fast: true,
      runPhaseImpl: perTrialMock,
    });

    // Phase 1: calls 0,1,2 produce entities e-1, e-2, e-3
    // Phase 2: call 3 should get e-1, call 4 should get e-2, call 5 should get e-3
    const phase2Calls = perTrialMock.mock.calls.slice(3, 6);
    expect(phase2Calls[0][2]?.phaseBrief).toContain("e-1");
    expect(phase2Calls[1][2]?.phaseBrief).toContain("e-2");
    expect(phase2Calls[2][2]?.phaseBrief).toContain("e-3");
  });

  it("per-trial chain errors on trial count mismatch with resume artifact", async () => {
    const resumeArtifacts = new Map<
      string,
      Map<MethodologyPhase, PhaseArtifact>
    >([
      [
        "mismatch-test",
        new Map<MethodologyPhase, PhaseArtifact>([
          [
            "situational-grounding",
            {
              artifactVersion: "1.0.0",
              fixture: "mismatch-test",
              phase: "situational-grounding",
              effort: "medium",
              timestamp: "2026-01-01T00:00:00Z",
              model: "test",
              trials: [
                {
                  trial: 1,
                  success: true,
                  entities: [{ ref: "e1" }],
                  relationships: [],
                },
                {
                  trial: 2,
                  success: true,
                  entities: [{ ref: "e2" }],
                  relationships: [],
                },
                {
                  trial: 3,
                  success: true,
                  entities: [{ ref: "e3" }],
                  relationships: [],
                },
              ],
            },
          ],
        ]),
      ],
    ]);

    const fixture = {
      name: "mismatch-test",
      topic: "mismatch",
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

    await expect(
      runEval({
        fixtures: [fixture],
        phases: ["player-identification"],
        trials: 5,
        chainPerTrial: true,
        fast: true,
        resumeArtifacts,
        runPhaseImpl: mockRunPhase,
      }),
    ).rejects.toThrow(/matching trial counts/);
  });
});
