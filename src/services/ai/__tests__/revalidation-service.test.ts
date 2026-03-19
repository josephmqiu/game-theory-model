import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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

// ── Mock analysis-orchestrator ──

const mockIsRunning = vi.fn<() => boolean>().mockReturnValue(false);

vi.mock("@/services/ai/analysis-orchestrator", () => ({
  isRunning: () => mockIsRunning(),
}));

// ── Mock entity-graph-service ──

const mockEntityGraph = {
  getAnalysis: vi.fn(() => ({
    id: "test",
    name: "test",
    topic: "test topic",
    entities: [] as AnalysisEntity[],
    relationships: [] as AnalysisRelationship[],
    phases: [],
  })),
  getStaleEntityIds: vi.fn(() => [] as string[]),
  getEntitiesByPhase: vi.fn(() => [] as AnalysisEntity[]),
  clearStale: vi.fn(),
  createEntity: vi.fn((data: Record<string, unknown>) => ({
    ...data,
    id: `gen-${Math.random().toString(36).slice(2, 6)}`,
  })),
  markStale: vi.fn(),
  onMutation: vi.fn((_cb: (event: unknown) => void) => vi.fn()),
};

vi.mock("@/services/ai/entity-graph-service", () => mockEntityGraph);

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
    position: { x: 0, y: 0 },
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

function makePhaseResult(
  phase: MethodologyPhase,
  entityCount = 1,
): PhaseResult {
  const entities: AnalysisEntity[] = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push(makeEntity(`${phase}-${i}`, phase));
  }
  return { success: true, entities, relationships: [] };
}

function makeFailedResult(error: string): PhaseResult {
  return { success: false, entities: [], relationships: [], error };
}

// ── Tests ──

describe("revalidation-service", () => {
  async function importRevalidation() {
    return import("@/services/ai/revalidation-service");
  }

  let revalidation: Awaited<ReturnType<typeof importRevalidation>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsRunning.mockReturnValue(false);
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
    mockRunPhase.mockResolvedValue(makePhaseResult("situational-grounding"));

    revalidation.scheduleRevalidation(["e1"]);

    // Not called yet — within debounce window
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Advance past the 2s debounce
    await vi.advanceTimersByTimeAsync(2000);

    // Now revalidation should have triggered
    expect(mockRunPhase).toHaveBeenCalled();
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
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    // First call
    revalidation.scheduleRevalidation(["e1"]);

    // Wait 1s, then second call (still within 2s debounce)
    await vi.advanceTimersByTimeAsync(1000);
    revalidation.scheduleRevalidation(["e2"]);

    // At 1s mark, no calls yet
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Advance the remaining 2s from the reset
    await vi.advanceTimersByTimeAsync(2000);

    // Single revalidation that covers both IDs
    // It should find earliest stale phase (situational-grounding) and run from there
    expect(mockRunPhase).toHaveBeenCalled();
    expect(mockRunPhase.mock.calls[0][0]).toBe("situational-grounding");
  });

  // ── 3. Suppression: scheduleRevalidation during active analysis doesn't trigger ──

  it("suppresses revalidation during active analysis", async () => {
    mockIsRunning.mockReturnValue(true);

    revalidation.scheduleRevalidation(["e1", "e2"]);

    // Advance well past debounce
    await vi.advanceTimersByTimeAsync(5000);

    // No revalidation triggered
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Stale IDs should be deferred
    const deferred = revalidation._getDeferredStaleIds();
    expect(deferred.has("e1")).toBe(true);
    expect(deferred.has("e2")).toBe(true);
  });

  // ── 4. onRunComplete triggers deferred revalidation ──

  it("onRunComplete triggers deferred revalidation", async () => {
    mockIsRunning.mockReturnValue(true);

    // Schedule while running — gets deferred
    revalidation.scheduleRevalidation(["e1"]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Run completes
    mockIsRunning.mockReturnValue(false);
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhase.mockResolvedValue(makePhaseResult("situational-grounding"));

    revalidation.onRunComplete();

    // Should trigger revalidation with deferred IDs
    // Allow the async revalidate to execute
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunPhase).toHaveBeenCalled();

    // Deferred IDs should be cleared
    expect(revalidation._getDeferredStaleIds().size).toBe(0);
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
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const result = await revalidation.revalidate(["e1", "e2"]);

    expect(result.runId).toMatch(/^reval-/);

    // Should run from player-identification (earliest) through baseline-model
    expect(mockRunPhase).toHaveBeenCalledTimes(2);
    expect(mockRunPhase.mock.calls[0][0]).toBe("player-identification");
    expect(mockRunPhase.mock.calls[1][0]).toBe("baseline-model");
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
    mockRunPhase.mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const result = await revalidation.revalidate(undefined, "baseline-model");

    expect(result.runId).toMatch(/^reval-/);

    // Should only run baseline-model (last phase, nothing after it in V1)
    expect(mockRunPhase).toHaveBeenCalledTimes(1);
    expect(mockRunPhase.mock.calls[0][0]).toBe("baseline-model");
  });

  // ── 7. Returns runId ──

  it("revalidate returns a runId", async () => {
    const result = await revalidation.revalidate();
    expect(result.runId).toMatch(/^reval-/);
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
    mockRunPhase
      .mockResolvedValueOnce(makePhaseResult("situational-grounding"))
      .mockResolvedValueOnce(makePhaseResult("player-identification"))
      .mockResolvedValueOnce(makePhaseResult("baseline-model"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = revalidation.onProgress((event) => events.push(event));

    await revalidation.revalidate(["e1"]);

    unsubscribe();

    // Should have phase_started + phase_completed for each of the 3 phases
    const started = events.filter((e) => e.type === "phase_started");
    const completed = events.filter((e) => e.type === "phase_completed");

    expect(started).toHaveLength(3);
    expect(completed).toHaveLength(3);
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
    mockRunPhase.mockResolvedValueOnce(makeFailedResult("API error"));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = revalidation.onProgress((event) => events.push(event));

    await revalidation.revalidate(["e1"]);

    unsubscribe();

    const failEvents = events.filter((e) => e.type === "analysis_failed");
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]).toMatchObject({
      type: "analysis_failed",
      error: "API error",
    });

    // Should not continue to subsequent phases
    expect(mockRunPhase).toHaveBeenCalledTimes(1);
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
    mockRunPhase.mockResolvedValue(makePhaseResult("situational-grounding"));

    revalidation.scheduleRevalidation(["e1"]);

    // Advance 1.5s (within 2s window)
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Second call resets the timer
    revalidation.scheduleRevalidation(["e1"]);

    // Advance another 1.5s — total 3s from first, but only 1.5s from reset
    await vi.advanceTimersByTimeAsync(1500);
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Advance remaining 0.5s to hit 2s from reset
    await vi.advanceTimersByTimeAsync(500);
    expect(mockRunPhase).toHaveBeenCalled();
  });

  // ── 13. onRunComplete does nothing with no deferred IDs ──

  it("onRunComplete does nothing when there are no deferred staleIds", () => {
    revalidation.onRunComplete();
    expect(mockRunPhase).not.toHaveBeenCalled();
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

    const result = await revalidation.revalidate();

    expect(result.runId).toMatch(/^reval-/);
    expect(mockRunPhase).not.toHaveBeenCalled();
  });
});
