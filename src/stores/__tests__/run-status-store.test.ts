import { beforeEach, describe, expect, it } from "vitest";
import { useRunStatusStore } from "@/stores/run-status-store";
import { createSessionRuntimeError } from "../../../shared/types/runtime-error";

describe("run-status-store", () => {
  beforeEach(() => {
    useRunStatusStore.getState().resetForTest();
  });

  it("starts with the expected store shape", () => {
    const state = useRunStatusStore.getState();

    expect(state.runStatus).toEqual({
      status: "idle",
      kind: null,
      runId: null,
      activePhase: null,
      progress: {
        completed: 0,
        total: 9,
      },
      deferredRevalidationPending: false,
    });
    expect(state.phaseActivityText).toBeNull();
    expect(state.connectionState).toBe("DISCONNECTED");
  });

  it("applySnapshot replaces run status and clears ephemeral activity text", () => {
    useRunStatusStore.getState().setPhaseActivityText("Researching evidence.");
    useRunStatusStore.getState().applySnapshot({
      status: "running",
      kind: "analysis",
      runId: "run-1",
      activePhase: "situational-grounding",
      progress: {
        completed: 1,
        total: 9,
      },
      deferredRevalidationPending: false,
    });

    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "running",
      kind: "analysis",
      runId: "run-1",
      activePhase: "situational-grounding",
      progress: {
        completed: 1,
        total: 9,
      },
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBeNull();
  });

  it("setRunStatus keeps explicit failure metadata intact", () => {
    useRunStatusStore.getState().setRunStatus({
      status: "failed",
      kind: "analysis",
      runId: "run-2",
      activePhase: null,
      progress: {
        completed: 2,
        total: 9,
      },
      failedPhase: "player-identification",
      failure: createSessionRuntimeError("Codex runtime disconnected", {
        provider: "codex",
        sessionState: "missing",
        retryable: false,
      }),
      deferredRevalidationPending: false,
    });

    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "failed",
      kind: "analysis",
      runId: "run-2",
      failedPhase: "player-identification",
      failure: createSessionRuntimeError("Codex runtime disconnected", {
        provider: "codex",
        sessionState: "missing",
        retryable: false,
      }),
    });
  });
});
