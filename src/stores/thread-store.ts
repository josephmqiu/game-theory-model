import { create } from "zustand";
import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
  ThreadMessageState,
  ThreadState,
} from "../../shared/types/workspace-state";
import type { PendingInteractionState } from "../../shared/types/user-input";
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

// ---------------------------------------------------------------------------
// Pending turn — bounded, single-turn optimistic state for the current
// streaming chat turn. Replaces the old overlayMessages array.
// ---------------------------------------------------------------------------

export interface PendingToolCall {
  id: string;
  toolName: string;
  status: "running" | "done" | "error";
  content: string;
}

export interface PendingTurn {
  correlationId: string;
  status: "streaming" | "reconciling";
  userMessage: { id: string; content: string; timestamp: number };
  assistantMessage: {
    id: string;
    content: string;
    timestamp: number;
    isStreaming: boolean;
  };
  toolCalls: PendingToolCall[];
  serverAssistantMessageId?: string;
}

interface ThreadStoreState {
  workspaceId?: string;
  activeThreadId?: string;
  threads: ThreadState[];
  activeThreadDetail: ThreadDetailState | null;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
  pendingTurn: PendingTurn | null;
  pendingInteractions: PendingInteractionState[];
  activeInteractionIndex: number;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  error?: string;

  hydrateWorkspace: (workspaceId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  refreshActiveThreadDetail: () => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  createThread: (title?: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  setActiveThreadIdentity: (identity: {
    workspaceId?: string;
    threadId?: string;
  }) => void;
  clearProjection: () => void;
  startPendingTurn: (
    correlationId: string,
    userMessage: PendingTurn["userMessage"],
    assistantMessage: PendingTurn["assistantMessage"],
  ) => void;
  updatePendingTurnAssistant: (content: string) => void;
  addPendingToolCall: (toolCall: PendingToolCall) => void;
  updatePendingToolCall: (
    id: string,
    updates: Partial<Pick<PendingToolCall, "status" | "content">>,
  ) => void;
  completePendingTurn: (serverAssistantMessageId?: string) => void;
  clearPendingTurn: () => void;
  setPendingInteractions: (interactions: PendingInteractionState[]) => void;
  resolveInteraction: (
    interactionId: string,
    answer: { selectedOptions?: number[]; customText?: string },
  ) => void;
  clearPendingInteractions: () => void;
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

// ID-based reconciliation: clear the pending turn when the server has
// persisted the assistant message we're waiting for.
function shouldClearPendingTurn(
  pendingTurn: PendingTurn | null,
  detail: ThreadDetailState | null,
): boolean {
  if (
    !pendingTurn ||
    pendingTurn.status !== "reconciling" ||
    !pendingTurn.serverAssistantMessageId ||
    !detail
  ) {
    return false;
  }

  return detail.messages.some(
    (message) => message.id === pendingTurn.serverAssistantMessageId,
  );
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
      pendingInteractions:
        bootstrap.activeThreadDetail?.pendingInteractions ?? [],
      activeInteractionIndex: 0,
      pendingTurn: shouldClearPendingTurn(state.pendingTurn, activeThreadDetail)
        ? null
        : state.pendingTurn,
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
    if (state.workspaceId !== push.event.workspaceId) {
      return state;
    }

    const nextActiveThreadId =
      state.activeThreadId &&
      push.event.threads.some((thread) => thread.id === state.activeThreadId)
        ? state.activeThreadId
        : resolveRestoredThreadId(
            push.event.threads,
            getStoredThreadSelection(push.event.workspaceId),
          );

    if (
      nextActiveThreadId &&
      nextActiveThreadId !== state.activeThreadId &&
      push.event.workspaceId
    ) {
      rebindTarget = {
        workspaceId: push.event.workspaceId,
        activeThreadId: nextActiveThreadId,
      };
    }

    return {
      threads: push.event.threads,
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
      state.workspaceId !== push.event.workspaceId ||
      state.activeThreadId !== push.event.threadId
    ) {
      return state;
    }

    const activeThreadDetail = push.event.detail
      ? {
          thread: push.event.detail.thread,
          messages: push.event.detail.messages,
          activities: push.event.detail.activities,
        }
      : null;

    const serverPendingInteractions =
      push.event.detail?.pendingInteractions ?? [];

    return {
      activeThreadDetail,
      pendingInteractions: serverPendingInteractions,
      activeInteractionIndex:
        serverPendingInteractions.length === 0
          ? 0
          : state.pendingInteractions.length === 0
            ? 0
            : state.activeInteractionIndex,
      pendingTurn: shouldClearPendingTurn(state.pendingTurn, activeThreadDetail)
        ? null
        : state.pendingTurn,
      error: undefined,
    };
  });
}

function applyRunDetailPush(
  push: WorkspaceRuntimePushEnvelope<"run-detail">,
): void {
  useThreadStore.setState((state) => {
    if (
      state.workspaceId !== push.event.workspaceId ||
      state.activeThreadId !== push.event.threadId
    ) {
      return state;
    }

    return {
      latestRun: push.event.latestRun,
      latestPhaseTurns: push.event.latestPhaseTurns,
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
  pendingTurn: null,
  pendingInteractions: [],
  activeInteractionIndex: 0,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  error: undefined,

  async hydrateWorkspace(workspaceId) {
    set({
      workspaceId,
      activeThreadId: undefined,
      activeThreadDetail: null,
      pendingTurn: null,
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

  async selectThread(threadId) {
    const workspaceId = get().workspaceId;
    set({
      activeThreadId: threadId,
      activeThreadDetail: null,
      latestRun: null,
      latestPhaseTurns: [],
      pendingTurn: null,
      pendingInteractions: [],
      activeInteractionIndex: 0,
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
        pendingTurn: null,
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

  async renameThread(threadId, title) {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;

    const previousThreads = get().threads;
    const previousDetail = get().activeThreadDetail;

    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, title, updatedAt: Date.now() } : t,
      ),
      activeThreadDetail:
        state.activeThreadDetail?.thread.id === threadId
          ? {
              ...state.activeThreadDetail,
              thread: { ...state.activeThreadDetail.thread, title },
            }
          : state.activeThreadDetail,
    }));

    try {
      await workspaceRuntimeClient.sendRequest("workspace.thread.rename", {
        workspaceId,
        threadId,
        title,
      });
    } catch (error) {
      set({
        threads: previousThreads,
        activeThreadDetail: previousDetail,
        error:
          error instanceof Error ? error.message : "Failed to rename thread.",
      });
    }
  },

  async deleteThread(threadId) {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;

    set({ isDeleting: true, error: undefined });

    const wasActive = get().activeThreadId === threadId;
    if (wasActive) {
      const remaining = get().threads.filter((t) => t.id !== threadId);
      const nextId = resolveRestoredThreadId(remaining);
      if (nextId) {
        set({
          activeThreadId: nextId,
          activeThreadDetail: null,
          latestRun: null,
          latestPhaseTurns: [],
          pendingTurn: null,
          pendingInteractions: [],
          activeInteractionIndex: 0,
        });
      }
    }

    try {
      await workspaceRuntimeClient.sendRequest("workspace.thread.delete", {
        workspaceId,
        threadId,
      });
      set({ isDeleting: false });
      if (wasActive) {
        const nextId = get().activeThreadId;
        if (nextId && workspaceId) {
          const bootstrap = await workspaceRuntimeClient.bindContext({
            workspaceId,
            activeThreadId: nextId,
          });
          applyBootstrap(bootstrap);
          writeStoredThreadSelection(workspaceId, nextId);
        }
      }
    } catch (error) {
      set({
        isDeleting: false,
        error:
          error instanceof Error ? error.message : "Failed to delete thread.",
      });
      await get().refreshThreads();
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
      pendingTurn: null,
      pendingInteractions: [],
      activeInteractionIndex: 0,
      isLoading: false,
      isCreating: false,
      isDeleting: false,
      error: undefined,
    });
  },

  startPendingTurn(correlationId, userMessage, assistantMessage) {
    set({
      pendingTurn: {
        correlationId,
        status: "streaming",
        userMessage,
        assistantMessage,
        toolCalls: [],
      },
    });
  },

  updatePendingTurnAssistant(content) {
    set((state) => {
      if (!state.pendingTurn) return state;
      return {
        pendingTurn: {
          ...state.pendingTurn,
          assistantMessage: { ...state.pendingTurn.assistantMessage, content },
        },
      };
    });
  },

  addPendingToolCall(toolCall) {
    set((state) => {
      if (!state.pendingTurn) return state;
      return {
        pendingTurn: {
          ...state.pendingTurn,
          toolCalls: [...state.pendingTurn.toolCalls, toolCall],
        },
      };
    });
  },

  updatePendingToolCall(id, updates) {
    set((state) => {
      if (!state.pendingTurn) return state;
      return {
        pendingTurn: {
          ...state.pendingTurn,
          toolCalls: state.pendingTurn.toolCalls.map((tc) =>
            tc.id === id ? { ...tc, ...updates } : tc,
          ),
        },
      };
    });
  },

  completePendingTurn(serverAssistantMessageId) {
    set((state) => {
      if (!state.pendingTurn) return state;
      return {
        pendingTurn: {
          ...state.pendingTurn,
          status: "reconciling",
          serverAssistantMessageId,
          assistantMessage: {
            ...state.pendingTurn.assistantMessage,
            isStreaming: false,
          },
        },
      };
    });
  },

  clearPendingTurn() {
    set({ pendingTurn: null });
  },

  setPendingInteractions(interactions) {
    set({
      pendingInteractions: interactions,
      activeInteractionIndex: 0,
    });
  },

  resolveInteraction(interactionId, answer) {
    const state = get();
    const workspaceId = state.workspaceId;
    const threadId = state.activeThreadId;

    set((prev) => {
      const nextInteractions = prev.pendingInteractions.map((interaction) =>
        interaction.kind === "question" &&
        interaction.question.id === interactionId
          ? {
              ...interaction,
              status: "resolved" as const,
              answer: {
                questionId: interactionId,
                ...answer,
                resolvedAt: Date.now(),
              },
            }
          : interaction,
      );
      const nextIndex = nextInteractions.findIndex(
        (interaction) => interaction.status === "pending",
      );
      return {
        pendingInteractions: nextInteractions,
        activeInteractionIndex:
          nextIndex >= 0 ? nextIndex : prev.activeInteractionIndex,
      };
    });

    if (workspaceId && threadId) {
      void workspaceRuntimeClient.sendRequest("interaction.respond", {
        workspaceId,
        threadId,
        interactionId,
        kind: "question",
        ...answer,
      });
    }
  },

  clearPendingInteractions() {
    set({ pendingInteractions: [], activeInteractionIndex: 0 });
  },
}));

workspaceRuntimeClient.subscribe((envelope) => {
  if (envelope.type === "bootstrap") {
    applyBootstrap(envelope.payload);
    return;
  }

  switch (envelope.topic) {
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
