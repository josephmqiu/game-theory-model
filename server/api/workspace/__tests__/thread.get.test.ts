import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThreadService,
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";

const getQueryMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getQuery: (...args: unknown[]) => getQueryMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

describe("/api/workspace/thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
  });

  it("returns the thread detail with messages and activities", async () => {
    const database = getWorkspaceDatabase();
    const threadService = createThreadService(database);
    const thread = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Trade war",
      producer: "test",
      occurredAt: 100,
    });
    threadService.recordMessage({
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      role: "user",
      content: "What should we analyze?",
      producer: "test",
      occurredAt: 101,
    });
    threadService.recordMessage({
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      role: "assistant",
      content: "Start with actors, incentives, and escalation options.",
      producer: "test",
      occurredAt: 102,
    });
    threadService.recordActivity({
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      scope: "chat-turn",
      kind: "tool",
      message: "Used WebSearch",
      status: "completed",
      toolName: "WebSearch",
      query: "trade war escalation ladder",
      producer: "test",
      occurredAt: 103,
    });

    getQueryMock.mockReturnValue({ threadId: thread.id });

    const route = (await import("../thread.get")).default;
    const result = await route({} as never);

    expect(result).toMatchObject({
      workspaceId: "workspace-1",
      thread: expect.objectContaining({
        id: thread.id,
        workspaceId: "workspace-1",
        title: "Trade war",
      }),
      messages: [
        expect.objectContaining({
          role: "user",
          content: "What should we analyze?",
        }),
        expect.objectContaining({
          role: "assistant",
          content: "Start with actors, incentives, and escalation options.",
        }),
      ],
      activities: [
        expect.objectContaining({
          scope: "chat-turn",
          kind: "tool",
          status: "completed",
          toolName: "WebSearch",
          query: "trade war escalation ladder",
        }),
      ],
    });
  });

  it("returns 404 when the thread does not exist", async () => {
    getQueryMock.mockReturnValue({ threadId: "missing-thread" });

    const route = (await import("../thread.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Thread not found" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
  });
});
