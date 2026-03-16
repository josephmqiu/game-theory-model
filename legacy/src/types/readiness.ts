import type { CanonicalStore, SolverKind, SolverReadiness } from './canonical'
import type { Formalization } from './formalizations'

export type { SolverKind, SolverReadiness }

export interface SolverGateResult {
  eligible: boolean
  blockers: string[]
  warnings: string[]
  completeness: number
  confidence_floor: number
}

export interface SolverRequirement {
  solver: SolverKind
  check: (formalization: Formalization, store: CanonicalStore) => SolverGateResult
}

export interface ReadinessReport {
  formalization_id: string
  computed_at: string
  readiness: SolverReadiness
  per_solver: Partial<Record<SolverKind, SolverGateResult>>
}
