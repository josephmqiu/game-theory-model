import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

describe("/api/workspace/thread (create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
  });

  it("creates a non-primary thread with the default title", async () => {
    readBodyMock.mockResolvedValue({
      workspaceId: "workspace-1",
    });

    const route = (await import("../thread.post")).default;
    const result = await route({} as never);

    expect(result).toMatchObject({
      workspaceId: "workspace-1",
      thread: expect.objectContaining({
        workspaceId: "workspace-1",
        isPrimary: false,
        title: "New Chat",
      }),
    });

    const stored = getWorkspaceDatabase().threads.getThreadState(
      (result as { thread: { id: string } }).thread.id,
    );
    expect(stored).toMatchObject({
      workspaceId: "workspace-1",
      isPrimary: false,
      title: "New Chat",
    });
  });

  it("returns 400 for invalid payloads", async () => {
    readBodyMock.mockResolvedValue({ workspaceId: "" });

    const route = (await import("../thread.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Invalid thread create payload" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });
});
