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

describe("/api/workspace/threads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
  });

  it("returns workspace threads in newest-first order", async () => {
    getQueryMock.mockReturnValue({ workspaceId: "workspace-1" });

    const database = getWorkspaceDatabase();
    const threadService = createThreadService(database);
    const olderThread = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Older thread",
      producer: "test",
      occurredAt: 100,
    });
    const newerThread = threadService.createThread({
      workspaceId: "workspace-1",
      title: "Newer thread",
      producer: "test",
      occurredAt: 200,
    });
    threadService.recordMessage({
      workspaceId: newerThread.workspaceId,
      threadId: newerThread.id,
      role: "user",
      content: "Bump updatedAt",
      producer: "test",
      occurredAt: 300,
    });

    const route = (await import("../threads.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      workspaceId: "workspace-1",
      threads: [newerThread.id, olderThread.id].map((id) =>
        expect.objectContaining({ id }),
      ),
    });
  });

  it("returns 400 when workspaceId is missing", async () => {
    getQueryMock.mockReturnValue({});

    const route = (await import("../threads.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Invalid workspace query" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });
});
