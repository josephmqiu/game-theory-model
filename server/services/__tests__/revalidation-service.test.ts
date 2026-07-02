import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAnalysisRuntime } from "../../../shared/types/analysis-runtime";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import { RUNNABLE_PHASES } from "../../../shared/types/methodology";
import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../../shared/types/entity";
import type { PhaseOutputEntity, PhaseResult } from "../analysis-service";
import * as runtimeStatus from "../runtime-status";

// ── Mock analysis-service ──

const mockRunPhase = vi.fn<
  (
    phase: MethodologyPhase,
    topic: string,
    context?: {
      priorEntities?: string;
      revisionRetryInstruction?: string;
      provider?: string;
      model?: string;
      runtime?: ResolvedAnalysisRuntime;
      runId?: string;
      signal?: AbortSignal;
    },
  ) => Promise<PhaseResult>
>();

vi.mock("../analysis-service", () => ({
  runPhase: (...args: Parameters<typeof mockRunPhase>) => mockRunPhase(...args),
}));

const mockCommitPhaseSnapshot = vi.fn(
  ({
    entities,
    relationships,
  }: {
    entities: PhaseOutputEntity[];
    relationships: Array<{ type: string }>;
  }) => ({
    status: "applied" as const,
    summary: {
      entitiesCreated: entities.filter((entity) => entity.id === null).length,
      entitiesUpdated: entities.filter((entity) => entity.id !== null).length,
      entitiesDeleted: 0,
      relationshipsCreated: relationships.length,
      relationshipsDeleted: 0,
      currentPhaseEntityIds: ["phase-entity-1", "phase-entity-2"],
    },
  }),
);

vi.mock("../revision-diff", () => ({
  commitPhaseSnapshot: (...args: Parameters<typeof mockCommitPhaseSnapshot>) =>
    mockCommitPhaseSnapshot(...args),
}));

// ── Mock analysis-orchestrator ──

const mockIsRunning = vi.fn<() => boolean>().mockReturnValue(false);

vi.mock("../../agents/analysis-agent", () => ({
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
  clearStale: vi.fn(),
  removePhaseEntities: vi.fn(),
  markStale: vi.fn(),
  onMutation: vi.fn((_cb: (event: unknown) => void) => vi.fn()),
  getEntityById: vi.fn((id: string): AnalysisEntity | null => {
    return (
      mockEntityGraph.getAnalysis().entities.find((e) => e.id === id) ?? null
    );
  }),
  getPendingChallenges: vi.fn(() => [] as ReturnType<typeof buildChallenge>[]),
  resolveChallenge: vi.fn(),
};

function buildChallenge(overrides: {
  id?: string;
  entityId: string;
  objection?: string;
}) {
  return {
    id: overrides.id ?? `challenge-${overrides.entityId}`,
    entityId: overrides.entityId,
    objection: overrides.objection ?? "This entity misreads the evidence.",
    createdAt: Date.now(),
    status: "pending" as const,
    viewed: false,
  };
}

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
  const entities: PhaseOutputEntity[] = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push({
      id: null,
      ref: `${phase}-${i}`,
      type: "fact",
      phase,
      data: {
        type: "fact",
        date: "2026-03-19",
        source: "test",
        content: `Entity ${phase}-${i}`,
        category: "action",
      },
      confidence: "high",
      rationale: "test",
    } as PhaseOutputEntity);
  }
  return { success: true, entities, relationships: [] };
}

function makeFailedResult(error: string): PhaseResult {
  return { success: false, entities: [], relationships: [], error };
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

  it("re-queues stale ids when revalidation is already active", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhase.mockResolvedValue(makePhaseResult("situational-grounding"));

    expect(
      runtimeStatus.acquireRun("revalidation", "existing-reval", {
        totalPhases: 1,
      }),
    ).toBe(true);

    revalidation.scheduleRevalidation(["e1"]);

    await vi.advanceTimersByTimeAsync(2000);

    expect(mockRunPhase).not.toHaveBeenCalled();
    expect(revalidation._getPendingStaleIds()).toEqual(new Set(["e1"]));

    runtimeStatus.releaseRun("existing-reval", "completed");
    await vi.advanceTimersByTimeAsync(2000);

    expect(mockRunPhase).toHaveBeenCalled();
    expect(revalidation._getPendingStaleIds().size).toBe(0);
  });

  // ── 4. onRunComplete preserves deferred revalidation for explicit user action ──

  it("onRunComplete does not auto-start deferred revalidation", async () => {
    mockIsRunning.mockReturnValue(true);

    // Schedule while running — gets deferred
    revalidation.scheduleRevalidation(["e1"]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockRunPhase).not.toHaveBeenCalled();

    // Run completes
    mockIsRunning.mockReturnValue(false);
    revalidation.onRunComplete();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunPhase).not.toHaveBeenCalled();
    expect(revalidation._getDeferredStaleIds()).toEqual(new Set(["e1"]));
  });

  it("preserves deferred stale ids for subset runs instead of auto-clearing them", async () => {
    mockIsRunning.mockReturnValue(true);

    revalidation.scheduleRevalidation(["e1", "e2"]);
    await vi.advanceTimersByTimeAsync(5000);

    expect(revalidation._getDeferredStaleIds().size).toBe(2);
    expect(revalidation._getPendingStaleIds().size).toBe(0);

    mockIsRunning.mockReturnValue(false);
    revalidation.onRunComplete(
      "openai",
      "gpt-5.4",
      { webSearch: false, effortLevel: "thorough" },
      false,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunPhase).not.toHaveBeenCalled();
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
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    const result = revalidation.revalidate(["e1", "e2"]);

    expect(result.runId).toMatch(/^reval-/);

    // Flush microtasks to let async execution complete
    await vi.advanceTimersByTimeAsync(0);

    // Should run from player-identification (earliest) through the FULL
    // runnable ladder — all the way to meta-check, not a truncated subset.
    const expectedPhases = RUNNABLE_PHASES.slice(
      RUNNABLE_PHASES.indexOf("player-identification"),
    );
    expect(mockRunPhase).toHaveBeenCalledTimes(expectedPhases.length);
    expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual(
      expectedPhases,
    );
    expect(mockRunPhase.mock.calls.at(-1)?.[0]).toBe("meta-check");
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
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    const result = revalidation.revalidate(undefined, "baseline-model");

    expect(result.runId).toMatch(/^reval-/);

    // Flush microtasks to let async execution complete
    await vi.advanceTimersByTimeAsync(0);

    // Should run baseline-model through meta-check (7 runnable phases)
    const expectedPhases = RUNNABLE_PHASES.slice(
      RUNNABLE_PHASES.indexOf("baseline-model"),
    );
    expect(mockRunPhase).toHaveBeenCalledTimes(expectedPhases.length);
    expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual(
      expectedPhases,
    );
  });

  // ── 7. Returns runId ──

  it("revalidate returns a runId", () => {
    const result = revalidation.revalidate();
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
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    const events: AnalysisProgressEvent[] = [];
    const unsubscribe = revalidation.onProgress((event) => events.push(event));

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await vi.advanceTimersByTimeAsync(0);

    unsubscribe();

    // Should have phase_started + phase_completed for every runnable phase
    const started = events.filter((e) => e.type === "phase_started");
    const completed = events.filter((e) => e.type === "phase_completed");

    expect(started).toHaveLength(RUNNABLE_PHASES.length);
    expect(completed).toHaveLength(RUNNABLE_PHASES.length);
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

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await vi.advanceTimersByTimeAsync(0);

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

  it("reuses the last resolved runtime for revalidation phase reruns", async () => {
    revalidation.onRunComplete("openai", "gpt-5.4", {
      webSearch: false,
      effortLevel: "thorough",
    });
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    mockRunPhase.mockResolvedValue(makePhaseResult("situational-grounding"));

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunPhase.mock.calls[0][2]).toMatchObject({
      provider: "openai",
      model: "gpt-5.4",
      runtime: { webSearch: false, effortLevel: "thorough" },
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
    await vi.advanceTimersByTimeAsync(0);

    expect(result.runId).toMatch(/^reval-/);
    expect(mockRunPhase).not.toHaveBeenCalled();

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
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    revalidation.revalidate(["e1"]);

    // Flush microtasks to let async execution complete
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.removePhaseEntities).not.toHaveBeenCalled();
    expect(mockCommitPhaseSnapshot).toHaveBeenCalledTimes(
      RUNNABLE_PHASES.length,
    );
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
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    const { runId } = revalidation.revalidate(["e1"]);

    // Before microtask flush, status should be "running"
    const statusBefore = revalidation.getRevalStatus(runId);
    expect(statusBefore).not.toBeNull();
    expect(statusBefore!.status).toBe("running");

    // Flush microtasks
    await vi.advanceTimersByTimeAsync(0);

    // After completion, status should be "completed"
    const statusAfter = revalidation.getRevalStatus(runId);
    expect(statusAfter).not.toBeNull();
    expect(statusAfter!.status).toBe("completed");
    expect(statusAfter!.phasesCompleted).toBe(RUNNABLE_PHASES.length);
  });

  // ── 17. getRevalStatus returns null for unknown runIds ──

  it("getRevalStatus returns null for unknown runId", () => {
    expect(revalidation.getRevalStatus("unknown-id")).toBeNull();
  });

  // ── 18. Revalidation clears stale on surviving entities after diff commit ──

  it("clears stale flags for the surviving current-phase entity ids returned by revision diff", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("e1", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });

    const phaseResult: PhaseResult = {
      success: true,
      entities: [
        {
          id: null,
          ref: "fact-1",
          type: "fact",
          phase: "situational-grounding",
          data: {
            type: "fact",
            date: "2026-03-19",
            source: "test",
            content: "Entity fact-1",
            category: "action",
          },
          confidence: "high",
          rationale: "test",
        },
      ],
      relationships: [
        {
          id: "rel-1",
          type: "precedes",
          fromEntityId: "fact-1",
          toEntityId: "fact-1",
        },
      ] as AnalysisRelationship[],
    };
    mockRunPhase
      .mockResolvedValueOnce(phaseResult)
      .mockImplementation(async (phase) => makePhaseResult(phase));

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.clearStale).toHaveBeenCalledWith([
      "phase-entity-1",
      "phase-entity-2",
    ]);
    expect(mockCommitPhaseSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "situational-grounding",
        relationships: [
          expect.objectContaining({
            type: "precedes",
            fromEntityId: "fact-1",
            toEntityId: "fact-1",
          }),
        ],
      }),
    );
  });

  // ── 19. CRITICAL regression: late-ladder phases must revalidate ──
  //
  // The service previously selected phases from a truncated ladder
  // (V2_PHASES) that ended at "assumptions". A stale entity in
  // elimination/scenarios/meta-check produced an empty phase list, so the
  // run completed as a silent no-op and the entity stayed stale forever.

  it.each(["elimination", "scenarios", "meta-check"] as const)(
    "re-runs from %s when a stale entity lives in a late-ladder phase",
    async (stalePhase) => {
      mockEntityGraph.getAnalysis.mockReturnValue({
        id: "test",
        name: "test",
        topic: "test topic",
        entities: [makeEntity("late-1", stalePhase, true)],
        relationships: [],
        phases: [],
      });
      mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

      const { runId } = revalidation.revalidate(["late-1"]);
      await vi.advanceTimersByTimeAsync(0);

      const expectedPhases = RUNNABLE_PHASES.slice(
        RUNNABLE_PHASES.indexOf(stalePhase),
      );
      expect(expectedPhases.length).toBeGreaterThan(0);
      expect(mockRunPhase.mock.calls.map((call) => call[0])).toEqual(
        expectedPhases,
      );

      const status = revalidation.getRevalStatus(runId);
      expect(status).toMatchObject({
        status: "completed",
        phasesCompleted: expectedPhases.length,
      });
    },
  );

  // ── 20. Ladder sanity: the runnable ladder reaches meta-check ──

  it("uses the full 9-phase runnable ladder ending in meta-check", () => {
    expect(RUNNABLE_PHASES).toHaveLength(9);
    expect(RUNNABLE_PHASES.at(-1)).toBe("meta-check");
    expect(RUNNABLE_PHASES).not.toContain("revalidation");
  });

  // ── 21. Challenges: objection injection (9A) + resolution (2.2A) ──

  it("injects the objection into the challenged phase's prompt context", async () => {
    const challengedEntity = makeEntity("e1", "situational-grounding", true);
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [challengedEntity],
      relationships: [],
      phases: [],
    });
    mockEntityGraph.getPendingChallenges.mockReturnValue([
      buildChallenge({
        entityId: "e1",
        objection: "The tariff figure is stale.",
      }),
    ]);
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    // Challenged entity lives in phase 1 → objection goes to phase 1 only
    const firstCallContext = mockRunPhase.mock.calls[0][2] as {
      challengeContext?: string;
    };
    expect(firstCallContext.challengeContext).toContain("HUMAN CHALLENGES");
    expect(firstCallContext.challengeContext).toContain(
      "The tariff figure is stale.",
    );
    expect(firstCallContext.challengeContext).toContain(
      "rationale` field MUST directly address the objection",
    );

    const secondCallContext = mockRunPhase.mock.calls[1][2] as {
      challengeContext?: string;
    };
    expect(secondCallContext.challengeContext).toBeUndefined();
  });

  it("passes pending challenge entity ids into revision diff commits", async () => {
    const challengedEntity = makeEntity("e1", "situational-grounding", true);
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [challengedEntity],
      relationships: [],
      phases: [],
    });
    mockEntityGraph.getPendingChallenges.mockReturnValue([
      buildChallenge({ id: "ch-ids", entityId: "e1" }),
    ]);
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    const firstCommitInput = mockCommitPhaseSnapshot.mock.calls[0][0] as {
      challengedEntityIds?: ReadonlySet<string>;
    };
    expect(Array.from(firstCommitInput.challengedEntityIds ?? [])).toEqual([
      "e1",
    ]);
  });

  it("resolves a challenge as REVISED when the re-run changed the entity", async () => {
    let capturedRunId: string | undefined;
    const challengedEntity = makeEntity("e1", "situational-grounding", true);
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [challengedEntity],
      relationships: [],
      phases: [],
    });
    mockEntityGraph.getPendingChallenges.mockReturnValue([
      buildChallenge({ id: "ch-1", entityId: "e1" }),
    ]);
    mockRunPhase.mockImplementation(async (phase, _topic, context) => {
      capturedRunId = context?.runId;
      return makePhaseResult(phase);
    });
    mockEntityGraph.getEntityById.mockImplementation((id: string) => {
      if (id !== "e1") return null;
      return {
        ...challengedEntity,
        rationale: "Revised: the objection was correct about the rate.",
        revisionLog: [
          {
            logNo: 7,
            ts: 1,
            logSource: "revalidation" as const,
            runId: capturedRunId,
            fieldDiffs: [{ field: "data.content", old: '"old"', new: '"new"' }],
          },
        ],
      };
    });

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.resolveChallenge).toHaveBeenCalledWith("ch-1", {
      outcome: "REVISED",
      runId: capturedRunId,
      responseLogNo: 7,
      responseRationale: "Revised: the objection was correct about the rate.",
    });
  });

  it("resolves a challenge as CONFIRMED when the re-run kept the entity unchanged", async () => {
    const challengedEntity = makeEntity("e1", "situational-grounding", true);
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [challengedEntity],
      relationships: [],
      phases: [],
    });
    mockEntityGraph.getPendingChallenges.mockReturnValue([
      buildChallenge({ id: "ch-2", entityId: "e1" }),
    ]);
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));
    mockEntityGraph.getEntityById.mockImplementation((id: string) =>
      id === "e1"
        ? {
            ...challengedEntity,
            rationale: "Confirmed: evidence still supports this.",
            revisionLog: [],
          }
        : null,
    );

    revalidation.revalidate(["e1"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.resolveChallenge).toHaveBeenCalledWith(
      "ch-2",
      expect.objectContaining({
        outcome: "CONFIRMED",
        responseRationale: "Confirmed: evidence still supports this.",
      }),
    );
  });

  it("resolves a challenge as REMOVED when the entity no longer exists", async () => {
    mockEntityGraph.getAnalysis.mockReturnValue({
      id: "test",
      name: "test",
      topic: "test topic",
      entities: [makeEntity("other", "situational-grounding", true)],
      relationships: [],
      phases: [],
    });
    // Challenge targets an entity that is already gone — no phase to attach
    // to, so it resolves in the end-of-run sweep.
    mockEntityGraph.getPendingChallenges.mockReturnValue([
      buildChallenge({ id: "ch-3", entityId: "deleted-entity" }),
    ]);
    mockRunPhase.mockImplementation(async (phase) => makePhaseResult(phase));

    revalidation.revalidate(["other"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEntityGraph.resolveChallenge).toHaveBeenCalledWith(
      "ch-3",
      expect.objectContaining({ outcome: "REMOVED" }),
    );
  });
});
