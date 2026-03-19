import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { MethodologyPhase } from "@/types/methodology";
import type { PhaseResult } from "@/services/ai/analysis-service";
import type { AnalysisProgressEvent } from "@/services/ai/analysis-events";
import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";

// ── Mock analysis-service ──

const mockRunPhase = vi.fn<
  (
    phase: MethodologyPhase,
    topic: string,
    context?: {
      priorEntities?: string;
      provider?: string;
      model?: string;
      signal?: AbortSignal;
    },
  ) => Promise<PhaseResult>
>();

vi.mock("@/services/ai/analysis-service", () => ({
  runPhase: (...args: Parameters<typeof mockRunPhase>) => mockRunPhase(...args),
}));

// ── Mock entity-graph-service ──

const mockEntityGraph = {
  getAnalysis: vi.fn(() => ({
    id: "test",
    name: "test",
    topic: "test",
    entities: [] as AnalysisEntity[],
    relationships: [] as AnalysisRelationship[],
    phases: [],
  })),
  createEntity: vi.fn((data: Record<string, unknown>) => ({
    ...data,
    id: `gen-${Math.random().toString(36).slice(2, 6)}`,
  })),
  createRelationship: vi.fn((data: Record<string, unknown>) => ({
    ...data,
    id: `rel-gen`,
  })),
  setPhaseStatus: vi.fn(),
  removePhaseEntities: vi.fn(),
};

vi.mock("@/services/ai/entity-graph-service", () => mockEntityGraph);

// ── Mock revalidation-service ──

const mockRevalidation = {
  onRunComplete: vi.fn(),
  wire: vi.fn(),
};

vi.mock("@/services/ai/revalidation-service", () => mockRevalidation);

// ── Test fixtures ──

function makePhaseResult(
  phase: "situational-grounding" | "player-identification" | "baseline-model",
  entityCount = 1,
): PhaseResult {
  const entities = [];
  for (let i = 0; i < entityCount; i++) {
    if (phase === "situational-grounding") {
      entities.push({
        id: `fact-${i + 1}`,
        type: "fact" as const,
        phase: "situational-grounding" as const,
        data: {
          type: "fact" as const,
          date: "2025-06-15",
          source: "Reuters",
          content: `Fact ${i + 1}`,
          category: "action" as const,
        },
        position: { x: 0, y: 0 },
        confidence: "high" as const,
        source: "ai" as const,
        rationale: "Test",
        revision: 1,
        stale: false,
      });
    } else if (phase === "player-identification") {
      entities.push({
        id: `player-${i + 1}`,
        type: "player" as const,
        phase: "player-identification" as const,
        data: {
          type: "player" as const,
          name: `Player ${i + 1}`,
          playerType: "primary" as const,
          knowledge: [],
        },
        position: { x: 0, y: 0 },
        confidence: "high" as const,
        source: "ai" as const,
        rationale: "Test",
        revision: 1,
        stale: false,
      });
    } else {
      entities.push({
        id: `game-${i + 1}`,
        type: "game" as const,
        phase: "baseline-model" as const,
        data: {
          type: "game" as const,
          name: `Game ${i + 1}`,
          gameType: "chicken" as const,
          timing: "sequential" as const,
          description: "Test game",
        },
        position: { x: 0, y: 0 },
        confidence: "medium" as const,
        source: "ai" as const,
        rationale: "Test",
        revision: 1,
        stale: false,
      });
    }
  }

  return {
    success: true,
    entities,
    relationships: [],
  };
}

function makeFailedResult(error: string): PhaseResult {
  return {
    success: false,
    entities: [],
    relationships: [],
    error,
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
    return import("@/services/ai/analysis-orchestrator");
  }

  let orchestrator: Awaited<ReturnType<typeof importOrchestrator>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    orchestrator = await importOrchestrator();
    orchestrator._resetForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. runFull returns runId and executes phases sequentially ──

  it("runFull returns runId and executes phases sequentially", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const { runId } = await orchestrator.runFull("US-China trade war");
    expect(runId).toMatch(/^run-/);

    // Let phases execute
    await flushAsync();

    // All 3 phases should have been called in order
    expect(mockRunPhase).toHaveBeenCalledTimes(3);
    expect(mockRunPhase.mock.calls[0][0]).toBe("situational-grounding");
    expect(mockRunPhase.mock.calls[1][0]).toBe("player-identification");
    expect(mockRunPhase.mock.calls[2][0]).toBe("baseline-model");

    // Topic passed to each phase
    expect(mockRunPhase.mock.calls[0][1]).toBe("US-China trade war");

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("completed");
    expect(status.phasesCompleted).toBe(3);
    expect(status.totalPhases).toBe(3);
  });

  // ── 2. getStatus returns progress during active run ──

  it("getStatus returns progress during active run", async () => {
    // Make phase 1 resolve after we check status
    let resolvePhase1!: (value: PhaseResult) => void;
    const phase1Promise = new Promise<PhaseResult>((resolve) => {
      resolvePhase1 = resolve;
    });

    mockRunPhase
      .mockReturnValueOnce(phase1Promise)
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

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
    expect(finalStatus.phasesCompleted).toBe(3);
  });

  // ── 3. No concurrent runs ──

  it("rejects second runFull while a run is active", async () => {
    let resolvePhase1!: (value: PhaseResult) => void;
    mockRunPhase.mockReturnValueOnce(
      new Promise<PhaseResult>((resolve) => {
        resolvePhase1 = resolve;
      }),
    );

    await orchestrator.runFull("Topic 1");
    await flushAsync();

    // Second run should throw
    await expect(orchestrator.runFull("Topic 2")).rejects.toThrow(
      "A run is already active",
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

  // ── 5. Clear-before-retry ──

  it("calls removePhaseEntities with phase AND runId before retry", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      // Phase 2: fail twice (retryable), succeed on 3rd
      .mockResolvedValueOnce(makeFailedResult("Invalid JSON in response"))
      .mockResolvedValueOnce(makeFailedResult("Empty response"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    // removePhaseEntities should be called before each retry (not before first attempt)
    const removePhaseEntityCalls =
      mockEntityGraph.removePhaseEntities.mock.calls;
    expect(removePhaseEntityCalls.length).toBe(2);
    // Both calls for player-identification phase WITH runId
    expect(removePhaseEntityCalls[0][0]).toBe("player-identification");
    expect(removePhaseEntityCalls[0][1]).toBe(runId);
    expect(removePhaseEntityCalls[1][0]).toBe("player-identification");
    expect(removePhaseEntityCalls[1][1]).toBe(runId);

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("completed");
  });

  // ── 6. Max 2 retries then phase fails ──

  it("fails phase after exhausting max 2 retries", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      // Phase 2: fail 3 times (original + 2 retries)
      .mockResolvedValueOnce(makeFailedResult("Parse error"))
      .mockResolvedValueOnce(makeFailedResult("Parse error"))
      .mockResolvedValueOnce(makeFailedResult("Parse error"));

    const { runId } = await orchestrator.runFull("Test topic");
    await flushAsync();

    const status = orchestrator.getStatus(runId);
    expect(status.status).toBe("failed");
    expect(status.error).toBe("Parse error");

    // 1 (phase 1) + 3 (phase 2: original + 2 retries) = 4 calls
    expect(mockRunPhase).toHaveBeenCalledTimes(4);
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

    // No removePhaseEntities called (no retries happened)
    expect(mockEntityGraph.removePhaseEntities).not.toHaveBeenCalled();
  });

  // ── 8. Edit queueing ──

  it("queues edits during active phase and drains after completion", async () => {
    const editLog: string[] = [];

    let resolvePhase1!: (value: PhaseResult) => void;
    mockRunPhase
      .mockReturnValueOnce(
        new Promise<PhaseResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      )
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

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
    let resolvePhase2!: (value: PhaseResult) => void;

    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockReturnValueOnce(
        new Promise<PhaseResult>((resolve) => {
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

    // isRunning should be false after abort
    expect(orchestrator.isRunning()).toBe(false);

    // Phase 1 entities were created
    expect(mockEntityGraph.createEntity).toHaveBeenCalled();

    // Clean up the pending promise
    resolvePhase2(makePhaseResult("player-identification"));
    await flushAsync();
  });

  // ── 10. Progress events ──

  it("emits phase_started, phase_completed, and analysis_completed events", async () => {
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    await orchestrator.runFull("Test topic");
    await flushAsync();

    unsubscribe();

    // Should have: 3 phase_started + 3 phase_completed + 1 analysis_completed = 7
    const phaseStarted = events.filter((e) => e.type === "phase_started");
    const phaseCompleted = events.filter((e) => e.type === "phase_completed");
    const analysisCompleted = events.filter(
      (e) => e.type === "analysis_completed",
    );

    expect(phaseStarted).toHaveLength(3);
    expect(phaseCompleted).toHaveLength(3);
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
      error: expect.stringContaining("Unauthorized"),
    });
  });

  // ── 11. Run-level timeout ──

  it("fails analysis after run-level timeout, emits analysis_failed, and cancels in-flight work", async () => {
    // Phase 1 succeeds, phase 2 takes too long
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockImplementation(
        () =>
          new Promise<PhaseResult>((resolve) => {
            // This never resolves on its own — timeout will catch it
            setTimeout(
              () => resolve(makePhaseResult("player-identification")),
              20 * 60 * 1000,
            );
          }),
      );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = orchestrator.onProgress((event) => events.push(event));

    const { runId } = await orchestrator.runFull("Test topic");

    // Fast-forward past run-level timeout (15 min)
    await vi.advanceTimersByTimeAsync(16 * 60 * 1000);
    await flushAsync();

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
      error: expect.stringContaining("timeout"),
    });

    // In-flight work was cancelled — phase 2 did not complete
    expect(status.phasesCompleted).toBe(1);
  });

  // ── 11b. Phase timeout (3 min) is terminal, not retried ──

  it("treats phase timeout (3 min) as terminal — no retry", async () => {
    // Phase 1 succeeds, phase 2 exceeds the 3-minute phase timeout
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockImplementation(
        () =>
          new Promise<PhaseResult>((resolve) => {
            // Never resolves on its own — phase timeout (3 min) will fire
            setTimeout(
              () => resolve(makePhaseResult("player-identification")),
              5 * 60 * 1000,
            );
          }),
      );

    const { runId } = await orchestrator.runFull("Test topic");

    // Fast-forward past phase timeout (3 min) but not run timeout (15 min)
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
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

    let resolvePhase1!: (value: PhaseResult) => void;
    mockRunPhase
      .mockReturnValueOnce(
        new Promise<PhaseResult>((resolve) => {
          resolvePhase1 = resolve;
        }),
      )
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

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
        totalPhases: 3,
      });
    });
  });

  describe("getResult", () => {
    it("returns entities and relationships from entity-graph-service", () => {
      const mockEntities = [
        { id: "e1", type: "fact", phase: "situational-grounding" },
      ] as unknown as AnalysisEntity[];
      const mockRelationships = [
        {
          id: "r1",
          type: "precedes",
          fromEntityId: "e1",
          toEntityId: "e2",
        },
      ] as unknown as AnalysisRelationship[];
      mockEntityGraph.getAnalysis.mockReturnValueOnce({
        id: "test",
        name: "test",
        topic: "test",
        entities: mockEntities,
        relationships: mockRelationships,
        phases: [],
      });

      const result = orchestrator.getResult("test-run");
      expect(result.runId).toBe("test-run");
      expect(result.entities).toEqual(mockEntities);
      expect(result.relationships).toEqual(mockRelationships);
    });
  });

  describe("markOrphanedRunsFailed", () => {
    it("marks an active running run as failed on startup", async () => {
      let resolvePhase1!: (value: PhaseResult) => void;
      mockRunPhase.mockReturnValueOnce(
        new Promise<PhaseResult>((resolve) => {
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
        .mockResolvedValueOnce(makePhaseResult("baseline-model"));

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
    it("passes the SAME provider+model to every runPhase call in a run", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"));

      await orchestrator.runFull("Test topic", "openai", "gpt-4o");
      await flushAsync();

      // All 3 phases must have been called
      expect(mockRunPhase).toHaveBeenCalledTimes(3);

      // Every call gets the same provider+model
      for (const call of mockRunPhase.mock.calls) {
        const context = call[2] as
          | { provider?: string; model?: string }
          | undefined;
        expect(context?.provider).toBe("openai");
        expect(context?.model).toBe("gpt-4o");
      }
    });
  });

  // ── 13. Relationship ID remapping ──

  describe("relationship ID remapping", () => {
    it("remaps AI-provided entity IDs to service-generated IDs in relationships", async () => {
      // createEntity mock returns predictable IDs
      let entityCounter = 0;
      mockEntityGraph.createEntity.mockImplementation(
        (data: Record<string, unknown>) => ({
          ...data,
          id: `svc-entity-${++entityCounter}`,
        }),
      );

      const phaseResult: PhaseResult = {
        success: true,
        entities: [
          {
            id: "ai-player-1",
            type: "player" as const,
            phase: "situational-grounding" as const,
            data: {
              type: "player" as const,
              name: "Player A",
              playerType: "primary" as const,
              knowledge: [],
            },
            position: { x: 0, y: 0 },
            confidence: "high" as const,
            source: "ai" as const,
            rationale: "Test",
            revision: 1,
            stale: false,
          },
          {
            id: "ai-player-2",
            type: "player" as const,
            phase: "situational-grounding" as const,
            data: {
              type: "player" as const,
              name: "Player B",
              playerType: "primary" as const,
              knowledge: [],
            },
            position: { x: 0, y: 0 },
            confidence: "high" as const,
            source: "ai" as const,
            rationale: "Test",
            revision: 1,
            stale: false,
          },
        ],
        relationships: [
          {
            id: "ai-rel-1",
            type: "supports" as const,
            fromEntityId: "ai-player-1",
            toEntityId: "ai-player-2",
          },
        ],
      };

      mockRunPhase
        .mockResolvedValueOnce(phaseResult)
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"));

      await orchestrator.runFull("Test topic");
      await flushAsync();

      // createRelationship should have been called with remapped IDs
      expect(mockEntityGraph.createRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "supports",
          fromEntityId: "svc-entity-1",
          toEntityId: "svc-entity-2",
        }),
      );
    });
  });

  // ── 14. onRunComplete wiring ──

  describe("revalidation wiring", () => {
    it("calls revalidationService.onRunComplete after run completes", async () => {
      mockRunPhase
        .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
        .mockResolvedValueOnce(makePhaseResult("player-identification"))
        .mockResolvedValueOnce(makePhaseResult("baseline-model"));

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(mockRevalidation.onRunComplete).toHaveBeenCalled();
    });

    it("calls revalidationService.onRunComplete even after failure", async () => {
      mockRunPhase.mockResolvedValueOnce(
        makeFailedResult("Unauthorized: invalid key"),
      );

      await orchestrator.runFull("Test topic");
      await flushAsync();

      expect(mockRevalidation.onRunComplete).toHaveBeenCalled();
    });
  });
});
