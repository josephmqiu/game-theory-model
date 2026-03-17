/**
 * UI store — L2 view state. Panel layout, sidebar.
 * Route state is handled by TanStack Router, not here.
 */

import { createStore, useStore } from "zustand";

interface PersistedShellPrefs {
  sidebarCollapsed: boolean;
  manualMode: boolean;
  chatPanelWidth: number;
}

const SHELL_PREFS_KEY = "game-theory.shell-prefs";

export interface UiState {
  activeGameId: string | null;
  activeFormalizationId: string | null;
  sidebarCollapsed: boolean;
  manualMode: boolean;
  chatPanelWidth: number;
  hydrated: boolean;
}

interface UiActions {
  setActiveGame: (gameId: string | null) => void;
  setActiveFormalization: (formalizationId: string | null) => void;
  toggleSidebar: () => void;
  setManualMode: (manual: boolean) => void;
  setChatPanelWidth: (width: number) => void;
  hydrate: (prefs: Partial<PersistedShellPrefs>) => void;
}

type UiStore = UiState & UiActions;

const initialState: UiState = {
  activeGameId: null,
  activeFormalizationId: null,
  sidebarCollapsed: false,
  manualMode: true,
  chatPanelWidth: 320,
  hydrated: false,
};

function isElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

function persistShellPrefs(
  state: Pick<UiState, "sidebarCollapsed" | "manualMode" | "chatPanelWidth">,
): void {
  if (typeof window === "undefined") return;

  const prefs: PersistedShellPrefs = {
    sidebarCollapsed: state.sidebarCollapsed,
    manualMode: state.manualMode,
    chatPanelWidth: state.chatPanelWidth,
  };

  if (isElectron()) {
    void window.electronAPI!.setPreference(
      SHELL_PREFS_KEY,
      JSON.stringify(prefs),
    );
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
  toggleSidebar: () =>
    set((s) => {
      const next = { sidebarCollapsed: !s.sidebarCollapsed };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  setManualMode: (manual) =>
    set((s) => {
      const next = { manualMode: manual };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  setChatPanelWidth: (width) =>
    set((s) => {
      const next = { chatPanelWidth: width };
      persistShellPrefs({ ...s, ...next });
      return next;
    }),
  hydrate: (prefs) =>
    set({
      sidebarCollapsed: prefs.sidebarCollapsed ?? false,
      manualMode: prefs.manualMode ?? true,
      chatPanelWidth: prefs.chatPanelWidth ?? 320,
      hydrated: true,
    }),
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
