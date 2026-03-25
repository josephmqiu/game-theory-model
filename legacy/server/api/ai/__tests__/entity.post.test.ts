import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();
const updateEntityMock = vi.fn();
const getStaleEntityIdsMock = vi.fn();
const getAnalysisMock = vi.fn();
const newAnalysisMock = vi.fn();
const isRunningMock = vi.fn();
const queueEditMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../services/entity-graph-service", () => ({
  updateEntity: (...args: unknown[]) => updateEntityMock(...args),
  getStaleEntityIds: (...args: unknown[]) => getStaleEntityIdsMock(...args),
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
  newAnalysis: (...args: unknown[]) => newAnalysisMock(...args),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  isRunning: () => isRunningMock(),
  queueEdit: (...args: unknown[]) => queueEditMock(...args),
}));

describe("/api/ai/entity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRunningMock.mockReturnValue(false);
    getStaleEntityIdsMock.mockReturnValue(["entity-2"]);
    getAnalysisMock.mockReturnValue({ id: "analysis-1" });
  });

  it("returns 400 when an update request is missing updates", async () => {
    readBodyMock.mockResolvedValue({ action: "update", id: "entity-1" });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      error: "Invalid update request: expected id and updates object",
    });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(updateEntityMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown action", async () => {
    readBodyMock.mockResolvedValue({ action: "archive" });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Unknown action: archive" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });

  it("applies a valid update request", async () => {
    const updated = { id: "entity-1", confidence: "high" };
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { confidence: "high" },
    });
    updateEntityMock.mockReturnValue(updated);

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(updateEntityMock).toHaveBeenCalledWith(
      "entity-1",
      { confidence: "high" },
      { source: "user-edited" },
    );
    expect(result).toEqual({
      updated,
      staleMarked: ["entity-2"],
    });
  });
});
