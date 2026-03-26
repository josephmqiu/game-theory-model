import { create } from "zustand";
import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
  ThreadMessageState,
  ThreadState,
} from "../../shared/types/workspace-state";
import type { ChatMessage } from "@/services/ai/ai-types";
import type {
  WorkspaceRuntimeBootstrap,
  WorkspaceRuntimePushEnvelope,
} from "../../shared/types/workspace-runtime";
import { workspaceRuntimeClient } from "@/services/ai/workspace-runtime-client";
import { appStorage } from "@/utils/app-storage";

const LAST_ACTIVE_THREAD_STORAGE_KEY =
  "game-theory-analyzer-last-active-thread-by-workspace";

interface ThreadDetailState {
  thread: ThreadState;
  messages: ThreadMessageState[];
  activities: ActivityEntry[];
}

interface ThreadStoreState {
  workspaceId?: string;
  activeThreadId?: string;
  threads: ThreadState[];
  activeThreadDetail: ThreadDetailState | null;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
  overlayMessages: ChatMessage[];
  isLoading: boolean;
  isCreating: boolean;
  error?: string;

  hydrateWorkspace: (workspaceId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  refreshActiveThreadDetail: () => Promise<void>;
  refreshAndClearOverlay: () => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  createThread: (title?: string) => Promise<void>;
  setActiveThreadIdentity: (identity: {
    workspaceId?: string;
    threadId?: string;
  }) => void;
  clearProjection: () => void;
  clearOverlayMessages: () => void;
  addOverlayMessage: (message: ChatMessage) => void;
  replaceOverlayMessages: (messages: ChatMessage[]) => void;
  updateOverlayMessageById: (
    id: string,
    updates: Partial<
      Pick<
        ChatMessage,
        "content" | "isStreaming" | "attachments" | "toolStatus" | "toolName"
      >
    >,
  ) => void;
  updateLastOverlayAssistantMessage: (content: string) => void;
}

function readStoredThreadSelections(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = appStorage.getItem(LAST_ACTIVE_THREAD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStoredThreadSelection(
  workspaceId: string,
  threadId: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = readStoredThreadSelections();
    appStorage.setItem(
      LAST_ACTIVE_THREAD_STORAGE_KEY,
      JSON.stringify({
        ...current,
        [workspaceId]: threadId,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}

function getStoredThreadSelection(workspaceId: string): string | undefined {
  return readStoredThreadSelections()[workspaceId];
}

// Resolve which thread to activate on workspace load.
// Priority: stored selection > newest (threads are ORDER BY updated_at DESC
// from the server, so threads[0] is most recently active) > primary thread.
function resolveRestoredThreadId(
  threads: ThreadState[],
  storedThreadId?: string,
): string | undefined {
  if (
    storedThreadId &&
    threads.some((thread) => thread.id === storedThreadId)
  ) {
    return storedThreadId;
  }

  return threads.find((thread) => thread.isPrimary)?.id ?? threads[0]?.id;
}

function shouldClearOverlayMessages(
  overlayMessages: ChatMessage[],
  detail: ThreadDetailState | null,
): boolean {
  if (!detail || overlayMessages.length === 0) {
    return false;
  }

  const userOverlay = overlayMessages.find(
    (message) => message.role === "user",
  );
  const assistantOverlay = [...overlayMessages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" && !message.id.startsWith("tool-"),
    );

  if (!assistantOverlay || assistantOverlay.isStreaming) {
    return false;
  }

  const projectedHasAssistant = detail.messages.some(
    (message) =>
      message.role === "assistant" &&
      message.content === assistantOverlay.content,
  );
  if (!projectedHasAssistant) {
    return false;
  }

  return userOverlay
    ? detail.messages.some(
        (message) =>
          message.role === "user" && message.content === userOverlay.content,
      )
    : true;
}

function toThreadDetailStateFromBootstrap(
  bootstrap: WorkspaceRuntimeBootstrap,
): ThreadDetailState | null {
  if (!bootstrap.activeThreadDetail) {
    return null;
  }

  return {
    thread: bootstrap.activeThreadDetail.thread,
    messages: bootstrap.activeThreadDetail.messages,
    activities: bootstrap.activeThreadDetail.activities,
  };
}

function applyBootstrap(bootstrap: WorkspaceRuntimeBootstrap): void {
  useThreadStore.setState((state) => {
    const activeThreadDetail = toThreadDetailStateFromBootstrap(bootstrap);
    const shouldClearOverlay = shouldClearOverlayMessages(
      state.overlayMessages,
      activeThreadDetail,
    );

    if (bootstrap.workspaceId && bootstrap.activeThreadId) {
      writeStoredThreadSelection(
        bootstrap.workspaceId,
        bootstrap.activeThreadId,
      );
    }

    return {
      workspaceId: bootstrap.workspaceId,
      threads: bootstrap.threads,
      activeThreadId: bootstrap.activeThreadId,
      activeThreadDetail,
      latestRun: bootstrap.latestRun,
      latestPhaseTurns: bootstrap.latestPhaseTurns,
      overlayMessages: shouldClearOverlay ? [] : state.overlayMessages,
      isLoading: false,
      isCreating: false,
      error: undefined,
    };
  });
}

function applyThreadsPush(push: WorkspaceRuntimePushEnvelope<"threads">): void {
  let rebindTarget: {
    workspaceId: string;
    activeThreadId: string;
  } | null = null;

  useThreadStore.setState((state) => {
    if (state.workspaceId !== push.payload.workspaceId) {
      return state;
    }

    const nextActiveThreadId =
      state.activeThreadId &&
      push.payload.threads.some((thread) => thread.id === state.activeThreadId)
        ? state.activeThreadId
        : resolveRestoredThreadId(
            push.payload.threads,
            getStoredThreadSelection(push.payload.workspaceId),
          );

    if (
      nextActiveThreadId &&
      nextActiveThreadId !== state.activeThreadId &&
      push.payload.workspaceId
    ) {
      rebindTarget = {
        workspaceId: push.payload.workspaceId,
        activeThreadId: nextActiveThreadId,
      };
    }

    return {
      threads: push.payload.threads,
      activeThreadId: nextActiveThreadId,
      activeThreadDetail:
        nextActiveThreadId &&
        state.activeThreadDetail?.thread.id === nextActiveThreadId
          ? state.activeThreadDetail
          : nextActiveThreadId === state.activeThreadId
            ? state.activeThreadDetail
            : null,
      latestRun:
        nextActiveThreadId === state.activeThreadId ? state.latestRun : null,
      latestPhaseTurns:
        nextActiveThreadId === state.activeThreadId
          ? state.latestPhaseTurns
          : [],
      error: undefined,
    };
  });

  if (rebindTarget) {
    void workspaceRuntimeClient.bindContext(rebindTarget);
  }
}

function applyThreadDetailPush(
  push: WorkspaceRuntimePushEnvelope<"thread-detail">,
): void {
  useThreadStore.setState((state) => {
    if (
      state.workspaceId !== push.payload.workspaceId ||
      state.activeThreadId !== push.payload.threadId
    ) {
      return state;
    }

    const activeThreadDetail = push.payload.detail
      ? {
          thread: push.payload.detail.thread,
          messages: push.payload.detail.messages,
          activities: push.payload.detail.activities,
        }
      : null;

    return {
      activeThreadDetail,
      overlayMessages: shouldClearOverlayMessages(
        state.overlayMessages,
        activeThreadDetail,
      )
        ? []
        : state.overlayMessages,
      error: undefined,
    };
  });
}

function applyRunDetailPush(
  push: WorkspaceRuntimePushEnvelope<"run-detail">,
): void {
  useThreadStore.setState((state) => {
    if (
      state.workspaceId !== push.payload.workspaceId ||
      state.activeThreadId !== push.payload.threadId
    ) {
      return state;
    }

    return {
      latestRun: push.payload.latestRun,
      latestPhaseTurns: push.payload.latestPhaseTurns,
      error: undefined,
    };
  });
}

export const useThreadStore = create<ThreadStoreState>((set, get) => ({
  workspaceId: undefined,
  activeThreadId: undefined,
  threads: [],
  activeThreadDetail: null,
  latestRun: null,
  latestPhaseTurns: [],
  overlayMessages: [],
  isLoading: false,
  isCreating: false,
  error: undefined,

  async hydrateWorkspace(workspaceId) {
    set({
      workspaceId,
      activeThreadId: undefined,
      activeThreadDetail: null,
      overlayMessages: [],
      isLoading: true,
      error: undefined,
    });

    try {
      const bootstrap = await workspaceRuntimeClient.bindContext({
        workspaceId,
        activeThreadId: getStoredThreadSelection(workspaceId),
      });
      const nextActiveThreadId = resolveRestoredThreadId(
        bootstrap.threads,
        getStoredThreadSelection(workspaceId),
      );
      if (
        nextActiveThreadId &&
        nextActiveThreadId !== bootstrap.activeThreadId
      ) {
        const rebound = await workspaceRuntimeClient.bindContext({
          workspaceId: bootstrap.workspaceId,
          activeThreadId: nextActiveThreadId,
        });
        applyBootstrap(rebound);
      } else {
        applyBootstrap(bootstrap);
      }
    } catch (error) {
      set({
        threads: [],
        activeThreadId: undefined,
        activeThreadDetail: null,
        latestRun: null,
        latestPhaseTurns: [],
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to load threads.",
      });
    }
  },

  async refreshThreads() {
    const workspaceId = get().workspaceId;
    if (!workspaceId) {
      return;
    }
    applyBootstrap(
      await workspaceRuntimeClient.bindContext({
        workspaceId,
        activeThreadId: get().activeThreadId,
      }),
    );
  },

  async refreshActiveThreadDetail() {
    const workspaceId = get().workspaceId;
    if (!workspaceId) {
      return;
    }
    applyBootstrap(
      await workspaceRuntimeClient.bindContext({
        workspaceId,
        activeThreadId: get().activeThreadId,
      }),
    );
  },

  async refreshAndClearOverlay() {
    const workspaceId = get().workspaceId;
    if (!workspaceId) {
      set({
        activeThreadDetail: null,
        overlayMessages: [],
        latestRun: null,
        latestPhaseTurns: [],
      });
      return;
    }
    applyBootstrap(
      await workspaceRuntimeClient.bindContext({
        workspaceId,
        activeThreadId: get().activeThreadId,
      }),
    );
  },

  async selectThread(threadId) {
    const workspaceId = get().workspaceId;
    set({
      activeThreadId: threadId,
      activeThreadDetail: null,
      latestRun: null,
      latestPhaseTurns: [],
      overlayMessages: [],
      error: undefined,
    });

    try {
      if (!workspaceId) {
        throw new Error("No active workspace.");
      }
      const bootstrap = await workspaceRuntimeClient.bindContext({
        workspaceId,
        activeThreadId: threadId,
      });
      applyBootstrap(bootstrap);
      writeStoredThreadSelection(workspaceId, threadId);
    } catch (error) {
      set({
        activeThreadDetail: null,
        latestRun: null,
        latestPhaseTurns: [],
        error:
          error instanceof Error ? error.message : "Failed to load thread.",
      });
      if (workspaceId) {
        await get().refreshThreads();
      }
    }
  },

  async createThread(title) {
    const workspaceId = get().workspaceId;
    if (!workspaceId) {
      return;
    }

    set({
      isCreating: true,
      error: undefined,
    });

    try {
      const response = await workspaceRuntimeClient.sendRequest<{
        workspaceId: string;
        thread: ThreadState;
      }>("workspace.thread.create", {
        workspaceId,
        ...(title?.trim() ? { title: title.trim() } : {}),
      });
      const bootstrap = await workspaceRuntimeClient.bindContext({
        workspaceId: response.workspaceId,
        activeThreadId: response.thread.id,
      });
      applyBootstrap(bootstrap);
      set({
        isCreating: false,
        overlayMessages: [],
      });
      writeStoredThreadSelection(response.workspaceId, response.thread.id);
    } catch (error) {
      set({
        isCreating: false,
        error:
          error instanceof Error ? error.message : "Failed to create thread.",
      });
    }
  },

  setActiveThreadIdentity(identity) {
    const nextWorkspaceId = identity.workspaceId ?? get().workspaceId;
    const nextThreadId = identity.threadId ?? get().activeThreadId;

    set({
      workspaceId: nextWorkspaceId,
      activeThreadId: nextThreadId,
    });

    if (nextWorkspaceId && nextThreadId) {
      writeStoredThreadSelection(nextWorkspaceId, nextThreadId);
      void workspaceRuntimeClient.bindContext({
        workspaceId: nextWorkspaceId,
        activeThreadId: nextThreadId,
      });
    }
  },

  clearProjection() {
    workspaceRuntimeClient.disconnect();
    set({
      workspaceId: undefined,
      activeThreadId: undefined,
      threads: [],
      activeThreadDetail: null,
      latestRun: null,
      latestPhaseTurns: [],
      overlayMessages: [],
      isLoading: false,
      isCreating: false,
      error: undefined,
    });
  },

  clearOverlayMessages() {
    set({ overlayMessages: [] });
  },

  addOverlayMessage(message) {
    set((state) => ({
      overlayMessages: [...state.overlayMessages, message],
    }));
  },

  replaceOverlayMessages(messages) {
    set({ overlayMessages: messages });
  },

  updateOverlayMessageById(id, updates) {
    set((state) => ({
      overlayMessages: state.overlayMessages.map((message) =>
        message.id === id ? { ...message, ...updates } : message,
      ),
    }));
  },

  updateLastOverlayAssistantMessage(content) {
    set((state) => {
      const overlayMessages = [...state.overlayMessages];

      for (let index = overlayMessages.length - 1; index >= 0; index -= 1) {
        const message = overlayMessages[index];
        if (message.role === "assistant" && !message.id.startsWith("tool-")) {
          overlayMessages[index] = { ...message, content };
          break;
        }
      }

      return { overlayMessages };
    });
  },
}));

workspaceRuntimeClient.subscribe((envelope) => {
  if (envelope.type === "bootstrap") {
    applyBootstrap(envelope.payload);
    return;
  }

  switch (envelope.channel) {
    case "threads":
      applyThreadsPush(envelope as WorkspaceRuntimePushEnvelope<"threads">);
      return;
    case "thread-detail":
      applyThreadDetailPush(
        envelope as WorkspaceRuntimePushEnvelope<"thread-detail">,
      );
      return;
    case "run-detail":
      applyRunDetailPush(
        envelope as WorkspaceRuntimePushEnvelope<"run-detail">,
      );
      return;
  }
});
