import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetWorkspaceDatabaseForTest } from "../../services/workspace";

let mockTriggers: Array<{
  trigger_type: string;
  justification: string;
  timestamp: number;
}> = [];

vi.mock("../../services/analysis-tools", () => ({
  getRecordedLoopbackTriggers: () => [...mockTriggers],
  clearRecordedLoopbackTriggers: () => {
    mockTriggers = [];
  },
  LOOPBACK_TRIGGER_TYPES: [
    "new_player",
    "objective_changed",
    "new_game",
    "game_reframed",
    "repeated_dominates",
    "new_cross_game_link",
    "escalation_revision",
    "institutional_change",
    "assumption_invalidated",
    "model_unexplained_fact",
    "behavioral_overlay_change",
    "meta_check_blind_spot",
  ],
}));

const mockRunPhase = vi.fn();

vi.mock("../../services/analysis-service", () => ({
  runPhase: (...args: unknown[]) => mockRunPhase(...args),
}));

vi.mock("../../services/revision-diff", () => ({
  commitPhaseSnapshot: vi.fn(() => ({
    status: "applied",
    summary: {
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      currentPhaseEntityIds: [],
    },
  })),
}));

const mockEntityGraph = vi.hoisted(() => ({
  getAnalysis: vi.fn(() => ({
    id: "test",
    name: "test",
    topic: "test",
    entities: [],
    relationships: [],
    phases: [],
  })),
  newAnalysis: vi.fn(),
  setPhaseStatus: vi.fn(),
  removePhaseEntities: vi.fn(),
}));

vi.mock("../../services/entity-graph-service", () => mockEntityGraph);

const mockRevalidation = vi.hoisted(() => ({
  onRunComplete: vi.fn(),
  wire: vi.fn(),
}));

vi.mock("../../services/revalidation-service", () => mockRevalidation);

describe("analysis-agent debug runFull", () => {
  let orchestrator: Awaited<ReturnType<typeof importOrchestrator>>;

  async function importOrchestrator() {
    return import("../analysis-agent");
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTriggers = [];
    resetWorkspaceDatabaseForTest();
    orchestrator = await importOrchestrator();
    orchestrator._resetForTest();
  });

  it("runFull starts without hanging", async () => {
    console.log("TEST: Setting up mock");
    mockRunPhase.mockResolvedValue({
      success: true,
      entities: [
        {
          id: null,
          ref: "fact-1",
          type: "fact",
          phase: "situational-grounding",
          data: {
            type: "fact",
            date: "2025-06-15",
            source: "Reuters",
            content: "Fact 1",
            category: "action",
          },
          confidence: "high",
          rationale: "Test",
        },
      ],
      relationships: [],
    });

    console.log("TEST: Calling runFull...");
    const { runId } = await orchestrator.runFull("Test topic");
    console.log("TEST: runFull returned, runId:", runId);

    // Wait for phases
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("TEST: After flush");

    const status = orchestrator.getStatus(runId);
    console.log(
      "TEST: Status:",
      status.status,
      "phases:",
      status.phasesCompleted,
    );
    expect(runId).toBeDefined();
  }, 10000);
});
