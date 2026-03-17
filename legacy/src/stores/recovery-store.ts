/**
 * Recovery store — tracks file load failure state for user-facing recovery UI.
 */

import { createStore, useStore } from "zustand";

type RecoveryStage = "parse" | "migration" | "validation" | "structural";

interface RecoveryError {
  message: string;
  issues?: string[];
}

export interface RecoveryState {
  active: boolean;
  stage: RecoveryStage | null;
  error: RecoveryError | null;
  rawContent: string | null;
  filePath: string | null;
}

interface RecoveryActions {
  enterRecovery: (params: {
    stage: RecoveryStage;
    error: RecoveryError;
    rawContent: string | null;
    filePath: string | null;
  }) => void;
  setRawContent: (content: string) => void;
  clearRecovery: () => void;
}

type RecoveryStore = RecoveryState & RecoveryActions;

function createInitialState(): RecoveryState {
  return {
    active: false,
    stage: null,
    error: null,
    rawContent: null,
    filePath: null,
  };
}

export const recoveryStore = createStore<RecoveryStore>((set) => ({
  ...createInitialState(),

  enterRecovery({ stage, error, rawContent, filePath }) {
    set({
      active: true,
      stage,
      error,
      rawContent,
      filePath,
    });
  },

  setRawContent(content) {
    set({ rawContent: content });
  },

  clearRecovery() {
    set(createInitialState());
  },
}));

export function useRecoveryStore<T>(selector: (state: RecoveryStore) => T): T {
  return useStore(recoveryStore, selector);
}
