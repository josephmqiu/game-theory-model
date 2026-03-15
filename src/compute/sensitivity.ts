import type { CanonicalStore } from '../types/canonical'
import type { Formalization, NormalFormModel, ExtensiveFormModel } from '../types/formalizations'
import type {
  AssumptionSensitivity,
  BackwardInductionResult,
  NashResult,
  SensitivityAnalysis,
  SensitivitySummary,
  SolverResultUnion,
  ThresholdResult,
} from '../types/solver-results'
import { solveNash } from './nash'
import { eliminateDominance } from './dominance'
import { computeExpectedUtility } from './expected-utility'
import { solveBackwardInduction } from './backward-induction'
import { computeBayesianUpdate } from './bayesian'
import { getFormalizationAssumptionIds, getFormalizationNodes, readEstimateNumeric } from './utils'

type SolverFingerprint = string

function fingerprintResult(result: SolverResultUnion): SolverFingerprint {
  switch (result.solver) {
    case 'nash':
      return JSON.stringify(
        result.equilibria.map((equilibrium) => ({
          type: equilibrium.type,
          strategies: equilibrium.strategies,
        })),
      )
    case 'dominance':
      return JSON.stringify(result.eliminated_strategies)
    case 'expected_utility':
      return JSON.stringify(
        Object.fromEntries(
          Object.entries(result.player_utilities).map(([playerId, utility]) => [playerId, utility.best_response]),
        ),
      )
    case 'backward_induction':
      return JSON.stringify(result.solution_path)
    case 'bayesian_update':
      return JSON.stringify(result.posterior_beliefs)
  }
}

function rerunSolver(
  formalization: Formalization,
  solver: SolverResultUnion['solver'],
  canonical: CanonicalStore,
): SolverResultUnion {
  switch (solver) {
    case 'nash':
      return solveNash(formalization as NormalFormModel, canonical)
    case 'dominance':
      return eliminateDominance(formalization as NormalFormModel, canonical)
    case 'expected_utility':
      return computeExpectedUtility(formalization as NormalFormModel, canonical)
    case 'backward_induction':
      return solveBackwardInduction(formalization as ExtensiveFormModel, canonical)
    case 'bayesian_update':
      return computeBayesianUpdate(formalization as import('../types').BayesianGameModel, canonical)
  }
}

function cloneCanonical(store: CanonicalStore): CanonicalStore {
  return structuredClone(store)
}

function evaluateChangedResult(
  formalization: Formalization,
  solverResult: SolverResultUnion,
  canonical: CanonicalStore,
  mutate: (draft: CanonicalStore) => void,
): { changed: boolean; margin: number; threshold: number } {
  const draft = cloneCanonical(canonical)
  mutate(draft)
  const rerun = rerunSolver(draft.formalizations[formalization.id] as Formalization, solverResult.solver, draft)
  return {
    changed: fingerprintResult(rerun) !== fingerprintResult(solverResult),
    margin: 0,
    threshold: 0,
  }
}

export function analyzeSensitivity(
  formalization: Formalization,
  solverResult: SolverResultUnion,
  canonical: CanonicalStore,
): SensitivityAnalysis {
  const payoffSensitivities: SensitivityAnalysis['payoff_sensitivities'] = []
  const thresholdAnalysis: ThresholdResult[] = []

  if (formalization.kind === 'normal_form') {
    const nf = formalization as NormalFormModel
    for (const cell of nf.payoff_cells) {
      for (const [playerId, estimate] of Object.entries(cell.payoffs)) {
        const numeric = readEstimateNumeric(estimate)
        if (!numeric) {
          continue
        }

        const step = Math.max(Math.abs(numeric.value) * 0.05, 0.25)
        let thresholdValue = numeric.value
        let direction: 'increase' | 'decrease' = 'increase'
        let changed = false

        for (const multiplier of Array.from({ length: 20 }, (_, index) => index + 1)) {
          const delta = step * multiplier
          const upCheck = evaluateChangedResult(formalization, solverResult, canonical, (draft) => {
            const payoff = (draft.formalizations[formalization.id] as NormalFormModel).payoff_cells.find(
              (candidate) =>
                candidate.strategy_profile[Object.keys(cell.strategy_profile)[0]!] === cell.strategy_profile[Object.keys(cell.strategy_profile)[0]!] &&
                candidate.strategy_profile[Object.keys(cell.strategy_profile)[1]!] === cell.strategy_profile[Object.keys(cell.strategy_profile)[1]!],
            )?.payoffs[playerId]
            if (payoff) {
              payoff.value = numeric.value + delta
            }
          })
          if (upCheck.changed) {
            thresholdValue = numeric.value + delta
            direction = 'increase'
            changed = true
            break
          }

          const downCheck = evaluateChangedResult(formalization, solverResult, canonical, (draft) => {
            const payoff = (draft.formalizations[formalization.id] as NormalFormModel).payoff_cells.find(
              (candidate) =>
                candidate.strategy_profile[Object.keys(cell.strategy_profile)[0]!] === cell.strategy_profile[Object.keys(cell.strategy_profile)[0]!] &&
                candidate.strategy_profile[Object.keys(cell.strategy_profile)[1]!] === cell.strategy_profile[Object.keys(cell.strategy_profile)[1]!],
            )?.payoffs[playerId]
            if (payoff) {
              payoff.value = numeric.value - delta
            }
          })
          if (downCheck.changed) {
            thresholdValue = numeric.value - delta
            direction = 'decrease'
            changed = true
            break
          }
        }

        const margin = changed ? Math.abs(thresholdValue - numeric.value) : Math.max(Math.abs(numeric.value) * 0.5, 1)
        const strategyProfile = Object.values(cell.strategy_profile)
        payoffSensitivities.push({
          player_id: playerId,
          strategy_profile: strategyProfile,
          current_value: numeric.value,
          threshold_value: thresholdValue,
          margin,
          direction,
          result_if_crossed: changed
            ? `Result changes when ${playerId} payoff at ${strategyProfile.join(' / ')} crosses ${thresholdValue.toFixed(2)}.`
            : 'Result remained stable across tested perturbations.',
        })
        thresholdAnalysis.push({
          parameter: `${playerId}:${strategyProfile.join('|')}`,
          current: numeric.value,
          threshold: thresholdValue,
          margin,
          consequence: changed ? 'Solver conclusion changes.' : 'Solver conclusion remained stable.',
        })
      }
    }
  }

  if (formalization.kind === 'extensive_form') {
    const nodes = getFormalizationNodes(canonical, formalization.id)
    for (const node of nodes) {
      for (const [playerId, estimate] of Object.entries(node.terminal_payoffs ?? {})) {
        const numeric = readEstimateNumeric(estimate)
        if (!numeric) {
          continue
        }

        const step = Math.max(Math.abs(numeric.value) * 0.05, 0.25)
        let thresholdValue = numeric.value
        let direction: 'increase' | 'decrease' = 'increase'
        let changed = false

        for (const multiplier of Array.from({ length: 20 }, (_, index) => index + 1)) {
          const delta = step * multiplier
          const upCheck = evaluateChangedResult(formalization, solverResult, canonical, (draft) => {
            const payoff = draft.nodes[node.id]?.terminal_payoffs?.[playerId]
            if (payoff) {
              payoff.value = numeric.value + delta
            }
          })
          if (upCheck.changed) {
            thresholdValue = numeric.value + delta
            direction = 'increase'
            changed = true
            break
          }

          const downCheck = evaluateChangedResult(formalization, solverResult, canonical, (draft) => {
            const payoff = draft.nodes[node.id]?.terminal_payoffs?.[playerId]
            if (payoff) {
              payoff.value = numeric.value - delta
            }
          })
          if (downCheck.changed) {
            thresholdValue = numeric.value - delta
            direction = 'decrease'
            changed = true
            break
          }
        }

        const margin = changed ? Math.abs(thresholdValue - numeric.value) : Math.max(Math.abs(numeric.value) * 0.5, 1)
        payoffSensitivities.push({
          player_id: playerId,
          node_id: node.id,
          strategy_profile: [node.label],
          current_value: numeric.value,
          threshold_value: thresholdValue,
          margin,
          direction,
          result_if_crossed: changed
            ? `Changing terminal payoff at ${node.label} flips the current solution path.`
            : 'Solution path remained stable across tested perturbations.',
        })
        thresholdAnalysis.push({
          parameter: `${node.id}:${playerId}`,
          current: numeric.value,
          threshold: thresholdValue,
          margin,
          consequence: changed ? 'Solution path changes.' : 'Solution path remained stable.',
        })
      }
    }
  }

  payoffSensitivities.sort((left, right) => left.margin - right.margin)
  thresholdAnalysis.sort((left, right) => left.margin - right.margin)

  const assumptionIds = getFormalizationAssumptionIds(formalization, canonical)
  const smallestMargin = payoffSensitivities[0]?.margin ?? 1
  const assumptionSensitivities: AssumptionSensitivity[] = assumptionIds.map((assumptionId) => {
    const assumption = canonical.assumptions[assumptionId]
    const impact = smallestMargin < 1 ? 'result_changes' : 'result_stable'
    return {
      assumption_id: assumptionId,
      statement: assumption?.statement ?? assumptionId,
      impact,
      description: impact === 'result_changes'
        ? 'This assumption is linked to the most sensitive tested payoff.'
        : 'Tested payoff perturbations did not show a direct flip from this assumption alone.',
      affected_payoffs: thresholdAnalysis.slice(0, 3).map((entry) => entry.parameter),
    }
  })

  const baseline = Math.max(Math.abs(payoffSensitivities[0]?.current_value ?? 1), 1)
  const ratio = smallestMargin / baseline
  const overallRobustness = ratio > 0.2 ? 'robust' : ratio >= 0.05 ? 'sensitive' : 'fragile'

  return {
    formalization_id: formalization.id,
    solver: solverResult.solver,
    solver_result_id: solverResult.id,
    computed_at: new Date().toISOString(),
    payoff_sensitivities: payoffSensitivities,
    assumption_sensitivities: assumptionSensitivities,
    threshold_analysis: thresholdAnalysis,
    overall_robustness: overallRobustness,
  }
}

export function buildSensitivitySummary(
  analysis: SensitivityAnalysis,
): SensitivitySummary {
  const mostSensitive = analysis.payoff_sensitivities[0] ?? null
  return {
    most_sensitive_payoff: mostSensitive
      ? {
          player_id: mostSensitive.player_id,
          strategy_profile: mostSensitive.strategy_profile ?? [mostSensitive.node_id ?? 'unknown'],
          sensitivity_magnitude: mostSensitive.margin,
        }
      : null,
    result_change_threshold: mostSensitive?.threshold_value ?? 0,
    assumption_sensitivity: analysis.assumption_sensitivities.map((entry) => ({
      assumption_id: entry.assumption_id,
      impact: entry.impact,
      description: entry.description,
    })),
  }
}
