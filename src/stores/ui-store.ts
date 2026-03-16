/**
 * UI store — L2 view state. Panel layout, sidebar, inspector.
 * Route state is handled by TanStack Router, not here.
 */

import { createStore, useStore } from "zustand";

type ActivePanel =
  | "overview"
  | "evidence"
  | "players"
  | "scenarios"
  | "timeline"
  | "settings";
type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface InspectorTarget {
  entityType: string;
  entityId: string;
}

export interface UiState {
  activePanel: ActivePanel;
  activePhase: PhaseId | null;
  activeGameId: string | null;
  activeFormalizationId: string | null;
  inspectedTarget: InspectorTarget | null;
  sidebarCollapsed: boolean;
  aiPanelOpen: boolean;
  inspectorOpen: boolean;
  manualMode: boolean;
}

interface UiActions {
  setActivePanel: (panel: ActivePanel) => void;
  setActivePhase: (phase: PhaseId | null) => void;
  setActiveGame: (gameId: string | null) => void;
  setActiveFormalization: (formalizationId: string | null) => void;
  setInspectedTarget: (target: InspectorTarget | null) => void;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
  toggleInspector: () => void;
  setManualMode: (manual: boolean) => void;
}

type UiStore = UiState & UiActions;

const initialState: UiState = {
  activePanel: "overview",
  activePhase: null,
  activeGameId: null,
  activeFormalizationId: null,
  inspectedTarget: null,
  sidebarCollapsed: false,
  aiPanelOpen: false,
  inspectorOpen: true,
  manualMode: true,
};

export const uiStore = createStore<UiStore>((set) => ({
  ...initialState,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setActivePhase: (phase) => set({ activePhase: phase }),
  setActiveGame: (gameId) => set({ activeGameId: gameId }),
  setActiveFormalization: (formalizationId) =>
    set({ activeFormalizationId: formalizationId }),
  setInspectedTarget: (target) => set({ inspectedTarget: target }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setManualMode: (manual) => set({ manualMode: manual }),
}));

export function useUiStore<T>(selector: (state: UiStore) => T): T {
  return useStore(uiStore, selector);
}
