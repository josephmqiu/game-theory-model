/**
 * AI store — provider config, model selection, streaming state, and agent chat.
 * Adapted from OpenPencil's agent-settings-store pattern.
 */

import { createStore, useStore } from "zustand";
import type { AIProviderType } from "@/types/agent-settings";

export interface AIProviderConfig {
  provider: AIProviderType;
  modelId: string;
  // API keys are managed server-side via env vars (ANTHROPIC_API_KEY).
  // Never store secrets in client-side state.
}

export interface AgentToolCallEntry {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  status: "pending" | "complete" | "error";
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking: string;
  toolCalls: AgentToolCallEntry[];
  isStreaming: boolean;
  timestamp: string;
}

export interface AiState {
  provider: AIProviderConfig;
  isStreaming: boolean;
  streamingPhase: number | null;
  lastError: string | null;
  agentMessages: AgentChatMessage[];
  abortController: AbortController | null;
}

interface AiActions {
  setProvider: (config: Partial<AIProviderConfig>) => void;
  setStreaming: (streaming: boolean, phase?: number | null) => void;
  setError: (error: string | null) => void;
  appendAgentMessage: (
    message: Omit<AgentChatMessage, "id" | "timestamp">,
  ) => void;
  updateLastAgentMessage: (
    update: Partial<
      Pick<
        AgentChatMessage,
        "content" | "thinking" | "isStreaming" | "toolCalls"
      >
    >,
  ) => void;
  addToolCallToLastMessage: (
    toolCall: Omit<AgentToolCallEntry, "status"> & {
      status?: AgentToolCallEntry["status"];
    },
  ) => void;
  updateToolCallResult: (
    toolCallId: string,
    result: unknown,
    durationMs: number,
  ) => void;
  clearAgentMessages: () => void;
  setAbortController: (controller: AbortController | null) => void;
  stopStreaming: () => void;
}

type AiStore = AiState & AiActions;

const initialState: AiState = {
  provider: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
  },
  isStreaming: false,
  streamingPhase: null,
  lastError: null,
  agentMessages: [],
  abortController: null,
};

export const aiStore = createStore<AiStore>((set, get) => ({
  ...initialState,

  setProvider(config) {
    set({ provider: { ...get().provider, ...config } });
  },

  setStreaming(streaming, phase = null) {
    set({ isStreaming: streaming, streamingPhase: phase });
  },

  setError(error) {
    set({ lastError: error });
  },

  appendAgentMessage(message) {
    const newMessage: AgentChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    set({ agentMessages: [...get().agentMessages, newMessage] });
  },

  updateLastAgentMessage(update) {
    const messages = get().agentMessages;
    if (messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const updated = messages.map((msg, i) =>
      i === lastIndex ? { ...msg, ...update } : msg,
    );
    set({ agentMessages: updated });
  },

  addToolCallToLastMessage(toolCall) {
    const messages = get().agentMessages;
    if (messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const entry: AgentToolCallEntry = {
      status: "pending",
      ...toolCall,
    };
    const updated = messages.map((msg, i) =>
      i === lastIndex ? { ...msg, toolCalls: [...msg.toolCalls, entry] } : msg,
    );
    set({ agentMessages: updated });
  },

  updateToolCallResult(toolCallId, result, durationMs) {
    const messages = get().agentMessages;
    if (messages.length === 0) return;
    const lastIndex = messages.length - 1;
    const updated = messages.map((msg, i) => {
      if (i !== lastIndex) return msg;
      const updatedToolCalls = msg.toolCalls.map((tc) =>
        tc.id === toolCallId
          ? { ...tc, result, durationMs, status: "complete" as const }
          : tc,
      );
      return { ...msg, toolCalls: updatedToolCalls };
    });
    set({ agentMessages: updated });
  },

  clearAgentMessages() {
    set({ agentMessages: [] });
  },

  setAbortController(controller) {
    set({ abortController: controller });
  },

  stopStreaming() {
    get().abortController?.abort();
    set({ abortController: null, isStreaming: false });
  },
}));

export function useAiStore<T>(selector: (state: AiStore) => T): T {
  return useStore(aiStore, selector);
}
