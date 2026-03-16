// Test-compatible in-memory stub for derived state used by pipeline tests.
// Production code uses src/stores/derived-store.ts (Zustand) instead.
// Domain tests should not depend on the React renderer's Zustand stores.

import type { SolverKind } from "../types/canonical.ts";
import type { ReadinessReport } from "../types/readiness.ts";
import type {
  SensitivityAnalysis,
  SolverResultUnion,
} from "../types/solver-results.ts";

export interface DerivedState {
  readinessReportsByFormalization: Record<string, ReadinessReport>;
  solverResultsByFormalization: Record<
    string,
    Partial<Record<SolverKind, SolverResultUnion>>
  >;
  sensitivityByFormalizationAndSolver: Record<
    string,
    Partial<Record<SolverKind, SensitivityAnalysis>>
  >;
  dirtyFormalizations: Record<string, boolean>;
}

function createInitialState(): DerivedState {
  return {
    readinessReportsByFormalization: {},
    solverResultsByFormalization: {},
    sensitivityByFormalizationAndSolver: {},
    dirtyFormalizations: {},
  };
}

let state: DerivedState = createInitialState();

/**
 * Minimal store wrapper that mirrors the Zustand vanilla store API surface
 * used by test files: `getState()` and `setState(updater)`.
 */
function createStoreAccessor() {
  return {
    getState: (): DerivedState => state,
    setState: (
      updater: DerivedState | ((prev: DerivedState) => DerivedState),
    ): void => {
      state = typeof updater === "function" ? updater(state) : updater;
    },
  };
}

const accessor = createStoreAccessor();

export function getDerivedStore() {
  return accessor;
}

export function resetDerivedState(): void {
  state = createInitialState();
}
