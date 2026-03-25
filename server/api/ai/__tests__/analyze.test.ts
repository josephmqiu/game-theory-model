import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisRuntimeOverrides } from "../../../../shared/types/analysis-runtime";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();
const runFullMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  runFull: (...args: unknown[]) => runFullMock(...args),
}));

describe("/api/ai/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when topic is missing", async () => {
    readBodyMock.mockResolvedValue({});

    const route = (await import("../analyze")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Missing required field: topic" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("returns 400 when activePhases is invalid", async () => {
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
      runtime: { activePhases: "baseline-model" },
    });

    const route = (await import("../analyze")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "activePhases must be an array of supported phases",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(runFullMock).not.toHaveBeenCalled();
  });

  it("returns 202 with a JSON run id payload", async () => {
    const runtime: AnalysisRuntimeOverrides = {
      webSearch: false,
      effortLevel: "quick",
      activePhases: ["scenarios", "situational-grounding"],
    };
    readBodyMock.mockResolvedValue({
      topic: "  Trade conflict  ",
      provider: "openai",
      model: "gpt-5.4",
      runtime,
    });
    runFullMock.mockResolvedValue({ runId: "run-123" });

    const route = (await import("../analyze")).default;
    const result = await route({} as never);

    expect(runFullMock).toHaveBeenCalledWith(
      "Trade conflict",
      "openai",
      "gpt-5.4",
      undefined,
      runtime,
      expect.objectContaining({
        commandId: expect.any(String),
        producer: "command-handlers",
      }),
    );
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 202);
    expect(result).toEqual({ runId: "run-123" });
  });

  it("maps active-run conflicts to 409 without clearing state in the route", async () => {
    readBodyMock.mockResolvedValue({
      topic: "Trade conflict",
    });
    runFullMock.mockRejectedValue(new Error("A run is already active"));

    const route = (await import("../analyze")).default;
    const result = await route({} as never);

    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 409);
    expect(result).toEqual({ error: "Analysis already running" });
  });
});
