// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROMPT_PACK_ID,
  DEFAULT_PROMPT_PACK_MODE,
  DEFAULT_PROMPT_PACK_VERSION,
} from "../../../shared/types/prompt-pack";

const bindContextMock = vi.fn();
const sendRequestMock = vi.fn();
const disconnectMock = vi.fn();
const listeners: Array<(event: unknown) => void> = [];
const getItemMock = vi
  .fn<(key: string) => string | null>()
  .mockReturnValue(null);
const setItemMock = vi.fn();
const removeItemMock = vi.fn();

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

vi.mock("@/utils/app-storage", () => ({
  appStorage: {
    getItem: (...args: unknown[]) => getItemMock(...(args as [string])),
    setItem: (...args: unknown[]) => setItemMock(...args),
    removeItem: (...args: unknown[]) => removeItemMock(...args),
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
    getItemMock.mockReset().mockReturnValue(null);
    setItemMock.mockReset();
    removeItemMock.mockReset();
    listeners.splice(0, listeners.length);
  });

  afterEach(async () => {
    const { useThreadStore } = await import("@/stores/thread-store");
    useThreadStore.setState(useThreadStore.getInitialState(), true);
    vi.restoreAllMocks();
  });

  it("restores the last selected thread when hydrating a workspace", async () => {
    getItemMock.mockReturnValue(JSON.stringify({ "workspace-1": "thread-2" }));
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
    getItemMock.mockReturnValue("{}");
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

  it("clears pending turn when thread-detail push contains matching server message ID", async () => {
    getItemMock.mockReturnValue("{}");
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

    // Simulate a pending turn that completed and is waiting for reconciliation
    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "local-user", content: "Analyze this", timestamp: 100 },
        {
          id: "local-assistant",
          content: "",
          timestamp: 101,
          isStreaming: true,
        },
      );
    useThreadStore.getState().completePendingTurn("msg-2");

    expect(useThreadStore.getState().pendingTurn?.status).toBe("reconciling");

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

    expect(useThreadStore.getState().pendingTurn).toBeNull();
  });

  it("does NOT clear pending turn when server message ID does not match", async () => {
    getItemMock.mockReturnValue("{}");
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

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "local-user", content: "Analyze this", timestamp: 100 },
        {
          id: "local-assistant",
          content: "",
          timestamp: 101,
          isStreaming: true,
        },
      );
    useThreadStore.getState().completePendingTurn("msg-99");

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
          ],
          activities: [],
        },
      },
    });

    expect(useThreadStore.getState().pendingTurn).not.toBeNull();
    expect(useThreadStore.getState().pendingTurn?.status).toBe("reconciling");
  });

  it("selectThread clears pending turn", async () => {
    getItemMock.mockReturnValue("{}");
    bindContextMock.mockResolvedValue(createBootstrap());
    const { useThreadStore } = await import("@/stores/thread-store");
    await useThreadStore.getState().hydrateWorkspace("workspace-1");

    useThreadStore
      .getState()
      .startPendingTurn(
        "corr-1",
        { id: "local-user", content: "Test", timestamp: 100 },
        {
          id: "local-assistant",
          content: "",
          timestamp: 101,
          isStreaming: true,
        },
      );
    expect(useThreadStore.getState().pendingTurn).not.toBeNull();

    await useThreadStore.getState().selectThread("thread-1");
    expect(useThreadStore.getState().pendingTurn).toBeNull();
  });

  it("populates latest run from run-detail push", async () => {
    getItemMock.mockReturnValue("{}");
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
          provider: "codex",
          model: "gpt-5.4",
          effort: "medium",
          status: "running",
          activePhase: "situational-grounding",
          progress: {
            completed: 1,
            total: 10,
          },
          promptProvenance: {
            analysisType: "game-theory",
            activePhases: ["situational-grounding"],
            promptPackId: DEFAULT_PROMPT_PACK_ID,
            promptPackVersion: DEFAULT_PROMPT_PACK_VERSION,
            promptPackMode: DEFAULT_PROMPT_PACK_MODE,
            templateSetIdentity: DEFAULT_PROMPT_PACK_ID,
            templateSetHash: "template-set-hash",
          },
          logCorrelation: {
            logFileName: "run-1.jsonl",
          },
          startedAt: 123,
          finishedAt: null,
          createdAt: 123,
          updatedAt: 123,
        },
        latestPhaseTurns: [],
      },
    });

    expect(useThreadStore.getState().latestRun?.id).toBe("run-1");
  });

  it("rebinds when stored selection differs from server default", async () => {
    getItemMock.mockReturnValue(JSON.stringify({ "workspace-1": "thread-2" }));
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
      .mockResolvedValueOnce(createBootstrap());

    const { useThreadStore } = await import("@/stores/thread-store");
    await useThreadStore.getState().hydrateWorkspace("workspace-1");

    expect(bindContextMock).toHaveBeenCalledTimes(2);
    expect(useThreadStore.getState().activeThreadId).toBe("thread-2");
  });

  describe("question resolution", () => {
    function createPendingQuestion(id: string) {
      return {
        question: {
          id,
          threadId: "thread-1",
          header: "Input needed",
          question: "Which actors matter most?",
          options: [{ label: "Option A" }, { label: "Option B" }],
          createdAt: Date.now(),
        },
        status: "pending" as const,
      };
    }

    it("setPendingQuestions stores questions and resets activeQuestionIndex", async () => {
      getItemMock.mockReturnValue("{}");
      bindContextMock.mockResolvedValue(createBootstrap());
      const { useThreadStore } = await import("@/stores/thread-store");
      await useThreadStore.getState().hydrateWorkspace("workspace-1");

      useThreadStore
        .getState()
        .setPendingQuestions([
          createPendingQuestion("q-1"),
          createPendingQuestion("q-2"),
        ]);

      expect(useThreadStore.getState().pendingQuestions).toHaveLength(2);
      expect(useThreadStore.getState().activeQuestionIndex).toBe(0);
    });

    it("resolveQuestion updates local state and sends server request", async () => {
      getItemMock.mockReturnValue("{}");
      bindContextMock.mockResolvedValue(createBootstrap());
      sendRequestMock.mockResolvedValue({});
      const { useThreadStore } = await import("@/stores/thread-store");
      await useThreadStore.getState().hydrateWorkspace("workspace-1");

      useThreadStore
        .getState()
        .setPendingQuestions([createPendingQuestion("q-1")]);
      useThreadStore.getState().resolveQuestion("q-1", {
        selectedOptions: [0],
        customText: "Important",
      });

      // Check local state
      const resolved = useThreadStore
        .getState()
        .pendingQuestions.find((q) => q.question.id === "q-1");
      expect(resolved?.status).toBe("resolved");
      expect(resolved?.answer?.selectedOptions).toEqual([0]);

      // Check server call
      await vi.waitFor(() => {
        expect(sendRequestMock).toHaveBeenCalledWith(
          "question.resolve",
          expect.objectContaining({ questionId: "q-1" }),
        );
      });
    });

    it("resolveQuestion advances activeQuestionIndex", async () => {
      getItemMock.mockReturnValue("{}");
      bindContextMock.mockResolvedValue(createBootstrap());
      sendRequestMock.mockResolvedValue({});
      const { useThreadStore } = await import("@/stores/thread-store");
      await useThreadStore.getState().hydrateWorkspace("workspace-1");

      useThreadStore
        .getState()
        .setPendingQuestions([
          createPendingQuestion("q-1"),
          createPendingQuestion("q-2"),
          createPendingQuestion("q-3"),
        ]);
      useThreadStore
        .getState()
        .resolveQuestion("q-1", { selectedOptions: [0] });

      expect(useThreadStore.getState().activeQuestionIndex).toBe(1);
    });

    it("clearPendingQuestions empties questions and resets index", async () => {
      getItemMock.mockReturnValue("{}");
      bindContextMock.mockResolvedValue(createBootstrap());
      const { useThreadStore } = await import("@/stores/thread-store");
      await useThreadStore.getState().hydrateWorkspace("workspace-1");

      useThreadStore
        .getState()
        .setPendingQuestions([createPendingQuestion("q-1")]);
      useThreadStore.getState().clearPendingQuestions();

      expect(useThreadStore.getState().pendingQuestions).toEqual([]);
      expect(useThreadStore.getState().activeQuestionIndex).toBe(0);
    });

    it("selectThread clears pending questions", async () => {
      getItemMock.mockReturnValue("{}");
      // Call 1: hydrateWorkspace initial bindContext (activeThreadId defaults to thread-2)
      // Call 2: hydrateWorkspace rebind (resolveRestoredThreadId picks primary thread-1)
      // Call 3: selectThread("thread-1") bindContext
      bindContextMock
        .mockResolvedValueOnce(createBootstrap())
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

      useThreadStore
        .getState()
        .setPendingQuestions([
          createPendingQuestion("q-1"),
          createPendingQuestion("q-2"),
        ]);
      expect(useThreadStore.getState().pendingQuestions).toHaveLength(2);

      await useThreadStore.getState().selectThread("thread-1");

      expect(useThreadStore.getState().pendingQuestions).toEqual([]);
    });
  });
});
