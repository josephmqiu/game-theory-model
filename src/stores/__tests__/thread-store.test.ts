// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appStorage } from "@/utils/app-storage";

const bindContextMock = vi.fn();
const sendRequestMock = vi.fn();
const disconnectMock = vi.fn();
const listeners: Array<(event: unknown) => void> = [];

vi.mock("@/services/ai/workspace-runtime-client", () => ({
  workspaceRuntimeClient: {
    bindContext: (...args: unknown[]) => bindContextMock(...args),
    sendRequest: (...args: unknown[]) => sendRequestMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    subscribe: (listener: (event: unknown) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
  },
}));

function createBootstrap(overrides: Record<string, unknown> = {}) {
  return {
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
    activeThreadId: "thread-2",
    activeThreadDetail: {
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
    },
    latestRun: null,
    latestPhaseTurns: [],
    channelRevisions: {
      threads: 1,
      "thread-detail": 1,
      "run-detail": 1,
    },
    serverConnectionId: "conn-1",
    ...overrides,
  };
}

describe("thread-store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    bindContextMock.mockReset();
    sendRequestMock.mockReset();
    disconnectMock.mockReset();
    listeners.splice(0, listeners.length);
  });

  afterEach(async () => {
    const { useThreadStore } = await import("@/stores/thread-store");
    useThreadStore.setState(useThreadStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it("restores the last selected thread when hydrating a workspace", async () => {
    vi.spyOn(appStorage, "getItem").mockReturnValue(
      JSON.stringify({ "workspace-1": "thread-2" }),
    );
    vi.spyOn(appStorage, "setItem").mockImplementation(() => {});
    bindContextMock.mockResolvedValue(createBootstrap());

    const { useThreadStore } = await import("@/stores/thread-store");
    await useThreadStore.getState().hydrateWorkspace("workspace-1");

    expect(bindContextMock).toHaveBeenCalled();
    expect(useThreadStore.getState().activeThreadId).toBe("thread-2");
    expect(useThreadStore.getState().activeThreadDetail?.thread.title).toBe(
      "Second",
    );
  });

  it("creates a thread through the websocket transport and rebinds to it", async () => {
    vi.spyOn(appStorage, "getItem").mockReturnValue("{}");
    vi.spyOn(appStorage, "setItem").mockImplementation(() => {});
    bindContextMock
      .mockResolvedValueOnce(
        createBootstrap({
          activeThreadId: "thread-1",
          activeThreadDetail: {
            thread: {
              id: "thread-1",
              workspaceId: "workspace-1",
              title: "First",
              isPrimary: true,
              createdAt: 1,
              updatedAt: 2,
            },
            messages: [],
            activities: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        createBootstrap({
          threads: [
            {
              id: "thread-new",
              workspaceId: "workspace-1",
              title: "New Thread",
              isPrimary: false,
              createdAt: 5,
              updatedAt: 6,
            },
          ],
          activeThreadId: "thread-new",
          activeThreadDetail: {
            thread: {
              id: "thread-new",
              workspaceId: "workspace-1",
              title: "New Thread",
              isPrimary: false,
              createdAt: 5,
              updatedAt: 6,
            },
            messages: [],
            activities: [],
          },
        }),
      );
    sendRequestMock.mockResolvedValue({
      workspaceId: "workspace-1",
      thread: {
        id: "thread-new",
        workspaceId: "workspace-1",
        title: "New Thread",
        isPrimary: false,
        createdAt: 5,
        updatedAt: 6,
      },
    });

    const { useThreadStore } = await import("@/stores/thread-store");
    await useThreadStore.getState().hydrateWorkspace("workspace-1");
    await useThreadStore.getState().createThread("New Thread");

    expect(sendRequestMock).toHaveBeenCalledWith("workspace.thread.create", {
      workspaceId: "workspace-1",
      title: "New Thread",
    });
    expect(useThreadStore.getState().activeThreadId).toBe("thread-new");
    expect(useThreadStore.getState().threads[0]?.title).toBe("New Thread");
  });

  it("clears overlay messages when pushed durable thread detail catches up", async () => {
    vi.spyOn(appStorage, "getItem").mockReturnValue("{}");
    vi.spyOn(appStorage, "setItem").mockImplementation(() => {});
    bindContextMock.mockResolvedValue(
      createBootstrap({
        activeThreadId: "thread-1",
        activeThreadDetail: {
          thread: {
            id: "thread-1",
            workspaceId: "workspace-1",
            title: "First",
            isPrimary: true,
            createdAt: 1,
            updatedAt: 2,
          },
          messages: [],
          activities: [],
        },
      }),
    );

    const { useThreadStore } = await import("@/stores/thread-store");
    await useThreadStore.getState().hydrateWorkspace("workspace-1");
    useThreadStore.getState().addOverlayMessage({
      id: "overlay-user",
      role: "user",
      content: "Analyze this",
      timestamp: 100,
    });
    useThreadStore.getState().addOverlayMessage({
      id: "overlay-assistant",
      role: "assistant",
      content: "Here is the analysis",
      timestamp: 101,
      isStreaming: false,
    });

    listeners[0]?.({
      type: "push",
      channel: "thread-detail",
      revision: 2,
      scope: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      payload: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        detail: {
          thread: {
            id: "thread-1",
            workspaceId: "workspace-1",
            title: "First",
            isPrimary: true,
            createdAt: 1,
            updatedAt: 2,
          },
          messages: [
            {
              id: "msg-1",
              workspaceId: "workspace-1",
              threadId: "thread-1",
              role: "user",
              content: "Analyze this",
              createdAt: 100,
              updatedAt: 100,
            },
            {
              id: "msg-2",
              workspaceId: "workspace-1",
              threadId: "thread-1",
              role: "assistant",
              content: "Here is the analysis",
              createdAt: 101,
              updatedAt: 101,
            },
          ],
          activities: [],
        },
      },
    });

    listeners[0]?.({
      type: "push",
      channel: "run-detail",
      revision: 3,
      scope: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      payload: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        latestRun: {
          id: "run-1",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          kind: "analysis",
          provider: "openai",
          model: "gpt-5.4",
          effort: "medium",
          status: "running",
          activePhase: "situational-grounding",
          progress: {
            completed: 1,
            total: 10,
          },
          startedAt: 123,
          finishedAt: null,
          createdAt: 123,
          updatedAt: 123,
        },
        latestPhaseTurns: [],
      },
    });

    expect(useThreadStore.getState().overlayMessages).toEqual([]);
    expect(useThreadStore.getState().latestRun?.id).toBe("run-1");
  });
});
