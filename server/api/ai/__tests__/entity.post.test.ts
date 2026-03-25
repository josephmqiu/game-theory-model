import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();
const submitCommandMock = vi.fn();
const startCommandMock = vi.fn();
const getAnalysisMock = vi.fn();
const isRunningMock = vi.fn();
const queueEditMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

vi.mock("../../../services/entity-graph-service", () => ({
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  isRunning: () => isRunningMock(),
  queueEdit: (...args: unknown[]) => queueEditMock(...args),
}));

vi.mock("../../../services/command-bus", () => ({
  submitCommand: (...args: unknown[]) => submitCommandMock(...args),
  startCommand: (...args: unknown[]) => startCommandMock(...args),
}));

describe("/api/ai/entity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRunningMock.mockReturnValue(false);
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
    expect(submitCommandMock).not.toHaveBeenCalled();
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
    submitCommandMock.mockResolvedValue({
      status: "completed",
      result: {
        updated: [updated],
        staleMarked: ["entity-2"],
      },
    });
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { confidence: "high" },
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(submitCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "entity.update",
        id: "entity-1",
        updates: { confidence: "high" },
        provenanceSource: "user-edited",
      }),
    );
    expect(result).toEqual({
      updated,
      staleMarked: ["entity-2"],
    });
  });

  it("returns queued receipt metadata while analysis is running", async () => {
    isRunningMock.mockReturnValue(true);
    startCommandMock.mockResolvedValue({
      receipt: {
        status: "accepted",
        commandId: "cmd-queued",
        receiptId: "receipt-queued",
      },
      completion: Promise.resolve({
        status: "completed",
        commandId: "cmd-queued",
        receiptId: "receipt-queued",
      }),
    });
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { confidence: "high" },
      command: { receiptId: "receipt-queued" },
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(startCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "entity.update",
        id: "entity-1",
        updates: { confidence: "high" },
      }),
      expect.objectContaining({
        schedule: expect.any(Function),
      }),
    );
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 202);
    expect(result).toEqual({
      queued: true,
      status: "accepted",
      commandId: "cmd-queued",
      receiptId: "receipt-queued",
    });
  });
});
