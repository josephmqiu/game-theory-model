import { create } from "zustand";
import type {
  ActivityEntry,
  ThreadMessageState,
  ThreadState,
} from "../../shared/types/workspace-state";
import type { ChatMessage } from "@/services/ai/ai-types";
import {
  createThread as createThreadRequest,
  fetchThreadDetail,
  fetchThreads,
  type ThreadDetailResponse,
} from "@/services/ai/thread-client";
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

  return threads[0]?.id ?? threads.find((thread) => thread.isPrimary)?.id;
}

function toThreadDetailState(detail: ThreadDetailResponse): ThreadDetailState {
  return {
    thread: detail.thread,
    messages: detail.messages,
    activities: detail.activities,
  };
}

async function loadThreadDetail(
  threadId: string,
  workspaceId?: string,
): Promise<ThreadDetailState> {
  const detail = await fetchThreadDetail(threadId, workspaceId);
  return toThreadDetailState(detail);
}

export const useThreadStore = create<ThreadStoreState>((set, get) => ({
  workspaceId: undefined,
  activeThreadId: undefined,
  threads: [],
  activeThreadDetail: null,
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
      const response = await fetchThreads(workspaceId);
      const nextActiveThreadId = resolveRestoredThreadId(
        response.threads,
        getStoredThreadSelection(workspaceId),
      );

      set({
        workspaceId: response.workspaceId,
        threads: response.threads,
        activeThreadId: nextActiveThreadId,
        activeThreadDetail: null,
        isLoading: false,
        error: undefined,
      });

      if (nextActiveThreadId) {
        const detail = await loadThreadDetail(
          nextActiveThreadId,
          response.workspaceId,
        );
        set({
          activeThreadDetail: detail,
        });
        writeStoredThreadSelection(response.workspaceId, nextActiveThreadId);
      }
    } catch (error) {
      set({
        threads: [],
        activeThreadId: undefined,
        activeThreadDetail: null,
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

    const response = await fetchThreads(workspaceId);
    const currentActiveThreadId = get().activeThreadId;
    const nextActiveThreadId =
      currentActiveThreadId &&
      response.threads.some((thread) => thread.id === currentActiveThreadId)
        ? currentActiveThreadId
        : resolveRestoredThreadId(
            response.threads,
            getStoredThreadSelection(workspaceId),
          );

    set({
      workspaceId: response.workspaceId,
      threads: response.threads,
      activeThreadId: nextActiveThreadId,
      activeThreadDetail:
        nextActiveThreadId &&
        get().activeThreadDetail?.thread.id === nextActiveThreadId
          ? get().activeThreadDetail
          : null,
      error: undefined,
    });

    if (nextActiveThreadId) {
      writeStoredThreadSelection(response.workspaceId, nextActiveThreadId);
    }
  },

  async refreshActiveThreadDetail() {
    const activeThreadId = get().activeThreadId;
    if (!activeThreadId) {
      set({ activeThreadDetail: null });
      return;
    }

    const detail = await loadThreadDetail(activeThreadId, get().workspaceId);
    set({
      workspaceId: detail.thread.workspaceId,
      activeThreadDetail: detail,
      error: undefined,
    });
  },

  async refreshAndClearOverlay() {
    const activeThreadId = get().activeThreadId;
    if (!activeThreadId) {
      set({ activeThreadDetail: null, overlayMessages: [] });
      return;
    }

    const detail = await loadThreadDetail(activeThreadId, get().workspaceId);
    set({
      workspaceId: detail.thread.workspaceId,
      activeThreadDetail: detail,
      overlayMessages: [],
      error: undefined,
    });
  },

  async selectThread(threadId) {
    const workspaceId = get().workspaceId;
    set({
      activeThreadId: threadId,
      activeThreadDetail: null,
      overlayMessages: [],
      error: undefined,
    });

    try {
      const detail = await loadThreadDetail(threadId, workspaceId);
      set({
        workspaceId: detail.thread.workspaceId,
        activeThreadDetail: detail,
        error: undefined,
      });
      writeStoredThreadSelection(detail.thread.workspaceId, threadId);
    } catch (error) {
      set({
        activeThreadDetail: null,
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
      const response = await createThreadRequest({ workspaceId, title });
      const detail = await loadThreadDetail(
        response.thread.id,
        response.workspaceId,
      );
      set((state) => ({
        workspaceId: response.workspaceId,
        activeThreadId: response.thread.id,
        activeThreadDetail: detail,
        threads: [
          response.thread,
          ...state.threads.filter((thread) => thread.id !== response.thread.id),
        ],
        overlayMessages: [],
        isCreating: false,
        error: undefined,
      }));
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
    }
  },

  clearProjection() {
    set({
      workspaceId: undefined,
      activeThreadId: undefined,
      threads: [],
      activeThreadDetail: null,
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
