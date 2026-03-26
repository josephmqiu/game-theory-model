import { create } from "zustand";
import type { ChatAttachment } from "@/services/ai/ai-types";
import type { ModelGroup } from "@/types/agent-settings";
import { appStorage } from "@/utils/app-storage";

export type PanelCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const MODEL_PREFERENCE_STORAGE_KEY = "game-theory-analyzer-ai-model-preference";
const UI_PREFS_KEY = "game-theory-analyzer-ai-ui-preferences";

interface AIUIPrefs {
  isPanelOpen?: boolean;
  panelCorner?: PanelCorner;
  isMinimized?: boolean;
}

function readUIPrefs(): AIUIPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = appStorage.getItem(UI_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUIPrefs(partial: AIUIPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const current = readUIPrefs();
    appStorage.setItem(
      UI_PREFS_KEY,
      JSON.stringify({ ...current, ...partial }),
    );
  } catch {
    /* ignore */
  }
}

function readStoredModelPreference(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = appStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY);
    if (!value || value.trim().length === 0) return null;
    return value;
  } catch {
    return null;
  }
}

function writeStoredModelPreference(model: string): void {
  if (typeof window === "undefined") return;
  try {
    appStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, model);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

// Keep SSR/CSR first render deterministic to avoid hydration mismatch.
// Real preference is loaded on mount via hydrateModelPreference().
const initialPreferredModel = DEFAULT_MODEL;

export interface AIModelInfo {
  value: string;
  displayName: string;
  description: string;
}

interface AIState {
  isStreaming: boolean;
  isPanelOpen: boolean;
  model: string;
  preferredModel: string;
  availableModels: AIModelInfo[];
  modelGroups: ModelGroup[];
  isLoadingModels: boolean;
  panelCorner: PanelCorner;
  isMinimized: boolean;
  pendingAttachments: ChatAttachment[];
  abortController: AbortController | null;
  pendingPlan: { topic: string } | null;

  hydrateModelPreference: () => void;
  selectModel: (model: string) => void;
  setAvailableModels: (models: AIModelInfo[]) => void;
  setModelGroups: (groups: ModelGroup[]) => void;
  setLoadingModels: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setPanelCorner: (corner: PanelCorner) => void;
  toggleMinimize: () => void;
  addPendingAttachment: (attachment: ChatAttachment) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  setAbortController: (c: AbortController | null) => void;
  stopStreaming: () => void;
  setPendingPlan: (plan: { topic: string } | null) => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  isStreaming: false,
  isPanelOpen: true,
  model: initialPreferredModel,
  preferredModel: initialPreferredModel,
  availableModels: [],
  modelGroups: [],
  isLoadingModels: false,
  panelCorner: "bottom-left",
  isMinimized: false,
  pendingAttachments: [],
  abortController: null,
  pendingPlan: null,

  hydrateModelPreference: () => {
    const stored = readStoredModelPreference();
    if (stored) set({ model: stored, preferredModel: stored });
    const prefs = readUIPrefs();
    if (typeof prefs.isPanelOpen === "boolean")
      set({ isPanelOpen: prefs.isPanelOpen });
    if (prefs.panelCorner) set({ panelCorner: prefs.panelCorner });
    if (typeof prefs.isMinimized === "boolean")
      set({ isMinimized: prefs.isMinimized });
  },

  setStreaming: (isStreaming) => set({ isStreaming }),

  togglePanel: () => {
    const next = !get().isPanelOpen;
    set({ isPanelOpen: next });
    writeUIPrefs({ isPanelOpen: next });
  },

  setPanelOpen: (isPanelOpen) => {
    set({ isPanelOpen });
    writeUIPrefs({ isPanelOpen });
  },

  selectModel: (model) => {
    writeStoredModelPreference(model);
    set({ model, preferredModel: model });
  },
  setAvailableModels: (availableModels) => set({ availableModels }),
  setModelGroups: (modelGroups) => set({ modelGroups }),
  setLoadingModels: (isLoadingModels) => set({ isLoadingModels }),

  setPanelCorner: (panelCorner) => {
    set({ panelCorner });
    writeUIPrefs({ panelCorner });
  },
  toggleMinimize: () => {
    const next = !get().isMinimized;
    set({ isMinimized: next });
    writeUIPrefs({ isMinimized: next });
  },

  addPendingAttachment: (attachment) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, attachment] })),
  removePendingAttachment: (id) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id),
    })),
  clearPendingAttachments: () => set({ pendingAttachments: [] }),

  setAbortController: (abortController) => set({ abortController }),
  stopStreaming: () =>
    set((s) => {
      s.abortController?.abort();
      return { isStreaming: false, abortController: null };
    }),
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
}));
