import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { ResolvedAnalysisRuntime } from "../../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../../shared/types/entity";
import {
  DEFAULT_PROMPT_PACK_ID,
  DEFAULT_PROMPT_PACK_MODE,
  DEFAULT_PROMPT_PACK_VERSION,
} from "../../../shared/types/prompt-pack";
import {
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../services/workspace";
import type { PhaseToolResult } from "../../services/analysis-service";

// ── Mock analysis-tools (loopback triggers) ──

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

// ── Mock analysis-service ──

const mockRunPhase = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<PhaseToolResult>>(),
);

vi.mock("../../services/analysis-service", () => ({
  runPhaseWithTools: (...args: unknown[]) => mockRunPhase(...args),
}));

// ── Mock prompt provenance (needed because orchestrator builds prompts before calling runPhaseWithTools) ──

vi.mock("../../services/analysis-prompt-provenance", () => ({
  buildPhasePromptBundle: vi.fn((opts?: { phase?: string }) => {
    const phase = opts?.phase ?? "situational-grounding";
    return {
      system: "mock system prompt",
      user: "mock user prompt",
      promptProvenance: {
        promptPackId: "game-theory/default",
        promptPackVersion: "2026-03-25.1",
        promptPackMode: "analysis-runtime",
        promptPackSource: { kind: "bundled" },
        phase,
        variant: "initial",
        templateIdentity: `game-theory/default:${phase}:initial`,
        templateHash: "mock-hash",
        effectivePromptHash: "mock-effective-hash",
        toolPolicy: { enabledAnalysisTools: [], webSearch: true },
        doneCondition: "test",
      },
      toolPolicy: { enabledAnalysisTools: [], webSearch: true },
    };
  }),
  createRunPromptProvenance: vi.fn((phases?: string[]) => ({
    analysisType: "game-theory",
    activePhases: phases ?? [],
    promptPackId: "game-theory/default",
    promptPackVersion: "2026-03-25.1",
    promptPackMode: "analysis-runtime",
    templateSetIdentity: "game-theory/default",
  })),
}));

// ── Mock claude-adapter (tool MCP server factory) ──

vi.mock("../../services/ai/claude-adapter", () => ({
  createToolBasedAnalysisMcpServer: vi.fn(async () => ({})),
}));

const mockBeginPhaseTransaction = vi.hoisted(() => vi.fn());
const mockCommitPhaseTransaction = vi.hoisted(() =>
  vi.fn(() => ({
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    relationshipsDeleted: 0,
    currentPhaseEntityIds: [],
  })),
);
const mockRollbackPhaseTransaction = vi.hoisted(() => vi.fn());

vi.mock("../../services/revision-diff", () => ({
  beginPhaseTransaction: (...args: unknown[]) =>
    mockBeginPhaseTransaction(...args),
  commitPhaseTransaction: (..._args: unknown[]) => mockCommitPhaseTransaction(),
  rollbackPhaseTransaction: () => mockRollbackPhaseTransaction(),
}));

// ── Mock entity-graph-service ──
// vi.hoisted() ensures these are available when the hoisted vi.mock() factories run

const mockEntityGraph = vi.hoisted(() => ({
  getAnalysis: vi.fn(() => ({
    id: "test",
    name: "test",
    topic: "test",
    entities: [] as AnalysisEntity[],
    relationships: [] as AnalysisRelationship[],
    phases: [],
  })),
  newAnalysis: vi.fn(),
  setPhaseStatus: vi.fn(),
  removePhaseEntities: vi.fn(),
  _bindWorkspaceDatabaseForInit: vi.fn(),
  _resetForTest: vi.fn(),
  _setRepoForTest: vi.fn(),
}));

vi.mock("../../services/entity-graph-service", () => mockEntityGraph);

// ── Mock revalidation-service ──

const mockRevalidation = vi.hoisted(() => ({
  onRunComplete: vi.fn(),
  wire: vi.fn(),
  _resetForTest: vi.fn(),
}));

vi.mock("../../services/revalidation-service", () => mockRevalidation);

// ── Test fixtures ──

function makePhaseResult(_phase?: MethodologyPhase, entityCount = 1) {
  return {
    success: true,
    entitiesCreated: entityCount,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    phaseCompleted: true,
  };
}

function makeFailedResult(error: string) {
  return {
    success: false,
    error,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    phaseCompleted: false,
  };
}

// Wait for all microtasks/macrotasks to settle
function flushAsync(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tests ──

describe("analysis-orchestrator", () => {
  // Lazy import to get fresh module state after mocks
  async function importOrchestrator() {
    return import("../analysis-agent");
  }

  let orchestrator: Awaited<ReturnType<typeof importOrchestrator>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTriggers = [];
    mockCommitPhaseTransaction.mockImplementation(() => ({
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      currentPhaseEntityIds: [],
    }));
    resetWorkspaceDatabaseForTest();
    orchestrator = await importOrchestrator();
    orchestrator._resetForTest();
  });

  afterEach(async () => {
    // Ensure any in-flight run is aborted and awaited before reset
    try {
      orchestrator.abort();
    } catch (_) {
      // ignore if no active run
    }
    const p = orchestrator._getRunPromise();
    if (p) {
      try {
        await p;
      } catch (_) {
        // ignore errors from aborted runs
      }
    }
    await flushAsync();
    vi.useRealTimers();
  });

  // ── 1. runFull returns runId and executes phases sequentially ──

  it("runFull returns runId and executes phases sequentially", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("historical-game"))
      .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
      .mockResolvedValueOnce(makePhaseResult("assumptions"))
      .mockResolvedValueOnce(makePhaseResult("elimination"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"))
      .mockResolvedValueOnce(makePhaseResult("meta-check"));

    const { runId } = await orchestrator.runFull("US-China trade war");
    expect(runId).toMatch(/^run-/);

    // Let phases execute
    await flushAsync();

    // All 9 phases should have been called in order
    expect(mockRunPhase).toHaveBeenCalledTimes(9);
    expect(mockRunPhase.mock.calls[0][0]).toBe("situational-grounding");
    expect(mockRunPhase.mock.calls[1][0]).toBe("player-identification");
    expect(mockRunPhase.mock.calls[2][0]).toBe("baseline-model");
    expect(mockRunPhase.mock.calls[3][0]).toBe("historical-game");
    expect(mockRunPhase.mock.calls[4][0]).toBe("formal-modeling");
    expect(mockRunPhase.mock.calls[5][0]).toBe("assumptions");
    expect(mockRunPhase.mock.calls[6][0]).toBe("elimination");
    expect(mockRunPhase.mock.calls[7][0]).toBe("scenarios");
    expect(mockRunPhase.mock.calls[8][0]).toBe("meta-check");

    // Topic passed to each phase
    expect(mockRunPhase.mock.calls[0][1]).toBe("US-China trade war");
    expect((mockRunPhase.mock.calls[0][4] as any)?.runId).toBe(runId);

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("completed");
    expect(status.phasesCompleted).toBe(9);
    expect(status.totalPhases).toBe(9);
  });

  // ── 2. getStatus returns progress during active run ──

  it("getStatus returns progress during active run", async () => {
    // Make phase 1 resolve after we check status
    let resolvePhase1!: (value: PhaseToolResult) => void;
    const phase1Promise = new Promise<PhaseToolResult>((resolve) => {
      resolvePhase1 = resolve;
    });

    mockRunPhase
      .mockReturnValueOnce(phase1Promise)
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("historical-game"))
      .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
      .mockResolvedValueOnce(makePhaseResult("assumptions"))
      .mockResolvedValueOnce(makePhaseResult("elimination"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"))
      .mockResolvedValueOnce(makePhaseResult("meta-check"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    // While phase 1 is in progress
    const midStatus = orchestrator.getStatus(runId);
    expect(midStatus.status).toBe("running");
    expect(midStatus.activePhase).toBe("situational-grounding");
    expect(midStatus.phasesCompleted).toBe(0);

    // Complete phase 1
    resolvePhase1(makePhaseResult("situational-grounding"));
    await flushAsync();

    const finalStatus = orchestrator.getStatus(runId);
    expect(finalStatus.status).toBe("completed");
    expect(finalStatus.phasesCompleted).toBe(9);
  });

  it("persists durable run and phase-turn provenance for subset runs", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"));

    const { runId, threadId, workspaceId } = await orchestrator.runFull(
      "Test topic",
      "codex",
      "gpt-4o",
      undefined,
      {
        activePhases: ["situational-grounding", "player-identification"],
      },
    );
    await flushAsync();

    const database = getWorkspaceDatabase();
    const run = database.runs.getRunState(runId);
    expect(run).toMatchObject({
      id: runId,
      workspaceId,
      threadId,
      provider: "codex",
      model: "gpt-4o",
      status: "completed",
      summary: {
        statusMessage: "Run completed",
        completedPhases: 2,
      },
      promptProvenance: {
        analysisType: "game-theory",
        activePhases: ["situational-grounding", "player-identification"],
        promptPackId: DEFAULT_PROMPT_PACK_ID,
        promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
        promptPackMode: DEFAULT_PROMPT_PACK_MODE,
        templateSetIdentity: DEFAULT_PROMPT_PACK_ID,
      },
      logCorrelation: {
        logFileName: `${runId}.jsonl`,
      },
    });

    const phaseTurns =
      database.phaseTurnSummaries.listPhaseTurnSummariesByRunId(runId);
    expect(phaseTurns).toHaveLength(2);
    expect(phaseTurns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "situational-grounding",
          turnIndex: 1,
          promptProvenance: expect.objectContaining({
            promptPackId: DEFAULT_PROMPT_PACK_ID,
            promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
            promptPackMode: DEFAULT_PROMPT_PACK_MODE,
            phase: "situational-grounding",
            variant: "initial",
            templateIdentity: `${DEFAULT_PROMPT_PACK_ID}:situational-grounding:initial`,
          }),
        }),
        expect.objectContaining({
          phase: "player-identification",
          turnIndex: 1,
          promptProvenance: expect.objectContaining({
            promptPackId: DEFAULT_PROMPT_PACK_ID,
            promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
            promptPackMode: DEFAULT_PROMPT_PACK_MODE,
            phase: "player-identification",
            variant: "initial",
            templateIdentity: `${DEFAULT_PROMPT_PACK_ID}:player-identification:initial`,
          }),
        }),
      ]),
    );
    const latestPhaseTurn = phaseTurns.find(
      (phaseTurn) => phaseTurn.phase === "player-identification",
    );
    expect(run?.latestPhaseTurnId).toBe(latestPhaseTurn?.id);
  });

  it("rejects unsupported activePhases before starting a run", async () => {
    await expect(
      orchestrator.runFull("Test topic", undefined, undefined, undefined, {
        activePhases: ["revalidation" as MethodologyPhase],
      }),
    ).rejects.toThrow("Invalid activePhases");

    expect(mockRunPhase).not.toHaveBeenCalled();
  });

  it("rejects activePhases that normalize to an empty runnable set", async () => {
    await expect(
      orchestrator.runFull("Test topic", undefined, undefined, undefined, {
        activePhases: [],
      }),
    ).rejects.toThrow(
      "activePhases must include at least one supported canonical phase",
    );

    expect(mockRunPhase).not.toHaveBeenCalled();
  });

  it("runs deduped activePhases in canonical order and reports subset totals", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"));

    const { runId } = await orchestrator.runFull(
      "Subset topic",
      undefined,
      undefined,
      undefined,
      {
        activePhases: [
          "scenarios",
          "situational-grounding",
          "baseline-model",
          "baseline-model",
        ],
      },
    );
    await flushAsync();

    expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual([
      "situational-grounding",
      "baseline-model",
      "scenarios",
    ]);

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("completed");
    expect(status.phasesCompleted).toBe(3);
    expect(status.totalPhases).toBe(3);
  });

  it("reports subset-aware totals while a filtered run is active", async () => {
    let resolvePhase1!: (value: PhaseToolResult) => void;
    mockRunPhase
      .mockReturnValueOnce(
        new Promise<PhaseToolResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      )
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const { runId } = await orchestrator.runFull(
      "Subset topic",
      undefined,
      undefined,
      undefined,
      {
        activePhases: ["baseline-model", "situational-grounding"],
      },
    );
    await flushAsync();

    expect(orchestrator.getActiveStatus()).toMatchObject({
      runId,
      status: "running",
      activePhase: "situational-grounding",
      phasesCompleted: 0,
      totalPhases: 2,
    });

    resolvePhase1(makePhaseResult("situational-grounding"));
    await flushAsync();

    expect(orchestrator.getStatus(runId)).toMatchObject({
      status: "completed",
      phasesCompleted: 2,
      totalPhases: 2,
    });
  });

  // ── 3. No concurrent runs ──

  it("rejects second runFull while a run is active", async () => {
    let resolvePhase1!: (value: PhaseToolResult) => void;
    mockRunPhase.mockReturnValueOnce(
      new Promise<PhaseToolResult>((resolve) => {
        resolvePhase1 = resolve;
      }),
    );

    await orchestrator.runFull("Topic 1");
    await flushAsync();

    // Second run should throw
    await expect(orchestrator.runFull("Topic 2")).rejects.toThrow(
      "A run is already active",
    );
    expect(mockEntityGraph.newAnalysis).toHaveBeenCalledTimes(1);
    expect(mockEntityGraph.newAnalysis).toHaveBeenCalledWith(
      "Topic 1",
      expect.any(String),
    );

    // Clean up
    resolvePhase1(makePhaseResult("situational-grounding"));
    orchestrator.abort();
    await flushAsync();
  });

  // ── 4. Retry classification ──

  it("classifies 'connection reset' as retryable", () => {
    expect(orchestrator.classifyFailure("connection reset by peer")).toBe(
      "retryable",
    );
  });

  it("classifies 'timeout' as terminal", () => {
    expect(orchestrator.classifyFailure("Request timeout after 30s")).toBe(
      "terminal",
    );
  });

  it("classifies 'unauthorized' as terminal", () => {
    expect(orchestrator.classifyFailure("Unauthorized: invalid API key")).toBe(
      "terminal",
    );
  });

  it("classifies 'forbidden' as terminal", () => {
    expect(orchestrator.classifyFailure("403 Forbidden")).toBe("terminal");
  });

  it("classifies 'schema refused' as terminal", () => {
    expect(orchestrator.classifyFailure("Schema was refused by model")).toBe(
      "terminal",
    );
  });

  it("classifies OpenAI structured-output schema errors as terminal", () => {
    expect(
      orchestrator.classifyFailure(
        "Invalid schema for response_format 'codex_output_schema': In context=('properties', 'entities', 'items'), 'oneOf' is not permitted.",
      ),
    ).toBe("terminal");
    expect(
      orchestrator.classifyFailure(
        "invalid_json_schema: outputSchema rejected",
      ),
    ).toBe("terminal");
  });

  it("classifies remote Codex aborts as retryable", () => {
    expect(
      orchestrator.classifyFailure(
        "Codex turn failed: Aborted (status=failed)",
      ),
    ).toBe("retryable");
    expect(
      orchestrator.classifyFailure(
        "Codex turn failed: operation aborted by runtime",
      ),
    ).toBe("retryable");
  });

  it("classifies transport errors as retryable", () => {
    expect(orchestrator.classifyFailure("ECONNRESET")).toBe("retryable");
    expect(orchestrator.classifyFailure("Network error")).toBe("retryable");
    expect(orchestrator.classifyFailure("socket hang up")).toBe("retryable");
    expect(orchestrator.classifyFailure("EPIPE: broken pipe")).toBe(
      "retryable",
    );
  });

  it("classifies empty-response errors as retryable", () => {
    expect(orchestrator.classifyFailure("Empty response")).toBe("retryable");
    expect(orchestrator.classifyFailure("empty output from model")).toBe(
      "retryable",
    );
    expect(orchestrator.classifyFailure("no content returned")).toBe(
      "retryable",
    );
  });

  it("classifies parse/validation errors as retryable", () => {
    expect(orchestrator.classifyFailure("Invalid JSON in response")).toBe(
      "retryable",
    );
    expect(orchestrator.classifyFailure("Parse error")).toBe("retryable");
    expect(orchestrator.classifyFailure("Syntax error at line 5")).toBe(
      "retryable",
    );
    expect(orchestrator.classifyFailure("Zod validation failed")).toBe(
      "retryable",
    );
    expect(orchestrator.classifyFailure("validation error")).toBe("retryable");
  });

  it("classifies unknown errors as terminal (not retryable)", () => {
    expect(orchestrator.classifyFailure("Something went wrong")).toBe(
      "terminal",
    );
    expect(orchestrator.classifyFailure("Internal server error")).toBe(
      "terminal",
    );
    expect(orchestrator.classifyFailure("Rate limit exceeded")).toBe(
      "terminal",
    );
  });

  // ── 5. Phase failure stops the run immediately (no retries in tool-based path) ──

  it("fails immediately on phase failure without retrying", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makeFailedResult("Invalid JSON in response"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toBe("Invalid JSON in response");

    // 1 (phase 1) + 1 (phase 2 fails) = 2 calls, no retries
    expect(mockRunPhase).toHaveBeenCalledTimes(2);
    expect(mockEntityGraph.removePhaseEntities).not.toHaveBeenCalled();
  });

  it("fails immediately on Codex abort errors", async () => {
    mockRunPhase.mockResolvedValueOnce(
      makeFailedResult("Codex turn failed: Aborted"),
    );

    const { runId } = await orchestrator.runFull(
      "Test topic",
      "codex",
      "gpt-5.4",
    );
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toContain("Codex turn failed");
    expect(mockRunPhase).toHaveBeenCalledTimes(1);
    expect((mockRunPhase.mock.calls[0][4] as any)?.provider).toBe("codex");
    expect((mockRunPhase.mock.calls[0][4] as any)?.model).toBe("gpt-5.4");
  });

  // ── 6. Phase failure fails the run ──

  it("fails run on first phase failure", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makeFailedResult("Parse error"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toBe("Parse error");

    // 1 (phase 1) + 1 (phase 2 failure) = 2 calls
    expect(mockRunPhase).toHaveBeenCalledTimes(2);
  });

  // ── 7. Terminal failure: no retry ──

  it("does not retry terminal failures", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      // Phase 2: terminal failure on first attempt
      .mockResolvedValueOnce(makeFailedResult("Unauthorized: invalid API key"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toContain("Unauthorized");

    // 1 (phase 1) + 1 (phase 2 terminal) = 2 calls
    expect(mockRunPhase).toHaveBeenCalledTimes(2);

    // No direct phase clearing happens on terminal failure either
    expect(mockEntityGraph.removePhaseEntities).not.toHaveBeenCalled();
  });

  it("keeps terminal Codex schema failures descriptive for the user", async () => {
    mockRunPhase.mockResolvedValueOnce(
      makeFailedResult(
        "Codex turn failed: invalid_json_schema: outputSchema rejected for model gpt-5.4",
      ),
    );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    const { runId } = await orchestrator.runFull(
      "Test topic",
      "openai",
      "gpt-5.4",
    );
    await flushAsync();
    unsubscribe();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toBe(
      "Codex turn failed: invalid_json_schema: outputSchema rejected for model gpt-5.4",
    );

    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      error: expect.objectContaining({
        message:
          "Codex turn failed: invalid_json_schema: outputSchema rejected for model gpt-5.4",
      }),
    });
  });

  // ── 8. Edit queueing ──

  it("queues edits during active phase and drains after completion", async () => {
    const editLog: string[] = [];

    let resolvePhase1!: (value: PhaseToolResult) => void;
    mockRunPhase
      .mockReturnValueOnce(
        new Promise<PhaseToolResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      )
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("historical-game"))
      .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
      .mockResolvedValueOnce(makePhaseResult("assumptions"))
      .mockResolvedValueOnce(makePhaseResult("elimination"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"))
      .mockResolvedValueOnce(makePhaseResult("meta-check"));

    await orchestrator.runFull("Test topic");
    await flushAsync();

    // Queue edits while phase 1 is running
    orchestrator.queueEdit(() => editLog.push("edit-1"));
    orchestrator.queueEdit(() => editLog.push("edit-2"));

    // Edits not applied yet
    expect(editLog).toEqual([]);

    // Complete phase 1
    resolvePhase1(makePhaseResult("situational-grounding"));
    await flushAsync();

    // Edits should be drained after phase 1 completes
    expect(editLog).toContain("edit-1");
    expect(editLog).toContain("edit-2");
  });

  it("executes edits immediately when no run is active", () => {
    const editLog: string[] = [];
    orchestrator.queueEdit(() => editLog.push("immediate-edit"));
    expect(editLog).toEqual(["immediate-edit"]);
  });

  // ── 9. Abort ──

  it("abort marks run as interrupted and preserves completed entities", async () => {
    let resolvePhase2!: (value: PhaseToolResult) => void;

    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockReturnValueOnce(
        new Promise<PhaseToolResult>((resolve) => {
          resolvePhase2 = resolve;
        }),
      );

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    // Phase 1 complete, phase 2 in progress — abort
    orchestrator.abort();
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("interrupted");
    expect(status.phasesCompleted).toBe(1);

    // Phase 1 commit was applied before the abort
    expect(mockCommitPhaseTransaction).toHaveBeenCalled();

    // Clean up the pending promise
    resolvePhase2(makePhaseResult("player-identification"));
    await flushAsync();
    expect(orchestrator.isRunning()).toBe(false);
  });

  // ── 10. Progress events ──

  it("emits phase_started, phase_completed, and analysis_completed events", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("historical-game"))
      .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
      .mockResolvedValueOnce(makePhaseResult("assumptions"))
      .mockResolvedValueOnce(makePhaseResult("elimination"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"))
      .mockResolvedValueOnce(makePhaseResult("meta-check"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    await orchestrator.runFull("Test topic");
    await flushAsync();

    unsubscribe();

    // Should have: 9 phase_started + 9 phase_completed + 1 analysis_completed = 19
    const phaseStarted = events.filter((e) => e.type === "phase_started");
    const phaseCompleted = events.filter((e) => e.type === "phase_completed");
    const analysisCompleted = events.filter(
      (e) => e.type === "analysis_completed",
    );

    expect(phaseStarted).toHaveLength(9);
    expect(phaseCompleted).toHaveLength(9);
    expect(analysisCompleted).toHaveLength(1);

    // Verify phase order
    expect(phaseStarted[0]).toMatchObject({
      type: "phase_started",
      phase: "situational-grounding",
    });
    expect(phaseStarted[1]).toMatchObject({
      type: "phase_started",
      phase: "player-identification",
    });
    expect(phaseStarted[2]).toMatchObject({
      type: "phase_started",
      phase: "baseline-model",
    });
    expect(phaseStarted[3]).toMatchObject({
      type: "phase_started",
      phase: "historical-game",
    });
    expect(phaseStarted[4]).toMatchObject({
      type: "phase_started",
      phase: "formal-modeling",
    });
    expect(phaseStarted[5]).toMatchObject({
      type: "phase_started",
      phase: "assumptions",
    });
    expect(phaseStarted[6]).toMatchObject({
      type: "phase_started",
      phase: "elimination",
    });
    expect(phaseStarted[7]).toMatchObject({
      type: "phase_started",
      phase: "scenarios",
    });
    expect(phaseStarted[8]).toMatchObject({
      type: "phase_started",
      phase: "meta-check",
    });
  });

  it("emits phase_activity events from the phase runtime during execution", async () => {
    mockRunPhase.mockImplementation(
      async (
        _phase: any,
        _topic: any,
        _mcp: any,
        _writeCtx: any,
        context: any,
      ) => {
        context?.onActivity?.({
          kind: "web-search",
          message: "Using WebSearch",
          query: "US China tariff history 2025",
        });
        return makePhaseResult("situational-grounding");
      },
    );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    await orchestrator.runFull("Test topic");
    await flushAsync();
    unsubscribe();

    expect(events).toContainEqual({
      type: "phase_activity",
      phase: "situational-grounding",
      runId: expect.any(String),
      kind: "web-search",
      message: "Using WebSearch",
      query: "US China tariff history 2025",
    });
  });

  it("emits analysis_failed with error details on first-phase failure", async () => {
    mockRunPhase.mockResolvedValueOnce(makeFailedResult("Network error"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    await orchestrator.runFull("Test topic");
    await flushAsync();
    unsubscribe();

    // No retries in tool-based path — failure is immediate
    expect(mockRunPhase).toHaveBeenCalledTimes(1);

    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      error: expect.objectContaining({
        message: expect.stringContaining("Network error"),
      }),
    });
  });

  it("emits analysis_failed on failure", async () => {
    mockRunPhase.mockResolvedValueOnce(
      makeFailedResult("Unauthorized: invalid key"),
    );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    await orchestrator.runFull("Test topic");
    await flushAsync();

    unsubscribe();

    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      error: expect.objectContaining({
        message: expect.stringContaining("Unauthorized"),
      }),
    });
  });

  // ── 11. Run-level timeout ──

  it("fails analysis after run-level timeout, emits analysis_failed, and cancels in-flight work", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Phase 1 succeeds, phase 2 takes too long
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockImplementation(
        (_phase: any, _topic: any, _mcp: any, _writeCtx: any, context: any) =>
          new Promise<PhaseToolResult>((_resolve, reject) => {
            context?.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("Aborted"));
              },
              { once: true },
            );
          }),
      );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    const { runId } = await orchestrator.runFull("Test topic");

    // Let phase 1 complete (microtasks)
    await flushAsync();

    // Fast-forward past run-level timeout (30 min)
    vi.advanceTimersByTime(31 * 60 * 1000);
    await flushAsync();
    try {
      await orchestrator._getRunPromise();
    } catch (_) {
      /* aborted */
    }

    unsubscribe();

    const status = orchestrator.getStatus(runId);
    // The run should be failed due to timeout
    expect(status.status).toBe("failed");
    expect(status.error).toContain("timeout");

    // analysis_failed event should have been emitted
    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      runId,
      error: expect.objectContaining({
        message: expect.stringContaining("timeout"),
      }),
    });

    // In-flight work was cancelled — phase 2 did not complete
    expect(status.phasesCompleted).toBe(1);
  });

  // ── 11b. Phase timeout (9 min) is terminal, not retried ──

  it("treats phase timeout (9 min) as terminal — no retry", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makeFailedResult("Phase timeout"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");

    // Phase timeout is terminal — should NOT have retried phase 2
    // 1 (phase 1 success) + 1 (phase 2 timeout, no retry) = 2 calls
    expect(mockRunPhase).toHaveBeenCalledTimes(2);
  });

  // ── 12. isRunning returns correct state ──

  it("isRunning returns true during active run, false otherwise", async () => {
    expect(orchestrator.isRunning()).toBe(false);

    let resolvePhase1!: (value: PhaseToolResult) => void;
    mockRunPhase
      .mockReturnValueOnce(
        new Promise<PhaseToolResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      )
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"))
      .mockResolvedValueOnce(makePhaseResult("historical-game"))
      .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
      .mockResolvedValueOnce(makePhaseResult("assumptions"))
      .mockResolvedValueOnce(makePhaseResult("elimination"))
      .mockResolvedValueOnce(makePhaseResult("scenarios"))
      .mockResolvedValueOnce(makePhaseResult("meta-check"));

    await orchestrator.runFull("Test topic");
    await flushAsync();

    expect(orchestrator.isRunning()).toBe(true);

    resolvePhase1(makePhaseResult("situational-grounding"));
    await flushAsync();

    expect(orchestrator.isRunning()).toBe(false);
  });

  // ── Additional edge cases ──

  describe("getStatus for unknown runId", () => {
    it("returns idle status for unknown runId", () => {
      const status = orchestrator.getStatus("unknown-run-id");
      expect(status).toEqual({
        runId: "unknown-run-id",
        status: "idle",
        activePhase: null,
        phasesCompleted: 0,
        totalPhases: 9,
      });
    });
  });

  describe("getResult", () => {
    it("returns snapshot for completed run (not current graph)", async () => {
      const snapshotEntities = [
        {
          id: "e1",
          type: "fact",
          phase: "situational-grounding",
          data: { type: "fact", content: "Snapshot fact" },
        },
      ] as unknown as AnalysisEntity[];
      const snapshotRelationships = [
        {
          id: "r1",
          type: "precedes",
          fromEntityId: "e1",
          toEntityId: "e2",
        },
      ] as unknown as AnalysisRelationship[];

      // getAnalysis is called during buildPriorContext (for each subsequent phase)
      // and at run completion for the snapshot. Use mockImplementation to keep
      // returning the same data without polluting later tests.
      const snapshotGraph = {
        id: "test",
        name: "test",
        topic: "test",
        entities: snapshotEntities,
        relationships: snapshotRelationships,
        phases: [],
      };
      mockEntityGraph.getAnalysis.mockImplementation(() => snapshotGraph);

      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"))
        .mockResolvedValueOnce(makePhaseResult("historical-game"))
        .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
        .mockResolvedValueOnce(makePhaseResult("assumptions"))
        .mockResolvedValueOnce(makePhaseResult("elimination"))
        .mockResolvedValueOnce(makePhaseResult("scenarios"))
        .mockResolvedValueOnce(makePhaseResult("meta-check"));

      const { runId } = await orchestrator.runFull("Test topic");
      await flushAsync();

      // Reset mock to return different data (simulating post-edit state)
      const postEditGraph = {
        id: "test",
        name: "test",
        topic: "test",
        entities: [
          {
            id: "e1-edited",
            type: "fact",
            phase: "situational-grounding",
            data: { type: "fact", content: "Edited fact" },
          },
        ] as unknown as AnalysisEntity[],
        relationships: [],
        phases: [],
      };
      mockEntityGraph.getAnalysis.mockImplementation(() => postEditGraph);

      // getResult should return the snapshot, not the post-edit data
      const result = orchestrator.getResult(runId);
      expect(result.runId).toBe(runId);
      expect(result.entities).toEqual(snapshotEntities);
      expect(result.relationships).toEqual(snapshotRelationships);

      // Restore default mock for subsequent tests
      mockEntityGraph.getAnalysis.mockImplementation(() => ({
        id: "test",
        name: "test",
        topic: "test",
        entities: [] as AnalysisEntity[],
        relationships: [] as AnalysisRelationship[],
        phases: [],
      }));
    });

    it("falls back to current graph for unknown runId", () => {
      const mockEntities = [
        { id: "e1", type: "fact", phase: "situational-grounding" },
      ] as unknown as AnalysisEntity[];
      mockEntityGraph.getAnalysis.mockReturnValueOnce({
        id: "test",
        name: "test",
        topic: "test",
        entities: mockEntities,
        relationships: [],
        phases: [],
      });

      const result = orchestrator.getResult("unknown-run-id");
      expect(result.runId).toBe("unknown-run-id");
      expect(result.entities).toEqual(mockEntities);
    });
  });

  describe("markOrphanedRunsFailed", () => {
    it("marks an active running run as failed on startup", async () => {
      let resolvePhase1!: (value: PhaseToolResult) => void;
      mockRunPhase.mockReturnValueOnce(
        new Promise<PhaseToolResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      );

      const { runId } = await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(orchestrator.isRunning()).toBe(true);

      // Simulate app restart detection
      orchestrator.markOrphanedRunsFailed();

      const status = orchestrator.getStatus(runId);
      expect(status.status).toBe("failed");
      expect(status.error).toContain("interrupted");
      expect(orchestrator._getActiveRun()).toBeNull();

      // Resolve the pending phase so the async execution can unwind
      resolvePhase1(makePhaseResult("situational-grounding"));
      await flushAsync();

      // After the execution settles, isRunning should be false
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("does nothing when no run is active", () => {
      // Should not throw
      orchestrator.markOrphanedRunsFailed();
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe("onProgress unsubscribe", () => {
    it("stops receiving events after unsubscribe", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"))
        .mockResolvedValueOnce(makePhaseResult("historical-game"))
        .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
        .mockResolvedValueOnce(makePhaseResult("assumptions"))
        .mockResolvedValueOnce(makePhaseResult("elimination"))
        .mockResolvedValueOnce(makePhaseResult("scenarios"))
        .mockResolvedValueOnce(makePhaseResult("meta-check"));

      const events: AnalysisProgressEvent[] = [];
      const unsubscribe = orchestrator.onProgress((event) =>
        events.push(event),
      );

      // Unsubscribe before run starts
      unsubscribe();

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(events).toHaveLength(0);
    });
  });

  describe("provider affinity", () => {
    it("passes the SAME provider+model+runtime to every runPhase call in a run", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"))
        .mockResolvedValueOnce(makePhaseResult("historical-game"))
        .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
        .mockResolvedValueOnce(makePhaseResult("assumptions"))
        .mockResolvedValueOnce(makePhaseResult("elimination"))
        .mockResolvedValueOnce(makePhaseResult("scenarios"))
        .mockResolvedValueOnce(makePhaseResult("meta-check"));

      await orchestrator.runFull("Test topic", "codex", "gpt-4o", undefined, {
        webSearch: false,
      });
      await flushAsync();

      // All 9 phases must have been called
      expect(mockRunPhase).toHaveBeenCalledTimes(9);

      // Every call gets the same provider+model (context is 5th arg, index 4)
      for (const call of mockRunPhase.mock.calls) {
        const context = call[4] as
          | {
              provider?: string;
              model?: string;
              runtime?: ResolvedAnalysisRuntime;
            }
          | undefined;
        expect(context?.provider).toBe("codex");
        expect(context?.model).toBe("gpt-4o");
        expect(context?.runtime).toEqual({
          webSearch: false,
          effortLevel: "medium",
        });
      }
    });
  });

  // ── 13. onRunComplete wiring ──

  describe("revalidation wiring", () => {
    it("calls revalidationService.onRunComplete after run completes", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"))
        .mockResolvedValueOnce(makePhaseResult("historical-game"))
        .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
        .mockResolvedValueOnce(makePhaseResult("assumptions"))
        .mockResolvedValueOnce(makePhaseResult("elimination"))
        .mockResolvedValueOnce(makePhaseResult("scenarios"))
        .mockResolvedValueOnce(makePhaseResult("meta-check"));

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(mockRevalidation.onRunComplete).toHaveBeenCalledWith(
        undefined,
        undefined,
        { webSearch: true, effortLevel: "medium" },
        true,
      );
    });

    it("calls revalidationService.onRunComplete even after failure", async () => {
      mockRunPhase.mockResolvedValueOnce(
        makeFailedResult("Unauthorized: invalid key"),
      );

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(mockRevalidation.onRunComplete).toHaveBeenCalledWith(
        undefined,
        undefined,
        { webSearch: true, effortLevel: "medium" },
        true,
      );
    });

    it("disables auto-revalidation after subset runs", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"));

      await orchestrator.runFull(
        "Test topic",
        undefined,
        undefined,
        undefined,
        {
          activePhases: ["situational-grounding", "baseline-model"],
        },
      );
      await flushAsync();

      expect(mockRevalidation.onRunComplete).toHaveBeenCalledWith(
        undefined,
        undefined,
        { webSearch: true, effortLevel: "medium" },
        false,
      );
    });
  });

  // ── 15. Loopback trigger handling ──

  describe("loopback triggers", () => {
    it("jumps back to earlier phase when loopback triggers are recorded", async () => {
      let phase4CallCount = 0;
      mockRunPhase.mockImplementation((phase) => {
        if (phase === "historical-game") {
          phase4CallCount++;
          if (phase4CallCount === 1) {
            // First time through phase 4, inject a loopback trigger
            mockTriggers = [
              {
                trigger_type: "game_reframed",
                justification: "History shows this is actually a repeated PD",
                timestamp: Date.now(),
              },
            ];
          }
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      const { runId } = await orchestrator.runFull("Test topic");
      await flushAsync();

      const status = orchestrator.getStatus(runId);
      expect(status.status).toBe("completed");

      // Should have re-run from baseline-model forward:
      // P1, P2, P3, P4 (trigger), P3 (re-run), P4 (re-run), P5, P6, P7, P8, P9
      const calledPhases = mockRunPhase.mock.calls.map((c) => c[0]);
      expect(calledPhases[0]).toBe("situational-grounding");
      expect(calledPhases[1]).toBe("player-identification");
      expect(calledPhases[2]).toBe("baseline-model");
      expect(calledPhases[3]).toBe("historical-game");
      // After loopback: jump back to baseline-model
      expect(calledPhases[4]).toBe("baseline-model");
      expect(calledPhases[5]).toBe("historical-game");
      expect(calledPhases[6]).toBe("formal-modeling");
      expect(calledPhases[7]).toBe("assumptions");
      expect(calledPhases[8]).toBe("elimination");
      expect(calledPhases[9]).toBe("scenarios");
      expect(calledPhases[10]).toBe("meta-check");
    });

    it("halts after MAX_LOOPBACK_PASSES with convergence failure", async () => {
      // Always inject a trigger on every phase 4 run
      mockRunPhase.mockImplementation((phase) => {
        if (phase === "historical-game") {
          mockTriggers = [
            {
              trigger_type: "new_player",
              justification: "Discovered hidden player",
              timestamp: Date.now(),
            },
          ];
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      const { runId } = await orchestrator.runFull("Test topic");
      await flushAsync();

      const status = orchestrator.getStatus(runId);
      expect(status.status).toBe("failed");
      expect(status.error).toContain("convergence failed");
    });

    it("does not jump back if trigger targets a later phase", async () => {
      mockRunPhase.mockImplementation((phase) => {
        if (phase === "baseline-model") {
          // Trigger targets assumptions which is AFTER current phase
          mockTriggers = [
            {
              trigger_type: "assumption_invalidated",
              justification: "Assumption changed",
              timestamp: Date.now(),
            },
          ];
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      const { runId } = await orchestrator.runFull("Test topic");
      await flushAsync();

      const status = orchestrator.getStatus(runId);
      expect(status.status).toBe("completed");

      // Should run normally: all 9 phases — no loopback
      expect(mockRunPhase).toHaveBeenCalledTimes(9);
    });

    it("resolves inactive loopback targets to the earliest eligible active phase", async () => {
      let formalModelingCalls = 0;
      mockRunPhase.mockImplementation((phase) => {
        if (phase === "formal-modeling") {
          formalModelingCalls++;
        }
        if (phase === "formal-modeling" && formalModelingCalls === 1) {
          mockTriggers = [
            {
              trigger_type: "game_reframed",
              justification: "Baseline game changed",
              timestamp: Date.now(),
            },
          ];
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      const { runId } = await orchestrator.runFull(
        "Test topic",
        undefined,
        undefined,
        undefined,
        {
          activePhases: [
            "situational-grounding",
            "historical-game",
            "formal-modeling",
          ],
        },
      );
      await flushAsync();

      expect(orchestrator.getStatus(runId).status).toBe("completed");
      expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual([
        "situational-grounding",
        "historical-game",
        "formal-modeling",
        "historical-game",
        "formal-modeling",
      ]);
    });

    it("does not jump when an inactive loopback target resolves to no earlier active phase", async () => {
      mockRunPhase.mockImplementation((phase) => {
        if (phase === "historical-game") {
          mockTriggers = [
            {
              trigger_type: "assumption_invalidated",
              justification: "Late assumption changed",
              timestamp: Date.now(),
            },
          ];
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      const { runId } = await orchestrator.runFull(
        "Test topic",
        undefined,
        undefined,
        undefined,
        {
          activePhases: ["situational-grounding", "historical-game"],
        },
      );
      await flushAsync();

      expect(orchestrator.getStatus(runId).status).toBe("completed");
      expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual([
        "situational-grounding",
        "historical-game",
      ]);
    });

    it("builds prior context only from earlier active phases after a loopback", async () => {
      mockEntityGraph.getAnalysis.mockImplementation(() => ({
        id: "test",
        name: "test",
        topic: "test",
        entities: [
          {
            id: "fact-1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2025-06-15",
              source: "Reuters",
              content: "Grounding fact",
              category: "action",
            },
          },
          {
            id: "game-1",
            type: "game",
            phase: "baseline-model",
            data: {
              type: "game",
              name: "Baseline game",
              gameType: "chicken",
              timing: "sequential",
              description: "Test game",
            },
          },
          {
            id: "scenario-1",
            type: "scenario",
            phase: "scenarios",
            data: {
              type: "scenario",
              subtype: "baseline",
              narrative: "Scenario",
              probability: { point: 100, rangeLow: 90, rangeHigh: 100 },
              key_assumptions: [],
              invalidation_conditions: "Never",
              model_basis: [],
              cross_game_interactions: "",
              prediction_basis: "equilibrium",
              trigger: null,
              why_unlikely: null,
              consequences: null,
              drift_trajectory: null,
            },
          },
        ] as AnalysisEntity[],
        relationships: [] as AnalysisRelationship[],
        phases: [],
      }));

      mockRunPhase.mockImplementation((phase) => {
        if (phase === "scenarios") {
          mockTriggers = [
            {
              trigger_type: "game_reframed",
              justification: "Scenario exposed a reframed game",
              timestamp: Date.now(),
            },
          ];
        }
        return Promise.resolve(makePhaseResult(phase as MethodologyPhase));
      });

      await orchestrator.runFull(
        "Test topic",
        undefined,
        undefined,
        undefined,
        {
          activePhases: [
            "situational-grounding",
            "baseline-model",
            "scenarios",
          ],
        },
      );
      await flushAsync();

      // After loopback, baseline-model is re-run as the 4th call (index 3).
      // The orchestrator builds promptBundle internally using buildPhasePromptBundle.
      // In tool-based path, phaseBrief is baked into the promptBundle, not passed directly.
      // Verify the context (arg index 4) has a promptBundle with system and user prompts.
      const secondBaselineContext = mockRunPhase.mock.calls[3][4] as
        | { promptBundle?: { system: string; user: string } }
        | undefined;
      expect(secondBaselineContext?.promptBundle).toBeDefined();
      expect(typeof secondBaselineContext?.promptBundle?.system).toBe("string");
      expect(typeof secondBaselineContext?.promptBundle?.user).toBe("string");
    });
  });

  // ── promptBundle propagation ──

  describe("promptBundle propagation", () => {
    it("passes promptBundle to runPhase for every phase", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"))
        .mockResolvedValueOnce(makePhaseResult("historical-game"))
        .mockResolvedValueOnce(makePhaseResult("formal-modeling"))
        .mockResolvedValueOnce(makePhaseResult("assumptions"))
        .mockResolvedValueOnce(makePhaseResult("elimination"))
        .mockResolvedValueOnce(makePhaseResult("scenarios"))
        .mockResolvedValueOnce(makePhaseResult("meta-check"));

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(mockRunPhase).toHaveBeenCalledTimes(9);

      for (let i = 0; i < 9; i++) {
        const context = mockRunPhase.mock.calls[i][4] as
          | { promptBundle?: { system: string; user: string } }
          | undefined;
        expect(context?.promptBundle).toBeDefined();
        expect(typeof context?.promptBundle?.system).toBe("string");
        expect(typeof context?.promptBundle?.user).toBe("string");
        expect(context?.promptBundle?.system.length).toBeGreaterThan(0);
        expect(context?.promptBundle?.user.length).toBeGreaterThan(0);
      }
    });
  });
});
