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

const createChallengeMock = vi.fn();
const getChallengesMock = vi.fn();
const markChallengeViewedMock = vi.fn();
const getDownstreamEntityIdsMock = vi.fn();

vi.mock("../../../services/entity-graph-service", () => ({
  updateEntity: (...args: unknown[]) => updateEntityMock(...args),
  getEntityById: (...args: unknown[]) => getEntityByIdMock(...args),
  getStaleEntityIds: (...args: unknown[]) => getStaleEntityIdsMock(...args),
  getAnalysis: (...args: unknown[]) => getAnalysisMock(...args),
  newAnalysis: (...args: unknown[]) => newAnalysisMock(...args),
  createChallenge: (...args: unknown[]) => createChallengeMock(...args),
  getChallenges: (...args: unknown[]) => getChallengesMock(...args),
  markChallengeViewed: (...args: unknown[]) => markChallengeViewedMock(...args),
  getDownstreamEntityIds: (...args: unknown[]) =>
    getDownstreamEntityIdsMock(...args),
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
      { source: "user-edited", logSource: "human", baseLogNo: undefined },
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
      { source: "user-edited", logSource: "human", baseLogNo: 0 },
    );
  });

  it("captures the base logNo when queueing so conflicts can be marked (E4A)", async () => {
    isRunningMock.mockReturnValue(true);
    getEntityByIdMock.mockReturnValue({
      ...factEntity,
      revisionLog: [{ logNo: 3, ts: 1, logSource: "phase", fieldDiffs: [] }],
    });
    readBodyMock.mockResolvedValue({
      action: "update",
      id: "entity-1",
      updates: { rationale: "Edited against logNo 3" },
    });

    const route = (await import("../entity.post")).default;
    await route({} as never);

    const queuedMutation = queueEditMock.mock.calls[0][0] as () => void;
    queuedMutation();
    expect(updateEntityMock).toHaveBeenCalledWith(
      "entity-1",
      { rationale: "Edited against logNo 3" },
      { source: "user-edited", logSource: "human", baseLogNo: 3 },
    );
  });

  it("creates a challenge and returns the downstream preview count", async () => {
    const challenge = {
      id: "ch-1",
      entityId: "entity-1",
      objection: "The cited figure is outdated by two quarters.",
      status: "pending",
    };
    createChallengeMock.mockReturnValue({
      challenge,
      staleMarked: ["entity-1", "entity-2", "entity-3"],
    });
    readBodyMock.mockResolvedValue({
      action: "challenge",
      id: "entity-1",
      objection: "The cited figure is outdated by two quarters.",
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(createChallengeMock).toHaveBeenCalledWith(
      "entity-1",
      "The cited figure is outdated by two quarters.",
    );
    expect(result).toEqual({
      challenge,
      staleMarked: ["entity-1", "entity-2", "entity-3"],
      downstreamCount: 2,
    });
  });

  it("rejects objections shorter than 10 characters with 400", async () => {
    readBodyMock.mockResolvedValue({
      action: "challenge",
      id: "entity-1",
      objection: "too short",
    });

    const route = (await import("../entity.post")).default;
    const result = (await route({} as never)) as { error: string };

    expect(result.error).toContain("10–2000 characters");
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
    expect(createChallengeMock).not.toHaveBeenCalled();
  });

  it("returns 404 when challenging a missing entity", async () => {
    getEntityByIdMock.mockReturnValue(null);
    readBodyMock.mockResolvedValue({
      action: "challenge",
      id: "missing",
      objection: "A perfectly valid objection.",
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Entity not found" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
  });

  it("queues challenges while an analysis run is active", async () => {
    isRunningMock.mockReturnValue(true);
    createChallengeMock.mockReturnValue({
      challenge: { id: "ch-q" },
      staleMarked: ["entity-1"],
    });
    readBodyMock.mockResolvedValue({
      action: "challenge",
      id: "entity-1",
      objection: "Queue this objection until the phase settles.",
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ queued: true });
    expect(createChallengeMock).not.toHaveBeenCalled();

    (queueEditMock.mock.calls[0][0] as () => void)();
    expect(createChallengeMock).toHaveBeenCalledTimes(1);
  });

  it("marks a challenge viewed", async () => {
    getChallengesMock.mockReturnValue([{ id: "ch-1" }]);
    markChallengeViewedMock.mockReturnValue({ id: "ch-1", viewed: true });
    readBodyMock.mockResolvedValue({
      action: "challengeViewed",
      id: "ch-1",
    });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ challenge: { id: "ch-1", viewed: true } });
  });

  it("returns downstream ids for the challenge form preview", async () => {
    getDownstreamEntityIdsMock.mockReturnValue(["entity-2", "entity-3"]);
    readBodyMock.mockResolvedValue({ action: "downstream", id: "entity-1" });

    const route = (await import("../entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ downstreamIds: ["entity-2", "entity-3"] });
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
      { source: "user-edited", logSource: "human", baseLogNo: undefined },
    );
  });
});
