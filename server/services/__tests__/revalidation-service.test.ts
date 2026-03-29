import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type { AnalysisEntity } from "../../../shared/types/entity";
import * as runtimeStatus from "../runtime-status";
import { getWorkspaceDatabase, resetWorkspaceDatabaseForTest } from "../workspace";

// ── Mock analysis-service ──

const mockRunPhaseWithTools = vi.fn<
  (...args: unknown[]) => Promise<{
    success: boolean;
    error?: string;
    entitiesCreated: number;
    entitiesUpdated: number;
    entitiesDeleted: number;
    relationshipsCreated: number;
    phaseCompleted: boolean;
  }>
>();

vi.mock("../analysis-service", () => ({
  runPhaseWithTools: (...args: unknown[]) => mockRunPhaseWithTools(...args),
}));

// ── Mock claude-adapter (tool MCP server factory) ──

vi.mock("../ai/claude-adapter", () => ({
  createToolBasedAnalysisMcpServer: vi.fn(async () => ({})),
}));

const mockBeginPhaseTransaction = vi.fn();
const mockCommitPhaseTransaction = vi.fn(() => ({
  entitiesCreated: 0,
  entitiesUpdated: 0,
  entitiesDeleted: 0,
  relationshipsCreated: 0,
  relationshipsDeleted: 0,
  currentPhaseEntityIds: ["phase-entity-1", "phase-entity-2"],
}));
const mockRollbackPhaseTransaction = vi.fn();

vi.mock("../revision-diff", () => ({
  beginPhaseTransaction: (...args: unknown[]) =>
    mockBeginPhaseTransaction(...args),
  commitPhaseTransaction: (..._args: unknown[]) => mockCommitPhaseTransaction(),
  rollbackPhaseTransaction: () => mockRollbackPhaseTransaction(),
}));

// ── Mock analysis-orchestrator ──

const mockIsRunning = vi.fn<() => boolean>().mockReturnValue(false);

vi.mock("../../agents/analysis-agent", () => ({
  isRunning: () => mockIsRunning(),
}));

// ── Mock entity-graph-service ──

const mockEntityGraph = vi.hoisted(() => ({
  getAnalysis: vi.fn(() => ({
    id: "test",
    name: "test",
    topic: "test topic",
    entities: [] as import("../../../shared/types/entity").AnalysisEntity[],
    relationships:
      [] as import("../../../shared/types/entity").AnalysisRelationship[],
    phases: [],
  })),
  getStaleEntityIds: vi.fn(() => [] as string[]),
  clearStale: vi.fn(),
  removePhaseEntities: vi.fn(),
  setPhaseStatus: vi.fn(),
  getEntitiesByPhase: vi.fn((): AnalysisEntity[] => []),
  markStale: vi.fn(),
  onMutation: vi.fn((_cb: (event: unknown) => void) => vi.fn()),
}));

vi.mock("../entity-graph-service", () => mockEntityGraph);

// ── Test fixtures ──

function makeEntity(
  id: string,
  phase: MethodologyPhase,
  stale = false,
): AnalysisEntity {
  return {
    id,
    type: "fact",
    phase,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: `Entity ${id}`,
      category: "action" as const,
    },
    confidence: "high",
    source: "ai",
    rationale: "test",
    revision: 1,
    stale,
    provenance: {
      source: "phase-derived",
      runId: "run-1",
      phase,
      timestamp: Date.now(),
    },
  } as AnalysisEntity;
}

function makeToolResult(_phase?: MethodologyPhase) {
  return {
    success: true,
    entitiesCreated: 1,
    entitiesUpdated: 0,
    entitiesDeleted: 0,
    relationshipsCreated: 0,
    phaseCompleted: true,
  };
}

function makeFailedToolResult(error: string) {
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

async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  // Each phase requires multiple microtask rounds.
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
  }
}

// ── Tests ──

describe("revalidation-service", () => {
  async function importRevalidation() {
    return import("../revalidation-service");
  }

  let revalidation: Awaited<ReturnType<typeof importRevalidation>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsRunning.mockReturnValue(false);
    resetWorkspaceDatabaseForTest();
    revalidation = await importRevalidation();
    revalidation._resetForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. scheduleRevalidation triggers revalidation after 2s debounce ──

  it("scheduleRevalidation triggers revalidation after 2s debounce", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockResolvedValue(
      makeToolResult("situational-grounding"),
    );

    revalidation.scheduleRevalidation(["e1"]);

    // Not called yet — within debounce window
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Advance past the 2s debounce
    await advanceTimersByTimeAsync(2000);

    // Now revalidation should have triggered
    expect(mockRunPhaseWithTools).toHaveBeenCalled();
  });

  // ── 2. Multiple calls within 2s produce single revalidation with merged staleIds ──

  it("merges staleIds from multiple calls within 2s into one revalidation", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [
        makeEntity("e1", "situational-grounding", true),
        makeEntity("e2", "player-identification", true),
      ],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("situational-grounding"))
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"));

    // First call
    revalidation.scheduleRevalidation(["e1"]);

    // Wait 1s, then second call (still within 2s debounce)
    await advanceTimersByTimeAsync(1000);
    revalidation.scheduleRevalidation(["e2"]);

    // At 1s mark, no calls yet
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Advance the remaining 2s from the reset
    await advanceTimersByTimeAsync(2000);

    // Single revalidation that covers both IDs
    // It should find earliest stale phase (situational-grounding) and run from there
    expect(mockRunPhaseWithTools).toHaveBeenCalled();
    expect(mockRunPhaseWithTools.mock.calls[0][0]).toBe(
      "situational-grounding",
    );
  });

  // ── 3. Suppression: scheduleRevalidation during active analysis doesn't trigger ──

  it("suppresses revalidation during active analysis", async () => {
    mockIsRunning.mockReturnValue(true);

    revalidation.scheduleRevalidation(["e1", "e2"]);

    // Advance well past debounce
    await advanceTimersByTimeAsync(5000);

    // No revalidation triggered
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Stale IDs should be deferred
    const deferred = revalidation._getDeferredStaleIds();
    expect(deferred.has("e1")).toBe(true);
    expect(deferred.has("e2")).toBe(true);
  });

  it("re-queues stale ids when revalidation is already active", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockResolvedValue(
      makeToolResult("situational-grounding"),
    );

    expect(
      runtimeStatus.acquireRun("revalidation", "existing-reval", {
        totalPhases: 1,
      }),
    ).toBe(true);

    revalidation.scheduleRevalidation(["e1"]);

    await advanceTimersByTimeAsync(2000);

    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();
    expect(revalidation._getPendingStaleIds()).toEqual(new Set(["e1"]));

    runtimeStatus.releaseRun("existing-reval", "completed");
    await advanceTimersByTimeAsync(2000);

    expect(mockRunPhaseWithTools).toHaveBeenCalled();
    expect(revalidation._getPendingStaleIds().size).toBe(0);
  });

  // ── 4. onRunComplete preserves deferred revalidation for explicit user action ──

  it("onRunComplete does not auto-start deferred revalidation", async () => {
    mockIsRunning.mockReturnValue(true);

    // Schedule while running — gets deferred
    revalidation.scheduleRevalidation(["e1"]);

    await advanceTimersByTimeAsync(5000);
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Run completes
    mockIsRunning.mockReturnValue(false);
    revalidation.onRunComplete();
    await advanceTimersByTimeAsync(0);

    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();
    expect(revalidation._getDeferredStaleIds()).toEqual(new Set(["e1"]));
  });

  it("preserves deferred stale ids for subset runs instead of auto-clearing them", async () => {
    mockIsRunning.mockReturnValue(true);

    revalidation.scheduleRevalidation(["e1", "e2"]);
    await advanceTimersByTimeAsync(5000);

    expect(revalidation._getDeferredStaleIds().size).toBe(2);
    expect(revalidation._getPendingStaleIds().size).toBe(0);

    mockIsRunning.mockReturnValue(false);
    revalidation.onRunComplete(
      "codex",
      "gpt-5.4",
      { webSearch: false, effortLevel: "high" },
      false,
    );

    await advanceTimersByTimeAsync(0);

    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();
    expect(revalidation._getDeferredStaleIds().size).toBe(2);
    expect(revalidation._getPendingStaleIds().size).toBe(0);
  });

  // ── 5. revalidate(staleEntityIds) determines earliest stale phase ──

  it("revalidate determines earliest stale phase and re-runs from there", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [
        makeEntity("e1", "player-identification", true),
        makeEntity("e2", "baseline-model", true),
      ],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("formal-modeling"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    const result = revalidation.revalidate(["e1", "e2"]);

    expect(result.runId).toMatch(/^reval-/);

    // Flush microtasks to let async execution complete
    await advanceTimersByTimeAsync(0);

    // Should run from player-identification (earliest) through assumptions (5 V2 phases)
    expect(mockRunPhaseWithTools).toHaveBeenCalledTimes(5);
    expect(mockRunPhaseWithTools.mock.calls[0][0]).toBe(
      "player-identification",
    );
    expect(mockRunPhaseWithTools.mock.calls[1][0]).toBe("baseline-model");
    expect(mockRunPhaseWithTools.mock.calls[2][0]).toBe("historical-game");
    expect(mockRunPhaseWithTools.mock.calls[3][0]).toBe("formal-modeling");
    expect(mockRunPhaseWithTools.mock.calls[4][0]).toBe("assumptions");
  });

  // ── 6. revalidate(undefined, phase) re-runs from explicit phase ──

  it("revalidate with explicit phase re-runs from that phase", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("formal-modeling"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    const result = revalidation.revalidate(undefined, "baseline-model");

    expect(result.runId).toMatch(/^reval-/);

    // Flush microtasks to let async execution complete
    await advanceTimersByTimeAsync(0);

    // Should run baseline-model through assumptions (4 phases in V2)
    expect(mockRunPhaseWithTools).toHaveBeenCalledTimes(4);
    expect(mockRunPhaseWithTools.mock.calls[0][0]).toBe("baseline-model");
    expect(mockRunPhaseWithTools.mock.calls[1][0]).toBe("historical-game");
    expect(mockRunPhaseWithTools.mock.calls[2][0]).toBe("formal-modeling");
    expect(mockRunPhaseWithTools.mock.calls[3][0]).toBe("assumptions");
  });

  // ── 7. Returns runId ──

  it("revalidate returns a runId", () => {
    const result = revalidation.revalidate();
    expect(result.runId).toMatch(/^reval-/);
  });

  it("persists canonical thread turns for revalidation phases", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockImplementationOnce(async (...args: unknown[]) => {
      const context = args[4] as {
        onActivity?: (activity: {
          kind: "tool" | "note" | "web-search";
          message: string;
          toolName?: string;
        }) => void;
      };
      context.onActivity?.({
        kind: "tool",
        message: "Used query_entities",
        toolName: "query_entities",
      });
      return {
        success: true,
        entitiesCreated: 1,
        entitiesUpdated: 0,
        entitiesDeleted: 0,
        relationshipsCreated: 0,
        phaseCompleted: true,
        assistantResponse: "Revalidated assumptions.",
      };
    });

    const { runId } = revalidation.revalidate(undefined, "assumptions");
    await advanceTimersByTimeAsync(0);

    const database = getWorkspaceDatabase();
    const run = database.runs.getRunState(runId);
    expect(run?.kind).toBe("revalidation");

    const threadMessages = database.messages
      .listMessagesByThreadId(run!.threadId)
      .map((record) => JSON.parse(record.messageJson))
      .filter((message) => message.runId === runId);
    expect(threadMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          runId,
          phase: "assumptions",
          runKind: "revalidation",
          source: "analysis",
          kind: "user-turn",
        }),
        expect.objectContaining({
          role: "assistant",
          content: "Revalidated assumptions.",
          runId,
          phase: "assumptions",
          runKind: "revalidation",
          source: "analysis",
          kind: "assistant-turn",
        }),
      ]),
    );

    const activities = database.activities
      .listActivitiesByRunId(runId)
      .filter((activity) => activity.phase === "assumptions");
    expect(activities).toEqual([
      expect.objectContaining({
        runId,
        phase: "assumptions",
        scope: "analysis-phase",
        kind: "tool",
        message: "Used query_entities",
        toolName: "query_entities",
      }),
    ]);
  });

  // ── 8. Emits progress events during revalidation ──

  it("emits phase_started and phase_completed events", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("situational-grounding"))
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("formal-modeling"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = revalidation.onProgress((event) => events.push(event));

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await advanceTimersByTimeAsync(0);

    unsubscribe();

    // Should have phase_started + phase_completed for each of the 6 phases
    const started = events.filter((e) => e.type === "phase_started");
    const completed = events.filter((e) => e.type === "phase_completed");

    expect(started).toHaveLength(6);
    expect(completed).toHaveLength(6);
    expect(started[0]).toMatchObject({
      type: "phase_started",
      phase: "situational-grounding",
    });
  });

  // ── 9. Emits analysis_failed on phase failure ──

  it("emits analysis_failed and stops on phase failure", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockResolvedValueOnce(
      makeFailedToolResult("API error"),
    );

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = revalidation.onProgress((event) => events.push(event));

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await advanceTimersByTimeAsync(0);

    unsubscribe();

    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      error: expect.objectContaining({ message: "API error" }),
    });

    // Should not continue to subsequent phases
    expect(mockRunPhaseWithTools).toHaveBeenCalledTimes(1);
  });

  // ── 10. wire() subscribes to stale_marked events ──

  it("wire subscribes to entity-graph-service stale_marked events", () => {
    revalidation.wire();

    expect(mockEntityGraph.onMutation).toHaveBeenCalledTimes(1);
    expect(typeof mockEntityGraph.onMutation.mock.calls[0][0]).toBe("function");
  });

  // ── 11. wire() is idempotent ──

  it("wire is idempotent — calling twice does not double-subscribe", () => {
    revalidation.wire();
    revalidation.wire();

    expect(mockEntityGraph.onMutation).toHaveBeenCalledTimes(1);
  });

  // ── 12. Debounce timer resets on second call ──

  it("debounce timer resets when scheduleRevalidation called again", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockResolvedValue(
      makeToolResult("situational-grounding"),
    );

    revalidation.scheduleRevalidation(["e1"]);

    // Advance 1.5s (within 2s window)
    await advanceTimersByTimeAsync(1500);
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Second call resets the timer
    revalidation.scheduleRevalidation(["e1"]);

    // Advance another 1.5s — total 3s from first, but only 1.5s from reset
    await advanceTimersByTimeAsync(1500);
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // Advance remaining 0.5s to hit 2s from reset
    await advanceTimersByTimeAsync(500);
    expect(mockRunPhaseWithTools).toHaveBeenCalled();
  });

  // ── 13. onRunComplete does nothing with no deferred IDs ──

  it("onRunComplete does nothing when there are no deferred staleIds", () => {
    revalidation.onRunComplete();
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();
  });

  it("reuses the last resolved runtime for revalidation phase reruns", async () => {
    revalidation.onRunComplete("codex", "gpt-5.4", {
      webSearch: false,
      effortLevel: "high",
    });
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools.mockResolvedValue(
      makeToolResult("situational-grounding"),
    );

    revalidation.revalidate(["e1"]);
    await advanceTimersByTimeAsync(0);

    expect(mockRunPhaseWithTools.mock.calls[0][4]).toMatchObject({
      provider: "codex",
      model: "gpt-5.4",
      runtime: { webSearch: false, effortLevel: "high" },
    });
  });

  // ── 14. revalidate with no stale entities returns immediately ──

  it("revalidate returns early when no stale phase can be determined", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [],
      relationships: [],
      phases: [],
    });
    mockEntityGraph.getStaleEntityIds.mockReturnValue([]);

    const result = revalidation.revalidate();

    // Flush microtasks
    await advanceTimersByTimeAsync(0);

    expect(result.runId).toMatch(/^reval-/);
    expect(mockRunPhaseWithTools).not.toHaveBeenCalled();

    // H1: status should be "completed" for no-op revalidation
    const status = revalidation.getRevalStatus(result.runId);
    expect(status).not.toBeNull();
    expect(status!.status).toBe("completed");
  });

  // ── 15. revalidate commits via revision diff without clearing phases directly ──

  it("commits rerun phases through revision diff without calling removePhaseEntities", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("situational-grounding"))
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("formal-modeling"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.removePhaseEntities).not.toHaveBeenCalled();
    expect(mockCommitPhaseTransaction).toHaveBeenCalledTimes(6);
  });

  // ── 16. getRevalStatus returns status for tracked runs ──

  it("getRevalStatus returns running/completed status", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("situational-grounding"))
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    const { runId } = revalidation.revalidate(["e1"]);

    // Before microtask flush, status should be "running"
    const statusBefore = revalidation.getRevalStatus(runId);
    expect(statusBefore).not.toBeNull();
    expect(statusBefore!.status).toBe("running");

    // Flush microtasks
    await advanceTimersByTimeAsync(0);

    // After completion, status should be "completed"
    const statusAfter = revalidation.getRevalStatus(runId);
    expect(statusAfter).not.toBeNull();
    expect(statusAfter!.status).toBe("completed");
    expect(statusAfter!.phasesCompleted).toBe(6);
  });

  // ── 17. getRevalStatus returns null for unknown runIds ──

  it("getRevalStatus returns null for unknown runId", () => {
    expect(revalidation.getRevalStatus("unknown-id")).toBeNull();
  });

  // ── 18. Revalidation clears stale on surviving entities after diff commit ──

  it("clears stale flags for the surviving current-phase entity ids after phase execution", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });

    // Make getEntitiesByPhase return entities so clearStale gets called
    mockEntityGraph.getEntitiesByPhase.mockReturnValue([
      { id: "phase-entity-1" } as AnalysisEntity,
      { id: "phase-entity-2" } as AnalysisEntity,
    ]);

    mockRunPhaseWithTools
      .mockResolvedValueOnce(makeToolResult("situational-grounding"))
      .mockResolvedValueOnce(makeToolResult("player-identification"))
      .mockResolvedValueOnce(makeToolResult("baseline-model"))
      .mockResolvedValueOnce(makeToolResult("historical-game"))
      .mockResolvedValueOnce(makeToolResult("formal-modeling"))
      .mockResolvedValueOnce(makeToolResult("assumptions"));

    revalidation.revalidate(["e1"]);
    await advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.clearStale).toHaveBeenCalledWith([
      "phase-entity-1",
      "phase-entity-2",
    ]);
    expect(mockBeginPhaseTransaction).toHaveBeenCalledWith(
      "situational-grounding",
      expect.any(String),
    );
    expect(mockCommitPhaseTransaction).toHaveBeenCalled();
  });
});
