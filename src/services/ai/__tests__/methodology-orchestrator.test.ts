import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRunLogger } from "@/services/ai/ai-logger";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { OrchestratorCallbacks } from "@/services/ai/methodology-orchestrator";
import type { AIStreamChunk } from "@/services/ai/ai-types";

vi.mock("@/services/ai/ai-service", () => ({
  streamChat: vi.fn(),
}));

vi.mock("@/stores/ai-store", () => ({
  useAIStore: {
    getState: () => ({ model: "claude-sonnet-4-5-20250514", modelGroups: [] }),
  },
}));

vi.mock("@/services/ai/orchestrator-prompt-optimizer", () => ({
  getOrchestratorTimeouts: vi.fn(() => ({
    hardTimeoutMs: 300_000,
    noTextTimeoutMs: 150_000,
    thinkingResetsTimeout: true,
    pingResetsTimeout: false,
    firstTextTimeoutMs: 300_000,
  })),
}));

// Stable stubs so tests can assert on store lifecycle calls
const mockRunStoreActions = {
  startRun: vi.fn(),
  setPhase: vi.fn(),
  setAttempt: vi.fn(),
  failRun: vi.fn(),
  abortRun: vi.fn(),
  completeRun: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@/stores/analysis-run-store", () => ({
  useAnalysisRunStore: {
    getState: () => mockRunStoreActions,
  },
}));

import { streamChat } from "@/services/ai/ai-service";
import {
  revalidateStaleEntities,
  runMethodologyAnalysis,
} from "@/services/ai/methodology-orchestrator";

const mockStreamChat = vi.mocked(streamChat);

// ── Stream mock helpers ──

function mockStreamResponse(
  jsonResponse: string,
): AsyncGenerator<AIStreamChunk> {
  return (async function* () {
    const chunkSize = Math.ceil(jsonResponse.length / 3);
    for (let i = 0; i < jsonResponse.length; i += chunkSize) {
      yield {
        type: "text" as const,
        content: jsonResponse.slice(i, i + chunkSize),
      };
    }
    yield { type: "done" as const, content: "" };
  })();
}

function mockStreamError(errorMessage: string): AsyncGenerator<AIStreamChunk> {
  return (async function* () {
    yield { type: "error" as const, content: errorMessage };
  })();
}

// ── Test data ──

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
    mockStreamChat.mockReset();
    Object.values(mockRunStoreActions).forEach((fn) => fn.mockReset());
  });

  it("returns success after running all 3 phases in order", async () => {
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_2_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_3_RESPONSE));

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
    expect(callbacks.onPhaseStart).toHaveBeenNthCalledWith(3, "baseline-model");
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
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockReturnValueOnce(mockStreamError("Network error"))
      .mockReturnValueOnce(mockStreamError("Network error"))
      .mockReturnValueOnce(mockStreamError("Network error"));

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
    expect(mockStreamChat).toHaveBeenCalledTimes(4);
    expect(
      useEntityGraphStore
        .getState()
        .analysis.phases.find(
          (phase) => phase.phase === "player-identification",
        )?.status,
    ).toBe("failed");
  });

  it("retries a parse failure and still returns success", async () => {
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse("not valid json"))
      .mockReturnValueOnce(mockStreamResponse(PHASE_2_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_3_RESPONSE));

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
    expect(mockStreamChat).toHaveBeenCalledTimes(4);
  });

  it("classifies timeout failures deterministically", async () => {
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockReturnValueOnce(mockStreamError("Request timed out after 30s"))
      .mockReturnValueOnce(mockStreamError("Request timed out after 30s"))
      .mockReturnValueOnce(mockStreamError("Request timed out after 30s"));

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

    // Phase 1 completes normally, then abort fires before phase 2 can start
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockImplementationOnce(function* () {
        // This generator is created but the signal check in runSinglePhase
        // catches the abort before iterating
        abort();
        yield { type: "done" as const, content: "" };
      } as unknown as typeof streamChat);

    // Abort after phase 1 stream finishes but before phase 2 stream is consumed
    const origOnPhaseComplete = vi.fn((_phase, _count) => {
      abort();
    });

    const callbacks = createCallbacks({
      onPhaseComplete: origOnPhaseComplete,
    });

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
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
  });

  it("returns aborted when the active phase aborts mid-attempt", async () => {
    const { signal, abort } = makeAbortSignal();

    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockImplementationOnce(function* () {
        abort();
        yield { type: "error" as const, content: "The operation was aborted." };
      } as unknown as typeof streamChat);

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
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_2_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_3_RESPONSE));

    const { signal } = makeAbortSignal();

    await runMethodologyAnalysis({
      topic: "Trade war",
      signal,
      callbacks: createCallbacks(),
      run: createRunContext(),
    });

    // streamChat receives messages array as 2nd arg: [{ role: 'user', content: '...' }]
    const phase1UserMessage = mockStreamChat.mock.calls[0][1][0].content;
    const phase2UserMessage = mockStreamChat.mock.calls[1][1][0].content;
    const phase3UserMessage = mockStreamChat.mock.calls[2][1][0].content;

    expect(phase1UserMessage).not.toContain("Prior phase output");
    expect(phase2UserMessage).toContain("Prior phase output");
    expect(phase2UserMessage).toContain("fact-1");
    expect(phase3UserMessage).toContain("Prior phase output");
    expect(phase3UserMessage).toContain("player-a");
  });

  it("marks a phase complete even when it returns zero entities", async () => {
    mockStreamChat
      .mockReturnValueOnce(mockStreamResponse(EMPTY_PHASE_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_2_RESPONSE))
      .mockReturnValueOnce(mockStreamResponse(PHASE_3_RESPONSE));

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
        .analysis.phases.find(
          (phase) => phase.phase === "situational-grounding",
        )?.status,
    ).toBe("complete");
  });

  describe("revalidation", () => {
    it("re-runs stale downstream phases and clears stale markers", async () => {
      mockStreamChat
        .mockReturnValueOnce(mockStreamResponse(PHASE_1_RESPONSE))
        .mockReturnValueOnce(mockStreamResponse(PHASE_2_RESPONSE))
        .mockReturnValueOnce(mockStreamResponse(PHASE_3_RESPONSE));

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

      mockStreamChat.mockReset();
      mockStreamChat.mockReturnValueOnce(
        mockStreamResponse(REVALIDATED_PHASE_3),
      );

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
      expect(mockStreamChat).toHaveBeenCalledTimes(1);

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
      expect(mockStreamChat).not.toHaveBeenCalled();
    });
  });
});
