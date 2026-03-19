import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRunLogger } from "@/services/ai/ai-logger";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { OrchestratorCallbacks } from "@/services/ai/methodology-orchestrator";

vi.mock("@/services/ai/ai-service", () => ({
  generateCompletion: vi.fn(),
}));

vi.mock("@/stores/ai-store", () => ({
  useAIStore: {
    getState: () => ({ model: "claude-sonnet-4-5-20250514", modelGroups: [] }),
  },
}));

import { generateCompletion } from "@/services/ai/ai-service";
import {
  revalidateStaleEntities,
  runMethodologyAnalysis,
} from "@/services/ai/methodology-orchestrator";

const mockGenerateCompletion = vi.mocked(generateCompletion);

const PHASE_1_RESPONSE = JSON.stringify({
  entities: [
    {
      id: "fact-1",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2025-06-15",
        source: "Reuters",
        content: "Country A imposed tariffs on Country B",
        category: "action",
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Confirmed by official records",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [],
});

const PHASE_2_RESPONSE = JSON.stringify({
  entities: [
    {
      id: "player-a",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "Country A",
        playerType: "primary",
        knowledge: ["Tariff schedule"],
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Initiator of the tariff action",
      revision: 1,
      stale: false,
    },
    {
      id: "obj-a1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Protect domestic industry",
        priority: "high",
        stability: "stable",
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Stated policy goal",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [
    {
      id: "rel-1",
      type: "has-objective",
      fromEntityId: "player-a",
      toEntityId: "obj-a1",
    },
  ],
});

const PHASE_3_RESPONSE = JSON.stringify({
  entities: [
    {
      id: "game-1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Trade War",
        gameType: "chicken",
        timing: "sequential",
        description: "Escalation game",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale: "Fits chicken structure",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [],
});

const EMPTY_PHASE_RESPONSE = JSON.stringify({
  entities: [],
  relationships: [],
});

function createCallbacks(
  overrides: Partial<OrchestratorCallbacks> = {},
): OrchestratorCallbacks {
  return {
    onPhaseStart: vi.fn(),
    onPhaseComplete: vi.fn(),
    onPhaseFailed: vi.fn(),
    ...overrides,
  };
}

function createRunContext(runId = "test-run") {
  return {
    runId,
    logger: createRunLogger(runId),
  };
}

function makeAbortSignal(): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController();
  return { signal: controller.signal, abort: () => controller.abort() };
}

describe("methodology orchestrator", () => {
  beforeEach(() => {
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
    useEntityGraphStore.getState().newAnalysis("Test topic");
    mockGenerateCompletion.mockReset();
  });

  it("returns success after running all 3 phases in order", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockResolvedValueOnce(PHASE_2_RESPONSE)
      .mockResolvedValueOnce(PHASE_3_RESPONSE);

    const callbacks = createCallbacks();
    const { signal } = makeAbortSignal();

    const result = await runMethodologyAnalysis({
      topic: "US-China trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result).toEqual({
      status: "success",
      phasesCompleted: 3,
      totalEntities: 4,
      runId: "test-run",
    });
    expect(callbacks.onPhaseStart).toHaveBeenNthCalledWith(
      1,
      "situational-grounding",
    );
    expect(callbacks.onPhaseStart).toHaveBeenNthCalledWith(
      2,
      "player-identification",
    );
    expect(callbacks.onPhaseStart).toHaveBeenNthCalledWith(
      3,
      "baseline-model",
    );
    expect(callbacks.onPhaseComplete).toHaveBeenNthCalledWith(
      1,
      "situational-grounding",
      1,
    );
    expect(callbacks.onPhaseComplete).toHaveBeenNthCalledWith(
      2,
      "player-identification",
      2,
    );
    expect(callbacks.onPhaseComplete).toHaveBeenNthCalledWith(
      3,
      "baseline-model",
      1,
    );
    expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();

    const { analysis } = useEntityGraphStore.getState();
    expect(analysis.entities).toHaveLength(4);
    expect(
      analysis.phases
        .filter((phase) => phase.status === "complete")
        .map((phase) => phase.phase),
    ).toEqual([
      "situational-grounding",
      "player-identification",
      "baseline-model",
    ]);
  });

  it("returns failed after exhausting retries on a provider error", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"));

    const callbacks = createCallbacks();
    const { signal } = makeAbortSignal();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result).toEqual({
      status: "failed",
      phasesCompleted: 1,
      totalEntities: 1,
      runId: "test-run",
      failedPhase: "player-identification",
      failureKind: "provider-error",
    });
    expect(callbacks.onPhaseFailed).toHaveBeenCalledWith(
      "player-identification",
      expect.stringContaining("Network error"),
    );
    expect(mockGenerateCompletion).toHaveBeenCalledTimes(4);
    expect(
      useEntityGraphStore
        .getState()
        .analysis.phases.find((phase) => phase.phase === "player-identification")
        ?.status,
    ).toBe("failed");
  });

  it("retries a parse failure and still returns success", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockResolvedValueOnce("not valid json")
      .mockResolvedValueOnce(PHASE_2_RESPONSE)
      .mockResolvedValueOnce(PHASE_3_RESPONSE);

    const callbacks = createCallbacks();
    const { signal } = makeAbortSignal();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result.status).toBe("success");
    expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(3);
    expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();
    expect(mockGenerateCompletion).toHaveBeenCalledTimes(4);
  });

  it("classifies timeout failures deterministically", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockRejectedValueOnce(new Error("Request timed out after 30s"))
      .mockRejectedValueOnce(new Error("Request timed out after 30s"))
      .mockRejectedValueOnce(new Error("Request timed out after 30s"));

    const callbacks = createCallbacks();
    const { signal } = makeAbortSignal();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result.status).toBe("failed");
    expect(result.failureKind).toBe("timeout");
  });

  it("returns aborted when the signal is aborted before the next phase begins", async () => {
    const { signal, abort } = makeAbortSignal();

    mockGenerateCompletion.mockImplementationOnce(async () => {
      abort();
      return PHASE_1_RESPONSE;
    });

    const callbacks = createCallbacks();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result).toEqual({
      status: "aborted",
      phasesCompleted: 1,
      totalEntities: 1,
      runId: "test-run",
    });
    expect(callbacks.onPhaseStart).toHaveBeenCalled();
    expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();
    expect(mockGenerateCompletion).toHaveBeenCalledTimes(1);
  });

  it("returns aborted when the active phase aborts mid-attempt", async () => {
    const { signal, abort } = makeAbortSignal();

    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockImplementationOnce(async () => {
        abort();
        throw new DOMException("The operation was aborted.", "AbortError");
      });

    const callbacks = createCallbacks();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result).toEqual({
      status: "aborted",
      phasesCompleted: 1,
      totalEntities: 1,
      runId: "test-run",
    });
    expect(callbacks.onPhaseStart).toHaveBeenCalled();
    expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();
  });

  it("passes prior phase output into later prompts", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(PHASE_1_RESPONSE)
      .mockResolvedValueOnce(PHASE_2_RESPONSE)
      .mockResolvedValueOnce(PHASE_3_RESPONSE);

    const { signal } = makeAbortSignal();

    await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks: createCallbacks(),
      run: createRunContext(),
    });

    const phase1UserMessage = mockGenerateCompletion.mock.calls[0][1];
    const phase2UserMessage = mockGenerateCompletion.mock.calls[1][1];
    const phase3UserMessage = mockGenerateCompletion.mock.calls[2][1];

    expect(phase1UserMessage).not.toContain("Prior phase output");
    expect(phase2UserMessage).toContain("Prior phase output");
    expect(phase2UserMessage).toContain("fact-1");
    expect(phase3UserMessage).toContain("Prior phase output");
    expect(phase3UserMessage).toContain("player-a");
  });

  it("marks a phase complete even when it returns zero entities", async () => {
    mockGenerateCompletion
      .mockResolvedValueOnce(EMPTY_PHASE_RESPONSE)
      .mockResolvedValueOnce(PHASE_2_RESPONSE)
      .mockResolvedValueOnce(PHASE_3_RESPONSE);

    const callbacks = createCallbacks();
    const { signal } = makeAbortSignal();

    const result = await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks,
      run: createRunContext(),
    });

    expect(result.status).toBe("success");
    expect(callbacks.onPhaseComplete).toHaveBeenCalledWith(
      "situational-grounding",
      0,
    );
    expect(
      useEntityGraphStore
        .getState()
        .analysis.phases.find((phase) => phase.phase === "situational-grounding")
        ?.status,
    ).toBe("complete");
  });

  describe("revalidation", () => {
    it("re-runs stale downstream phases and clears stale markers", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE)
        .mockResolvedValueOnce(PHASE_2_RESPONSE)
        .mockResolvedValueOnce(PHASE_3_RESPONSE);

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal: makeAbortSignal().signal,
        callbacks: createCallbacks(),
        run: createRunContext(),
      });

      const store = useEntityGraphStore.getState();
      store.markStale(["game-1"]);
      expect(store.getStaleEntityIds()).toEqual(["game-1"]);

      const REVALIDATED_PHASE_3 = JSON.stringify({
        entities: [
          {
            id: "game-1-rev2",
            type: "game",
            phase: "baseline-model",
            data: {
              type: "game",
              name: "Revised Trade War",
              gameType: "prisoners-dilemma",
              timing: "simultaneous",
              description: "Revalidated model",
            },
            position: { x: 0, y: 0 },
            confidence: "high",
            source: "ai",
            rationale: "Revised after human edit",
            revision: 2,
            stale: false,
          },
        ],
        relationships: [],
      });

      mockGenerateCompletion.mockReset();
      mockGenerateCompletion.mockResolvedValueOnce(REVALIDATED_PHASE_3);

      const callbacks = createCallbacks();

      const result = await revalidateStaleEntities({
        signal: makeAbortSignal().signal,
        callbacks,
        run: createRunContext("revalidation-run"),
      });

      expect(result).toEqual({
        status: "success",
        phasesCompleted: 1,
        totalEntities: 4,
        runId: "revalidation-run",
      });
      expect(callbacks.onPhaseStart).toHaveBeenCalledWith("baseline-model");
      expect(callbacks.onPhaseComplete).toHaveBeenCalledWith(
        "baseline-model",
        1,
      );
      expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();
      expect(mockGenerateCompletion).toHaveBeenCalledTimes(1);

      const finalStore = useEntityGraphStore.getState();
      expect(
        finalStore.analysis.entities.find((entity) => entity.id === "game-1"),
      ).toBeFalsy();
      expect(
        finalStore.analysis.entities.find(
          (entity) => entity.id === "game-1-rev2",
        ),
      ).toBeTruthy();
      expect(finalStore.getStaleEntityIds()).toEqual([]);
    });

    it("returns success immediately when nothing is stale", async () => {
      const callbacks = createCallbacks();

      const result = await revalidateStaleEntities({
        signal: makeAbortSignal().signal,
        callbacks,
        run: createRunContext("revalidation-run"),
      });

      expect(result).toEqual({
        status: "success",
        phasesCompleted: 0,
        totalEntities: 0,
        runId: "revalidation-run",
      });
      expect(callbacks.onPhaseStart).not.toHaveBeenCalled();
      expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });
  });
});
