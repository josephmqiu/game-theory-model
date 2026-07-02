import { beforeEach, describe, expect, it, vi } from "vitest";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();
const updateEntityMock = vi.fn();
const getEntityByIdMock = vi.fn();
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
  getEntityById: (...args: unknown[]) => getEntityByIdMock(...args),
  getStaleEntityIds: (...args: unknown[]) => getStaleEntityIdsMock(...args),
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
  newAnalysis: (...args: unknown[]) => newAnalysisMock(...args),
}));

vi.mock("../../../agents/analysis-agent", () => ({
  isRunning: () => isRunningMock(),
  queueEdit: (...args: unknown[]) => queueEditMock(...args),
}));

const factEntity = {
  id: "entity-1",
  type: "fact",
  data: {
    type: "fact",
    date: "2026-03-19",
    source: "test",
    content: "Existing content",
    category: "action",
  },
};

describe("/api/ai/entity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRunningMock.mockReturnValue(false);
    getEntityByIdMock.mockReturnValue(factEntity);
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

  it("returns 404 when the target entity does not exist", async () => {
    getEntityByIdMock.mockReturnValue(null);
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "missing-entity",
      updates: { confidence: "high" },
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Entity not found" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
    expect(updateEntityMock).not.toHaveBeenCalled();
  });

  it("returns 400 with field errors when updates violate the per-type schema", async () => {
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: {
        data: { category: "bogus-category" },
        confidence: "certain",
      },
    });

    const route = (await import("../entity.post")).default;
    const result = (await route({} as never)) as {
      error: string;
      fieldErrors: Record<string, string>;
    };

    expect(result.error).toBe("Validation failed");
    expect(result.fieldErrors["data.category"]).toBeTruthy();
    expect(result.fieldErrors.confidence).toBeTruthy();
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(updateEntityMock).not.toHaveBeenCalled();
    expect(queueEditMock).not.toHaveBeenCalled();
  });

  it("returns 400 with field errors for legacy update shapes", async () => {
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { phase: "meta-check", revision: 5 },
    });

    const route = (await import("../entity.post")).default;
    const result = (await route({} as never)) as {
      error: string;
      fieldErrors: Record<string, string>;
    };

    expect(result.error).toBe("Validation failed");
    expect(result.fieldErrors.phase).toBe("Field is not editable");
    expect(result.fieldErrors.revision).toBe("Field is not editable");
    expect(updateEntityMock).not.toHaveBeenCalled();
  });

  it("validates BEFORE queueing while an analysis run is active", async () => {
    isRunningMock.mockReturnValue(true);
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { data: { category: "bogus" } },
    });

    const route = (await import("../entity.post")).default;
    const result = (await route({} as never)) as { error: string };

    // Invalid edits must never enter the queue
    expect(result.error).toBe("Validation failed");
    expect(queueEditMock).not.toHaveBeenCalled();
  });

  it("queues a validated update while an analysis run is active", async () => {
    isRunningMock.mockReturnValue(true);
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { data: { content: "Edited mid-run" } },
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ queued: true });
    expect(queueEditMock).toHaveBeenCalledTimes(1);
    expect(updateEntityMock).not.toHaveBeenCalled();

    // Draining the queue applies the sanitized (merged, validated) update
    const queuedMutation = queueEditMock.mock.calls[0][0] as () => void;
    queuedMutation();
    expect(updateEntityMock).toHaveBeenCalledWith(
      "entity-1",
      {
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "test",
          content: "Edited mid-run",
          category: "action",
        },
      },
      { source: "user-edited" },
    );
  });

  it("merges partial data edits over current data before applying", async () => {
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { data: { content: "Just the content" } },
    });
    updateEntityMock.mockReturnValue({ id: "entity-1" });

    const route = (await import("../entity.post")).default;
    await route({} as never);

    expect(updateEntityMock).toHaveBeenCalledWith(
      "entity-1",
      {
        data: {
          type: "fact",
          date: "2026-03-19",
          source: "test",
          content: "Just the content",
          category: "action",
        },
      },
      { source: "user-edited" },
    );
  });
});
