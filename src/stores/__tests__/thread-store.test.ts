// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThreadStore } from "@/stores/thread-store";
import { appStorage } from "@/utils/app-storage";

describe("thread-store", () => {
  beforeEach(() => {
    useThreadStore.setState(useThreadStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    useThreadStore.setState(useThreadStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it("restores the last selected thread when hydrating a workspace", async () => {
    vi.spyOn(appStorage, "getItem").mockReturnValue(
      JSON.stringify({ "workspace-1": "thread-2" }),
    );
    vi.spyOn(appStorage, "setItem").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workspaceId: "workspace-1",
              threads: [
                {
                  id: "thread-1",
                  workspaceId: "workspace-1",
                  title: "First",
                  isPrimary: true,
                  createdAt: 1,
                  updatedAt: 2,
                },
                {
                  id: "thread-2",
                  workspaceId: "workspace-1",
                  title: "Second",
                  isPrimary: false,
                  createdAt: 3,
                  updatedAt: 4,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workspaceId: "workspace-1",
              thread: {
                id: "thread-2",
                workspaceId: "workspace-1",
                title: "Second",
                isPrimary: false,
                createdAt: 3,
                updatedAt: 4,
              },
              messages: [],
              activities: [],
            }),
          ),
        ),
    );

    await useThreadStore.getState().hydrateWorkspace("workspace-1");

    expect(useThreadStore.getState().activeThreadId).toBe("thread-2");
    expect(useThreadStore.getState().activeThreadDetail?.thread.title).toBe(
      "Second",
    );
  });

  it("falls back to the newest thread when the stored selection is missing", async () => {
    vi.spyOn(appStorage, "getItem").mockReturnValue(
      JSON.stringify({ "workspace-1": "missing-thread" }),
    );
    vi.spyOn(appStorage, "setItem").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workspaceId: "workspace-1",
              threads: [
                {
                  id: "thread-newest",
                  workspaceId: "workspace-1",
                  title: "Newest",
                  isPrimary: false,
                  createdAt: 5,
                  updatedAt: 10,
                },
                {
                  id: "thread-primary",
                  workspaceId: "workspace-1",
                  title: "Primary",
                  isPrimary: true,
                  createdAt: 1,
                  updatedAt: 2,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              workspaceId: "workspace-1",
              thread: {
                id: "thread-newest",
                workspaceId: "workspace-1",
                title: "Newest",
                isPrimary: false,
                createdAt: 5,
                updatedAt: 10,
              },
              messages: [],
              activities: [],
            }),
          ),
        ),
    );

    await useThreadStore.getState().hydrateWorkspace("workspace-1");

    expect(useThreadStore.getState().activeThreadId).toBe("thread-newest");
  });
});
