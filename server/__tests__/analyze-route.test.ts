import { beforeEach, describe, expect, it, vi } from "vitest";

const readBody = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody,
  setResponseStatus,
}));

vi.mock("../agents/analysis-agent", () => ({
  runFull: vi.fn(),
  getActiveStatus: vi.fn(),
  abort: vi.fn(),
}));

describe("analyze route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const commandHandlers = await import("../services/command-handlers");
    commandHandlers._resetForTest();
  });

  it("starts analysis through the command bus and returns the run id", async () => {
    const event = {} as never;
    readBody.mockResolvedValue({
      topic: "US-China trade war",
    });

    const { runFull } = await import("../agents/analysis-agent");
    vi.mocked(runFull).mockResolvedValue({ runId: "run-123" });

    const route = (await import("../api/ai/analyze")).default;
    const result = await route(event);

    expect(runFull).toHaveBeenCalledWith(
      "US-China trade war",
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(setResponseStatus).toHaveBeenCalledWith(event, 202);
    expect(result).toEqual({ runId: "run-123" });
  });

  it("maps active-run failures to HTTP 409", async () => {
    const event = {} as never;
    readBody.mockResolvedValue({
      topic: "US-China trade war",
    });

    const { runFull } = await import("../agents/analysis-agent");
    vi.mocked(runFull).mockRejectedValue(new Error("A run is already active"));

    const route = (await import("../api/ai/analyze")).default;
    const result = await route(event);

    expect(setResponseStatus).toHaveBeenCalledWith(event, 409);
    expect(result).toEqual({ error: "Analysis already running" });
  });
});
