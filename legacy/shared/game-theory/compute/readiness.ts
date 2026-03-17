import type { CanonicalStore, SolverKind, SolverReadiness } from '../types/canonical'
import type { Formalization } from '../types/formalizations'
import type { ReadinessReport, SolverGateResult } from '../types/readiness'
import { solverKinds } from '../types/canonical'
import {
  candidateSolversForFormalization,
  checkSolverRequirement,
} from './solver-requirements'
import {
  collectRelevantEstimates,
  getFormalizationAssumptionIds,
} from './utils'

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function genericWarnings(formalization: Formalization, store: CanonicalStore): string[] {
  const warnings: string[] = []
  const assumptionIds = getFormalizationAssumptionIds(formalization, store)

  let unsupportedAssumptions = 0
  for (const assumptionId of assumptionIds) {
    const assumption = store.assumptions[assumptionId]
    if (!assumption) {
      continue
    }

    if ((assumption.supported_by ?? []).length === 0) {
      unsupportedAssumptions += 1
    }

    const staleMarker = assumption.stale_markers?.[0]
    if (staleMarker) {
      warnings.push(`Assumption "${assumption.statement}" is stale: ${staleMarker.reason}`)
    }
  }

  if (assumptionIds.length > 0 && unsupportedAssumptions > assumptionIds.length / 2) {
    warnings.push('Majority of assumptions lack evidence support.')
  }

  for (const estimate of collectRelevantEstimates(formalization, store)) {
    if (
      estimate.representation === 'interval_estimate' &&
      typeof estimate.min === 'number' &&
      typeof estimate.max === 'number'
    ) {
      const width = estimate.max - estimate.min
      const scale = Math.max(Math.abs(estimate.max), 1)
      if (width > 0.5 * scale) {
        warnings.push('Wide interval estimates may produce unreliable equilibria.')
        break
      }
    }
  }

  for (const estimate of collectRelevantEstimates(formalization, store)) {
    if (estimate.confidence < 0.3) {
      warnings.push(`Low confidence input (${estimate.rationale}): ${estimate.confidence.toFixed(2)}.`)
      break
    }
  }

  return uniqueStrings(warnings)
}

export function checkSolverGate(
  solver: SolverKind,
  formalization: Formalization,
  store: CanonicalStore,
): SolverGateResult {
  const gate = checkSolverRequirement(solver, formalization, store)
  const warnings = uniqueStrings([...gate.warnings, ...genericWarnings(formalization, store)])
  return {
    ...gate,
    warnings,
  }
}

export function computeReadiness(
  formalization: Formalization,
  store: CanonicalStore,
): ReadinessReport {
  const perSolver: Partial<Record<SolverKind, SolverGateResult>> = {}
  for (const solver of solverKinds) {
    perSolver[solver] = checkSolverGate(solver, formalization, store)
  }

  const candidates = candidateSolversForFormalization(formalization)
  const candidateResults = candidates.map((solver) => perSolver[solver]!).filter(Boolean)
  const eligibleResults = candidates
    .filter((solver) => perSolver[solver]?.eligible)
    .map((solver) => ({ solver, gate: perSolver[solver]! }))

  const supportedSolvers = eligibleResults.map(({ solver }) => solver)
  const readiness: SolverReadiness = {
    overall: supportedSolvers.length === 0
      ? 'not_ready'
      : eligibleResults.some(({ gate }) => gate.warnings.length > 0)
        ? 'usable_with_warnings'
        : 'ready',
    completeness_score: candidateResults.length > 0
      ? Math.max(...candidateResults.map((gate) => gate.completeness))
      : 0,
    confidence_floor: eligibleResults.length > 0
      ? Math.min(...eligibleResults.map(({ gate }) => gate.confidence_floor))
      : candidateResults.length > 0
        ? Math.min(...candidateResults.map((gate) => gate.confidence_floor))
        : 1,
    blockers: supportedSolvers.length === 0
      ? uniqueStrings(candidateResults.flatMap((gate) => gate.blockers))
      : [],
    warnings: uniqueStrings([
      ...candidateResults.flatMap((gate) => gate.warnings),
      ...genericWarnings(formalization, store),
    ]),
    supported_solvers: supportedSolvers,
  }

  return {
    formalization_id: formalization.id,
    computed_at: new Date().toISOString(),
    readiness,
    per_solver: perSolver,
  }
}
