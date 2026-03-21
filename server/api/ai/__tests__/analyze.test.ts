import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisRuntimeOverrides } from "../../../../shared/types/analysis-runtime";

const readBodyMock = vi.fn();
const setResponseHeadersMock = vi.fn();
const setResponseStatusMock = vi.fn();
const runFullMock = vi.fn();
const newAnalysisMock = vi.fn();
const getAnalysisMock = vi.fn();
const onMutationMock = vi.fn();

const progressListeners = new Set<(event: Record<string, unknown>) => void>();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseHeaders: (...args: unknown[]) => setResponseHeadersMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../config/analysis-runtime", () => ({
  analysisRuntimeConfig: {
    analyzeSse: {
      keepaliveIntervalMs: 60_000,
      streamTimeoutMs: 1000,
      snapshotSettleDelayMs: 0,
    },
  },
}));

vi.mock("../../../agents/analysis-agent", () => ({
  runFull: (...args: unknown[]) => runFullMock(...args),
  onProgress: (callback: (event: Record<string, unknown>) => void) => {
    progressListeners.add(callback);
    return () => progressListeners.delete(callback);
  },
}));

vi.mock("../../../services/entity-graph-service", () => ({
  newAnalysis: (...args: unknown[]) => newAnalysisMock(...args),
  getAnalysis: () => getAnalysisMock(),
  onMutation: (...args: unknown[]) => onMutationMock(...args),
}));

function emitProgress(event: Record<string, unknown>): void {
  for (const listener of progressListeners) {
    listener(event);
  }
}

function createEvent() {
  return {
    node: {
      req: new EventEmitter(),
    },
  };
}

describe("/api/ai/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressListeners.clear();
    onMutationMock.mockReturnValue(() => {});
    getAnalysisMock.mockReturnValue({
      id: "analysis-1",
      name: "Topic",
      topic: "Topic",
      entities: [],
      relationships: [],
      phases: [],
    });
  });

  it("returns 400 when topic is missing", async () => {
    readBodyMock.mockResolvedValue({});

    const route = (await import("../analyze")).default;
    const result = await route(createEvent() as never);

    expect(result).toEqual({ error: "Missing required field: topic" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("returns 400 when activePhases is not an array", async () => {
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
      runtime: { activePhases: "baseline-model" },
    });

    const route = (await import("../analyze")).default;
    const result = await route(createEvent() as never);

    expect(result).toEqual({
      error: "activePhases must be an array of supported phases",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(newAnalysisMock).not.toHaveBeenCalled();
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("returns 400 when activePhases contains an unknown phase", async () => {
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
      runtime: { activePhases: ["revalidation"] },
    });

    const route = (await import("../analyze")).default;
    const result = await route(createEvent() as never);

    expect(result).toEqual({
      error:
        "Invalid activePhases: revalidation. Allowed phases: situational-grounding, player-identification, baseline-model, historical-game, formal-modeling, assumptions, elimination, scenarios, meta-check",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(newAnalysisMock).not.toHaveBeenCalled();
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("returns 400 when activePhases normalizes to an empty set", async () => {
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
      runtime: { activePhases: [] },
    });

    const route = (await import("../analyze")).default;
    const result = await route(createEvent() as never);

    expect(result).toEqual({
      error: "activePhases must include at least one supported canonical phase",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(newAnalysisMock).not.toHaveBeenCalled();
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("forwards runtime overrides through the analyze request path", async () => {
    const runtime: AnalysisRuntimeOverrides = {
      webSearch: false,
      effortLevel: "quick",
      activePhases: ["scenarios", "situational-grounding"],
    };
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
      provider: "openai",
      model: "gpt-5.4",
      runtime,
    });
    runFullMock.mockImplementation(async () => {
      queueMicrotask(() => {
        emitProgress({
          type: "analysis_completed",
          runId: "run-123",
        });
      });
      return { runId: "run-123" };
    });

    const route = (await import("../analyze")).default;
    const response = (await route(createEvent() as never)) as Response;
    const body = await response.text();

    expect(runFullMock).toHaveBeenCalledWith(
      "Trade conflict",
      "openai",
      "gpt-5.4",
      expect.any(AbortSignal),
      {
        webSearch: false,
        effortLevel: "quick",
        activePhases: ["scenarios", "situational-grounding"],
      },
    );
    expect(newAnalysisMock).toHaveBeenCalledWith("Trade conflict");
    expect(body).toContain('"channel":"started"');
    expect(body).toContain('"runId":"run-123"');
    expect(body).toContain('"channel":"snapshot"');
  });
});
