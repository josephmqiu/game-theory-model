/**
 * AI store — provider config, model selection, streaming state.
 * Adapted from OpenPencil's agent-settings-store pattern.
 */

import { createStore, useStore } from "zustand";

export type AIProviderType = "anthropic" | "openai";

export interface AIProviderConfig {
  provider: AIProviderType;
  modelId: string;
  // API keys are managed server-side via env vars (ANTHROPIC_API_KEY).
  // Never store secrets in client-side state.
}

export interface AiState {
  provider: AIProviderConfig;
  isStreaming: boolean;
  streamingPhase: number | null;
  lastError: string | null;
}

interface AiActions {
  setProvider: (config: Partial<AIProviderConfig>) => void;
  setStreaming: (streaming: boolean, phase?: number | null) => void;
  setError: (error: string | null) => void;
}

type AiStore = AiState & AiActions;

const initialState: AiState = {
  provider: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-5-20250514",
  },
  isStreaming: false,
  streamingPhase: null,
  lastError: null,
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
}));

export function useAiStore<T>(selector: (state: AiStore) => T): T {
  return useStore(aiStore, selector);
}
