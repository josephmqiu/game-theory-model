/**
 * UI store — L2 view state. Panel layout, sidebar, inspector.
 * Route state is handled by TanStack Router, not here.
 */

import { createStore, useStore } from "zustand";

interface PersistedShellPrefs {
  aiPanelOpen: boolean;
  aiPanelMinimized: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  manualMode: boolean;
}

const SHELL_PREFS_KEY = "game-theory.shell-prefs";

export interface InspectorTarget {
  entityType: string;
  entityId: string;
}

export interface UiState {
  activeGameId: string | null;
  activeFormalizationId: string | null;
  inspectedTarget: InspectorTarget | null;
  sidebarCollapsed: boolean;
  aiPanelOpen: boolean;
  aiPanelMinimized: boolean;
  inspectorOpen: boolean;
  manualMode: boolean;
  hydrated: boolean;
}

interface UiActions {
  setActiveGame: (gameId: string | null) => void;
  setActiveFormalization: (formalizationId: string | null) => void;
  setInspectedTarget: (target: InspectorTarget | null) => void;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanelMinimized: () => void;
  toggleInspector: () => void;
  setManualMode: (manual: boolean) => void;
  hydrate: (prefs: Partial<PersistedShellPrefs>) => void;
}

type UiStore = UiState & UiActions;

const initialState: UiState = {
  activeGameId: null,
  activeFormalizationId: null,
  inspectedTarget: null,
  sidebarCollapsed: false,
  aiPanelOpen: false,
  aiPanelMinimized: false,
  inspectorOpen: true,
  manualMode: true,
  hydrated: false,
};

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

function persistShellPrefs(
  state: Pick<
    UiState,
    | "aiPanelOpen"
    | "aiPanelMinimized"
    | "sidebarCollapsed"
    | "inspectorOpen"
    | "manualMode"
  >,
): void {
  if (typeof window === "undefined") return;

  const prefs: PersistedShellPrefs = {
    aiPanelOpen: state.aiPanelOpen,
    aiPanelMinimized: state.aiPanelMinimized,
    sidebarCollapsed: state.sidebarCollapsed,
    inspectorOpen: state.inspectorOpen,
    manualMode: state.manualMode,
  };

  if (isElectron()) {
    void window.electronAPI!.setPreference(SHELL_PREFS_KEY, JSON.stringify(prefs));
    return;
  }

  try {
    window.localStorage.setItem(SHELL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}

let hydratePromise: Promise<void> | null = null;

export const uiStore = createStore<UiStore>((set) => ({
  ...initialState,

  setActiveGame: (gameId) => set({ activeGameId: gameId }),
  setActiveFormalization: (formalizationId) =>
    set({ activeFormalizationId: formalizationId }),
  setInspectedTarget: (target) => set({ inspectedTarget: target }),
  toggleSidebar: () =>
    set((s) => {
      const next = { sidebarCollapsed: !s.sidebarCollapsed };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  toggleAiPanel: () =>
    set((s) => {
      const next = {
        aiPanelOpen: !s.aiPanelOpen,
        aiPanelMinimized: s.aiPanelOpen ? s.aiPanelMinimized : false,
      };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  setAiPanelOpen: (open) =>
    set((s) => {
      const next = {
        aiPanelOpen: open,
        aiPanelMinimized: open ? s.aiPanelMinimized : false,
      };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  toggleAiPanelMinimized: () =>
    set((s) => {
      const next = {
        aiPanelOpen: true,
        aiPanelMinimized: !s.aiPanelMinimized,
      };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  toggleInspector: () =>
    set((s) => {
      const next = { inspectorOpen: !s.inspectorOpen };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  setManualMode: (manual) =>
    set((s) => {
      const next = { manualMode: manual };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  hydrate: (prefs) =>
    set((state) => ({
      ...state,
      ...prefs,
      hydrated: true,
    })),
}));

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  return useStore(uiStore, selector);
}

export async function hydrateUiStore(): Promise<void> {
  if (typeof window === "undefined") return;
  if (uiStore.getState().hydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      let raw: string | null = null;

      if (isElectron()) {
        const prefs = await window.electronAPI!.getPreferences();
        raw = prefs[SHELL_PREFS_KEY] ?? null;
      } else {
        raw = window.localStorage.getItem(SHELL_PREFS_KEY);
      }

      if (!raw) {
        uiStore.getState().hydrate({});
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedShellPrefs>;
      uiStore.getState().hydrate(parsed);
    } catch {
      uiStore.getState().hydrate({});
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}
