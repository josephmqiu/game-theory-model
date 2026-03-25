import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTest as resetCommandBus,
  listCommandReceipts,
} from "../services/command-bus";
import {
  _resetForTest as resetEntityGraph,
  createEntity,
  getAnalysis,
  newAnalysis,
} from "../services/entity-graph-service";

const mocks = vi.hoisted(() => ({
  readBody: vi.fn(),
  setResponseStatus: vi.fn(),
  queueEdit: vi.fn<(mutation: () => void) => void>(),
  isRunning: vi.fn(() => false),
}));

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: mocks.readBody,
  setResponseStatus: mocks.setResponseStatus,
}));

vi.mock("../agents/analysis-agent", () => ({
  isRunning: mocks.isRunning,
  queueEdit: mocks.queueEdit,
}));

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("entity route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCommandBus();
    resetEntityGraph();
    newAnalysis("Test topic");
  });

  it("routes direct updates through the command bus", async () => {
    const entity = createEntity(
      {
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-25",
          source: "test",
          content: "Before",
          category: "action",
        },
        confidence: "high",
        rationale: "before",
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId: "run-1", phase: "situational-grounding" },
    );

    mocks.readBody.mockResolvedValue({
      action: "update",
      id: entity.id,
      updates: { rationale: "after" },
    });
    mocks.isRunning.mockReturnValue(false);

    const route = (await import("../api/ai/entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      updated: expect.objectContaining({ id: entity.id, rationale: "after" }),
      staleMarked: [],
    });
    expect(getAnalysis().entities[0].rationale).toBe("after");
    expect(listCommandReceipts().at(-1)?.kind).toBe("entity.update");
  });

  it("queues command submission while analysis is running and drains later", async () => {
    const queued: Array<() => void> = [];
    mocks.queueEdit.mockImplementation((mutation) => {
      queued.push(mutation);
    });

    const entity = createEntity(
      {
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-25",
          source: "test",
          content: "Before",
          category: "action",
        },
        confidence: "high",
        rationale: "before",
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId: "run-1", phase: "situational-grounding" },
    );

    mocks.readBody.mockResolvedValue({
      action: "update",
      id: entity.id,
      updates: { rationale: "queued-after" },
    });
    mocks.isRunning.mockReturnValue(true);

    const route = (await import("../api/ai/entity.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ queued: true });
    expect(getAnalysis().entities[0].rationale).toBe("before");
    expect(queued).toHaveLength(1);

    queued[0]();
    await flushAsync();
    await flushAsync();

    expect(getAnalysis().entities[0].rationale).toBe("queued-after");
    expect(listCommandReceipts().at(-1)?.kind).toBe("entity.update");
  });
});
