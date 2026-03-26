import { create } from "zustand";
import { appStorage } from "@/utils/app-storage";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";

const STORAGE_KEY = "game-theory-analyzer-thread-settings";

export interface ThreadSettingsOverride {
  model?: string;
  effort?: AnalysisEffortLevel;
  webSearch?: boolean;
}

interface ThreadSettingsState {
  overrides: Record<string, ThreadSettingsOverride>;

  getThreadSettings: (threadId: string) => ThreadSettingsOverride;
  setThreadSetting: <K extends keyof ThreadSettingsOverride>(
    threadId: string,
    key: K,
    value: ThreadSettingsOverride[K],
  ) => void;
  clearThreadSettings: (threadId: string) => void;
  persist: () => void;
  hydrate: () => void;
}

export const useThreadSettingsStore = create<ThreadSettingsState>(
  (set, get) => ({
    overrides: {},

    getThreadSettings: (threadId) => get().overrides[threadId] ?? {},

    setThreadSetting: (threadId, key, value) => {
      set((state) => {
        const current = state.overrides[threadId] ?? {};
        const updated = { ...current, [key]: value };

        // Remove the key entirely if the value is undefined
        if (value === undefined) {
          delete updated[key];
        }

        // Remove the thread entry if no overrides remain
        const hasOverrides = Object.values(updated).some(
          (v) => v !== undefined,
        );

        const next = { ...state.overrides };
        if (hasOverrides) {
          next[threadId] = updated;
        } else {
          delete next[threadId];
        }

        return { overrides: next };
      });
      get().persist();
    },

    clearThreadSettings: (threadId) => {
      set((state) => {
        const next = { ...state.overrides };
        delete next[threadId];
        return { overrides: next };
      });
      get().persist();
    },

    persist: () => {
      try {
        const { overrides } = get();
        // Only persist threads that actually have overrides
        const pruned: Record<string, ThreadSettingsOverride> = {};
        for (const [id, settings] of Object.entries(overrides)) {
          const hasValues = Object.values(settings).some(
            (v) => v !== undefined,
          );
          if (hasValues) pruned[id] = settings;
        }
        appStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      } catch {
        // ignore
      }
    },

    hydrate: () => {
      try {
        const raw = appStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && typeof data === "object" && !Array.isArray(data)) {
          set({ overrides: data as Record<string, ThreadSettingsOverride> });
        }
      } catch {
        // ignore
      }
    },
  }),
);
