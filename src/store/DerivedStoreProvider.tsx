import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'

import { getDerivedStore, ensureReadiness, runSolver } from './derived'
import type { DerivedState } from './derived'
import { useAppStore } from './StoreProvider'
import type { SolverKind } from '../types/canonical'
import type { SolverResultUnion } from '../types/solver-results'

const DerivedStoreCtx = createContext(getDerivedStore())
const EMPTY_SOLVER_RESULTS: Partial<Record<SolverKind, SolverResultUnion>> = Object.freeze({})

export function DerivedStoreProvider({ children }: { children: ReactNode }): ReactNode {
  return <DerivedStoreCtx.Provider value={getDerivedStore()}>{children}</DerivedStoreCtx.Provider>
}

export function useDerivedStore<T>(selector: (state: DerivedState) => T): T {
  const store = useContext(DerivedStoreCtx)
  return useStore(store, selector)
}

export function useReadinessReport(formalizationId: string | null) {
  const canonical = useAppStore((state) => state.canonical)
  const report = useDerivedStore((state) =>
    formalizationId ? state.readinessReportsByFormalization[formalizationId] ?? null : null,
  )
  const isDirty = useDerivedStore((state) =>
    formalizationId ? state.dirtyFormalizations[formalizationId] ?? false : false,
  )

  useEffect(() => {
    if (formalizationId && (!report || isDirty)) {
      ensureReadiness(formalizationId, canonical)
    }
  }, [canonical, formalizationId, isDirty, report])

  return report
}

export function useSolverResults(formalizationId: string | null) {
  return useDerivedStore((state) =>
    formalizationId ? state.solverResultsByFormalization[formalizationId] ?? EMPTY_SOLVER_RESULTS : EMPTY_SOLVER_RESULTS,
  )
}

export function useSensitivityAnalysis(
  formalizationId: string | null,
  solver: import('../types').SolverKind | null,
) {
  return useDerivedStore((state) =>
    formalizationId && solver
      ? state.sensitivityByFormalizationAndSolver[formalizationId]?.[solver] ?? null
      : null,
  )
}

export function useRunSolver() {
  const canonical = useAppStore((state) => state.canonical)
  return (formalizationId: string, solver: import('../types').SolverKind) =>
    runSolver(formalizationId, solver, canonical)
}
