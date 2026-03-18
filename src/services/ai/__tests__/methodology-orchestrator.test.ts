import { beforeEach, describe, expect, it, vi } from "vitest";
import { V1_PHASES } from "@/types/methodology";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { OrchestratorCallbacks } from "@/services/ai/methodology-orchestrator";

// ── Mock AI service ──

vi.mock("@/services/ai/ai-service", () => ({
  generateCompletion: vi.fn(),
}));

vi.mock("@/stores/ai-store", () => ({
  useAIStore: {
    getState: () => ({ model: "claude-sonnet-4-5-20250514" }),
  },
}));

import { generateCompletion } from "@/services/ai/ai-service";
import {
  runMethodologyAnalysis,
  revalidateStaleEntities,
} from "@/services/ai/methodology-orchestrator";

const mockGenerateCompletion = generateCompletion as ReturnType<typeof vi.fn>;

// ── Fixtures ──

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

// ── Helpers ──

function createCallbacks(
  overrides: Partial<OrchestratorCallbacks> = {},
): OrchestratorCallbacks {
  return {
    onPhaseStart: vi.fn(),
    onPhaseComplete: vi.fn(),
    onPhaseFailed: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

function createOrchestratorCallbacks(
  overrides: Partial<OrchestratorCallbacks> = {},
): OrchestratorCallbacks {
  return {
    onPhaseStart: vi.fn(),
    onPhaseComplete: vi.fn(),
    onPhaseFailed: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

function makeAbortSignal(): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController();
  return { signal: controller.signal, abort: () => controller.abort() };
}

// ── Tests ──

describe("methodology orchestrator", () => {
  beforeEach(() => {
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
    useEntityGraphStore.getState().newAnalysis("Test topic");
    mockGenerateCompletion.mockReset();
  });

  describe("happy path", () => {
    it("runs all 3 phases in order with correct callbacks", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE)
        .mockResolvedValueOnce(PHASE_2_RESPONSE)
        .mockResolvedValueOnce(PHASE_3_RESPONSE);

      const callbacks = createCallbacks();
      const { signal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "US-China trade war",
        signal,
        callbacks,
      });

      // All 3 phases started
      expect(callbacks.onPhaseStart).toHaveBeenCalledTimes(3);
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

      // All 3 phases completed with entity counts
      expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(3);
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

      // No failures
      expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();

      // Final onComplete
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);

      // Entities in store
      const { analysis } = useEntityGraphStore.getState();
      expect(analysis.entities).toHaveLength(4); // 1 + 2 + 1

      // Phase statuses all complete
      for (const phase of V1_PHASES) {
        const ps = analysis.phases.find((p) => p.phase === phase);
        expect(ps?.status).toBe("complete");
      }
    });
  });

  describe("phase failure with retries", () => {
    it("retries a failed phase up to 2 times then reports failed", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE) // Phase 1 succeeds
        .mockRejectedValueOnce(new Error("Network error")) // Phase 2 attempt 1
        .mockRejectedValueOnce(new Error("Network error")) // Phase 2 attempt 2
        .mockRejectedValueOnce(new Error("Network error")); // Phase 2 attempt 3

      const callbacks = createCallbacks();
      const { signal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // Phase 1 started + completed
      expect(callbacks.onPhaseStart).toHaveBeenCalledWith(
        "situational-grounding",
      );
      expect(callbacks.onPhaseComplete).toHaveBeenCalledWith(
        "situational-grounding",
        1,
      );

      // Phase 2 started but failed
      expect(callbacks.onPhaseStart).toHaveBeenCalledWith(
        "player-identification",
      );
      expect(callbacks.onPhaseFailed).toHaveBeenCalledWith(
        "player-identification",
        expect.stringContaining("Network error"),
      );

      // Phase 3 should not run after Phase 2 failure
      expect(callbacks.onPhaseStart).not.toHaveBeenCalledWith("baseline-model");

      // generateCompletion called 4 times: 1 (phase 1) + 3 (phase 2 retries)
      expect(mockGenerateCompletion).toHaveBeenCalledTimes(4);

      // Phase 2 status is failed in the store
      const { analysis } = useEntityGraphStore.getState();
      const p2 = analysis.phases.find(
        (p) => p.phase === "player-identification",
      );
      expect(p2?.status).toBe("failed");
    });

    it("retries on parse failure then succeeds", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE) // Phase 1 succeeds
        .mockResolvedValueOnce("not valid json") // Phase 2 attempt 1 (parse fail)
        .mockResolvedValueOnce(PHASE_2_RESPONSE) // Phase 2 attempt 2 (succeeds)
        .mockResolvedValueOnce(PHASE_3_RESPONSE); // Phase 3 succeeds

      const callbacks = createCallbacks();
      const { signal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // All phases complete, no failures
      expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(3);
      expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();

      // 4 calls: 1 (phase 1) + 2 (phase 2 retry) + 1 (phase 3)
      expect(mockGenerateCompletion).toHaveBeenCalledTimes(4);
    });
  });

  describe("abort signal", () => {
    it("stops cleanly when aborted before Phase 2", async () => {
      const { signal, abort } = makeAbortSignal();

      mockGenerateCompletion.mockImplementation(async () => {
        // Abort after Phase 1 completes
        abort();
        return PHASE_1_RESPONSE;
      });

      const callbacks = createCallbacks();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // Phase 1 started and completed
      expect(callbacks.onPhaseStart).toHaveBeenCalledWith(
        "situational-grounding",
      );
      expect(callbacks.onPhaseComplete).toHaveBeenCalledWith(
        "situational-grounding",
        1,
      );

      // Phase 2 never started
      expect(callbacks.onPhaseStart).not.toHaveBeenCalledWith(
        "player-identification",
      );

      // onComplete still fires (clean stop)
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);

      // Only 1 AI call made
      expect(mockGenerateCompletion).toHaveBeenCalledTimes(1);
    });

    it("stops when aborted mid-phase", async () => {
      const { signal, abort } = makeAbortSignal();

      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE)
        .mockImplementation(async () => {
          abort();
          throw new DOMException("The operation was aborted.", "AbortError");
        });

      const callbacks = createCallbacks();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // Phase 1 completed, Phase 2 started but aborted
      expect(callbacks.onPhaseStart).toHaveBeenCalledTimes(2);
      expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(1);

      // No failure callback for aborted phases
      expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();

      // onComplete fires on clean abort
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe("prior context passing", () => {
    it("Phase 2 receives Phase 1 entities as prior context", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE)
        .mockResolvedValueOnce(PHASE_2_RESPONSE)
        .mockResolvedValueOnce(PHASE_3_RESPONSE);

      const callbacks = createCallbacks();
      const { signal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // Phase 1 call: no prior context in user message
      const phase1UserMsg = mockGenerateCompletion.mock.calls[0][1] as string;
      expect(phase1UserMsg).not.toContain("Prior phase output");

      // Phase 2 call: should contain Phase 1 entities as context
      const phase2UserMsg = mockGenerateCompletion.mock.calls[1][1] as string;
      expect(phase2UserMsg).toContain("Prior phase output");
      expect(phase2UserMsg).toContain("fact-1");

      // Phase 3 call: should contain Phase 1 + Phase 2 entities
      const phase3UserMsg = mockGenerateCompletion.mock.calls[2][1] as string;
      expect(phase3UserMsg).toContain("Prior phase output");
      expect(phase3UserMsg).toContain("player-a");
    });
  });

  describe("empty phase output", () => {
    it("marks phase complete even with 0 entities", async () => {
      mockGenerateCompletion
        .mockResolvedValueOnce(EMPTY_PHASE_RESPONSE) // Phase 1: 0 entities
        .mockResolvedValueOnce(PHASE_2_RESPONSE)
        .mockResolvedValueOnce(PHASE_3_RESPONSE);

      const callbacks = createCallbacks();
      const { signal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal,
        callbacks,
      });

      // Phase 1 completed with 0 entities
      expect(callbacks.onPhaseComplete).toHaveBeenCalledWith(
        "situational-grounding",
        0,
      );

      // All 3 phases complete
      expect(callbacks.onPhaseComplete).toHaveBeenCalledTimes(3);
      expect(callbacks.onPhaseFailed).not.toHaveBeenCalled();

      // Store has correct phase status
      const { analysis } = useEntityGraphStore.getState();
      const p1 = analysis.phases.find(
        (p) => p.phase === "situational-grounding",
      );
      expect(p1?.status).toBe("complete");
    });
  });

  describe("revalidation", () => {
    it("re-runs Phase 3 when baseline-model entities are stale, then clears stale", async () => {
      // First, run a full analysis so all phases are complete
      mockGenerateCompletion
        .mockResolvedValueOnce(PHASE_1_RESPONSE)
        .mockResolvedValueOnce(PHASE_2_RESPONSE)
        .mockResolvedValueOnce(PHASE_3_RESPONSE);

      const runCallbacks = createCallbacks();
      const { signal: runSignal } = makeAbortSignal();

      await runMethodologyAnalysis({
        topic: "Trade war",
        signal: runSignal,
        callbacks: runCallbacks,
      });

      // Verify game-1 entity exists
      const store = useEntityGraphStore.getState();
      expect(
        store.analysis.entities.find((e) => e.id === "game-1"),
      ).toBeTruthy();

      // Mark the Phase 3 entity as stale (simulating downstream of a human edit)
      store.markStale(["game-1"]);
      expect(useEntityGraphStore.getState().getStaleEntityIds()).toEqual([
        "game-1",
      ]);

      // Set up new AI response for Phase 3 re-run
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

      // Run revalidation
      const revalCallbacks = createOrchestratorCallbacks();
      const { signal: revalSignal } = makeAbortSignal();

      await revalidateStaleEntities(revalSignal, revalCallbacks);

      // Phase 3 was re-run
      expect(revalCallbacks.onPhaseStart).toHaveBeenCalledWith(
        "baseline-model",
      );
      expect(revalCallbacks.onPhaseComplete).toHaveBeenCalledWith(
        "baseline-model",
        1,
      );
      expect(revalCallbacks.onPhaseFailed).not.toHaveBeenCalled();
      expect(revalCallbacks.onComplete).toHaveBeenCalledTimes(1);

      // Only Phase 3 was re-run (not Phases 1 or 2)
      expect(revalCallbacks.onPhaseStart).toHaveBeenCalledTimes(1);
      expect(mockGenerateCompletion).toHaveBeenCalledTimes(1);

      // Old entity removed, new entity present
      const finalStore = useEntityGraphStore.getState();
      expect(
        finalStore.analysis.entities.find((e) => e.id === "game-1"),
      ).toBeFalsy();
      expect(
        finalStore.analysis.entities.find((e) => e.id === "game-1-rev2"),
      ).toBeTruthy();

      // Stale flag cleared
      expect(finalStore.getStaleEntityIds()).toEqual([]);
    });

    it("does nothing when no entities are stale", async () => {
      const revalCallbacks = createOrchestratorCallbacks();
      const { signal } = makeAbortSignal();

      await revalidateStaleEntities(signal, revalCallbacks);

      // Only onComplete fires, no phases re-run
      expect(revalCallbacks.onComplete).toHaveBeenCalledTimes(1);
      expect(revalCallbacks.onPhaseStart).not.toHaveBeenCalled();
      expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });
  });
});
