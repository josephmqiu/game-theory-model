/**
 * Derived store — L3 computed state (solver results, readiness).
 * Ephemeral — not persisted. Recalculated on demand.
 */

import { createStore } from "zustand";
import type {
  ReadinessReport,
  SolverKind,
} from "shared/game-theory/types/readiness";
import type { SolverResult } from "shared/game-theory/types/solver-results";

export interface SensitivityAnalysis {
  sensitivities: Array<{
    assumption_id: string;
    impact: "result_changes" | "result_stable";
    description: string;
    affected_payoffs: string[];
    statement: string;
  }>;
}

export interface DerivedState {
  readinessReportsByFormalization: Record<string, ReadinessReport>;
  solverResultsByFormalization: Record<
    string,
    Partial<Record<SolverKind, SolverResult>>
  >;
  sensitivityByFormalizationAndSolver: Record<
    string,
    Partial<Record<SolverKind, SensitivityAnalysis>>
  >;
  dirtyFormalizations: Record<string, boolean>;
}

interface DerivedActions {
  markDirty: (formalizationIds: string[]) => void;
  resetDerived: () => void;
}

type DerivedStore = DerivedState & DerivedActions;

function createInitialState(): DerivedState {
  return {
    readinessReportsByFormalization: {},
    solverResultsByFormalization: {},
    sensitivityByFormalizationAndSolver: {},
    dirtyFormalizations: {},
  };
}

export const derivedStore = createStore<DerivedStore>((set, get) => ({
  ...createInitialState(),

  markDirty(formalizationIds) {
    const dirty = { ...get().dirtyFormalizations };
    for (const id of formalizationIds) {
      dirty[id] = true;
    }
    set({ dirtyFormalizations: dirty });
  },

  resetDerived() {
    set(createInitialState());
  },
}));

export function getDerivedState(): DerivedState {
  return derivedStore.getState();
}

export function resetDerivedState(): void {
  derivedStore.getState().resetDerived();
}
