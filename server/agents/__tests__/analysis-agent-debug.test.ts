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
  runPhaseWithTools: (...args: unknown[]) => mockRunPhase(...args),
}));

vi.mock("../../services/analysis-prompt-provenance", () => ({
  buildPhasePromptBundle: vi.fn(() => ({
    system: "mock system",
    user: "mock user",
    promptProvenance: {
      promptPackId: "game-theory/default",
      promptPackVersion: "2026-03-25.1",
      promptPackMode: "analysis-runtime",
      promptPackSource: { kind: "bundled" },
      phase: "situational-grounding",
      variant: "initial",
      templateIdentity: "game-theory/default:situational-grounding:initial",
      templateHash: "mock-hash",
      effectivePromptHash: "mock-effective-hash",
      toolPolicy: { enabledAnalysisTools: [], webSearch: true },
      doneCondition: "test",
    },
    toolPolicy: { enabledAnalysisTools: [], webSearch: true },
  })),
  createRunPromptProvenance: vi.fn(() => ({
    analysisType: "game-theory",
    activePhases: [],
    promptPackId: "game-theory/default",
    promptPackVersion: "2026-03-25.1",
    promptPackMode: "analysis-runtime",
    templateSetIdentity: "game-theory/default",
  })),
}));

vi.mock("../../services/ai/claude-adapter", () => ({
  createToolBasedAnalysisMcpServer: vi.fn(async () => ({})),
}));

vi.mock("../../services/revision-diff", () => ({
  beginPhaseTransaction: vi.fn(),
  commitPhaseTransaction: vi.fn(() => ({
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    relationshipsDeleted: 0,
    currentPhaseEntityIds: [],
  })),
  rollbackPhaseTransaction: vi.fn(),
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
      entitiesCreated: 1,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      phaseCompleted: true,
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
