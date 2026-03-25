import { beforeEach, describe, expect, it } from "vitest";

import * as runtimeStatus from "../runtime-status";

describe("runtime-status", () => {
  beforeEach(() => {
    runtimeStatus._resetForTest();
  });

  it("acquires an analysis run and tracks active phase progress", () => {
    expect(
      runtimeStatus.acquireRun("analysis", "run-1", { totalPhases: 3 }),
    ).toBe(true);
    expect(
      runtimeStatus.setActivePhase("run-1", "situational-grounding"),
    ).toBe(true);
    expect(runtimeStatus.completePhase("run-1")).toBe(true);

    expect(runtimeStatus.getSnapshot()).toEqual({
      status: "running",
      kind: "analysis",
      runId: "run-1",
      activePhase: null,
      progress: {
        completed: 1,
        total: 3,
      },
      deferredRevalidationPending: false,
    });
  });

  it("rejects a second acquire while another revalidation is active", () => {
    expect(
      runtimeStatus.acquireRun("revalidation", "reval-1", { totalPhases: 2 }),
    ).toBe(true);
    expect(
      runtimeStatus.acquireRun("revalidation", "reval-2", { totalPhases: 2 }),
    ).toBe(false);

    expect(runtimeStatus.getSnapshot()).toMatchObject({
      status: "running",
      kind: "revalidation",
      runId: "reval-1",
    });
  });

  it("records failure metadata on failed release", () => {
    runtimeStatus.acquireRun("analysis", "run-fail", { totalPhases: 4 });
    runtimeStatus.setActivePhase("run-fail", "baseline-model");
    runtimeStatus.completePhase("run-fail");

    expect(
      runtimeStatus.releaseRun("run-fail", "failed", {
        failedPhase: "baseline-model",
        failureMessage: "Revision diff validation error: bad schema",
      }),
    ).toBe(true);

    expect(runtimeStatus.getSnapshot()).toEqual({
      status: "failed",
      kind: "analysis",
      runId: "run-fail",
      activePhase: null,
      progress: {
        completed: 1,
        total: 4,
      },
      failedPhase: "baseline-model",
      failureKind: "validation",
      failureMessage: "Revision diff validation error: bad schema",
      deferredRevalidationPending: false,
    });
  });

  it("surfaces the deferred prompt after a completed run when stale ids are queued", () => {
    runtimeStatus.acquireRun("analysis", "run-complete", { totalPhases: 2 });
    runtimeStatus.deferRevalidation(["entity-1", "entity-2"], {
      reason: "analysis-active",
    });

    expect(runtimeStatus.releaseRun("run-complete", "completed")).toBe(true);
    expect(runtimeStatus.getDeferredRevalidationIds()).toEqual([
      "entity-1",
      "entity-2",
    ]);
    expect(runtimeStatus.getSnapshot()).toEqual({
      status: "idle",
      kind: null,
      runId: null,
      activePhase: null,
      progress: {
        completed: 0,
        total: 2,
      },
      deferredRevalidationPending: true,
    });
  });

  it("keeps deferred ids hidden after cancel until dismiss reveals the prompt", () => {
    runtimeStatus.acquireRun("analysis", "run-cancel", { totalPhases: 3 });
    runtimeStatus.deferRevalidation(["entity-1"], {
      reason: "analysis-active",
    });

    expect(runtimeStatus.releaseRun("run-cancel", "cancelled")).toBe(true);
    expect(runtimeStatus.getSnapshot()).toMatchObject({
      status: "cancelled",
      kind: "analysis",
      runId: "run-cancel",
      deferredRevalidationPending: false,
    });

    expect(runtimeStatus.dismiss("run-cancel")).toEqual({
      dismissed: true,
      deferredRevalidationPending: true,
    });
    expect(runtimeStatus.getSnapshot()).toEqual({
      status: "idle",
      kind: null,
      runId: null,
      activePhase: null,
      progress: {
        completed: 0,
        total: 0,
      },
      deferredRevalidationPending: true,
    });
    expect(runtimeStatus.getDeferredRevalidationIds()).toEqual(["entity-1"]);
  });

  it("dismisses the deferred prompt without consuming deferred ids", () => {
    runtimeStatus.deferRevalidation(["entity-1"], {
      revealWhenIdle: true,
      reason: "startup-stale-scan",
    });

    expect(runtimeStatus.getSnapshot().deferredRevalidationPending).toBe(true);
    expect(runtimeStatus.dismiss()).toEqual({
      dismissed: true,
      deferredRevalidationPending: false,
    });
    expect(runtimeStatus.getSnapshot().deferredRevalidationPending).toBe(false);
    expect(runtimeStatus.getDeferredRevalidationIds()).toEqual(["entity-1"]);
  });

  it("classifies provider, connector, and MCP transport failures", () => {
    expect(
      runtimeStatus.inferFailureKind(
        'Failed to start app-server: MCP server "game_theory_analyzer_mcp" is missing tool "get_entity"',
      ),
    ).toBe("mcp_transport_error");
    expect(
      runtimeStatus.inferFailureKind("Not logged in · Please run /login"),
    ).toBe("connector_error");
    expect(
      runtimeStatus.inferFailureKind("Provider API returned 401 unauthorized"),
    ).toBe("provider_api_error");
  });
});
