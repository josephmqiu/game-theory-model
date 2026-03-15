import type { CanonicalStore } from '../types/canonical'
import type { NormalFormModel } from '../types/formalizations'
import type {
  ExpectedUtilityResult,
  PlayerUtility,
  UtilityEstimate,
} from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'
import { getNormalFormShape, readEstimateNumeric } from './utils'

function baseResult(formalization: NormalFormModel, store: CanonicalStore): ExpectedUtilityResult {
  return {
    id: crypto.randomUUID(),
    formalization_id: formalization.id,
    solver: 'expected_utility',
    computed_at: new Date().toISOString(),
    readiness_snapshot: computeReadiness(formalization, store).readiness,
    status: 'success',
    warnings: [],
    meta: {
      method_id: 'expected_utility_uniform_opponents',
      method_label: 'Expected Utility (Uniform Opponent Distribution)',
      limitations: ['Uses uniform opponent play when no explicit belief distribution exists.'],
      assumptions_used: ['Uniform distribution over opponent strategies when unspecified.'],
    },
    player_utilities: {},
  }
}

export function computeExpectedUtility(
  formalization: NormalFormModel,
  store: CanonicalStore,
): ExpectedUtilityResult {
  const gate = checkSolverGate('expected_utility', formalization, store)
  const result = baseResult(formalization, store)

  if (!gate.eligible) {
    return {
      ...result,
      status: 'failed',
      warnings: [...gate.blockers, ...gate.warnings],
      error: gate.blockers[0] ?? 'Solver readiness gate failed.',
    }
  }

  const { players, rowPlayerId, colPlayerId, rowStrategies, colStrategies } = getNormalFormShape(formalization)
  if (!rowPlayerId || !colPlayerId || players.length !== 2) {
    return {
      ...result,
      status: 'failed',
      warnings: ['Expected utility requires exactly two players.'],
      error: 'Expected utility requires exactly two players.',
    }
  }

  const playerUtilities: Record<string, PlayerUtility> = {}
  const warnings = [...gate.warnings, 'Using uniform distribution over opponent strategies.']

  const buildUtility = (
    playerId: string,
    ownStrategies: string[],
    opponentStrategies: string[],
    resolver: (own: string, opponent: string) => import('../types/estimates').EstimateValue | undefined,
  ) => {
    const perStrategy: Record<string, UtilityEstimate> = {}

    for (const ownStrategy of ownStrategies) {
      const values = opponentStrategies.map((opponentStrategy) => resolver(ownStrategy, opponentStrategy)).filter(Boolean)
      const numerics = values.map((estimate) => readEstimateNumeric(estimate!)).filter(Boolean)
      const expectedValue =
        numerics.reduce((sum, numeric) => sum + numeric!.value, 0) / Math.max(numerics.length, 1)
      const minValue = numerics.every((numeric) => typeof numeric!.min === 'number')
        ? numerics.reduce((sum, numeric) => sum + (numeric!.min ?? numeric!.value), 0) / Math.max(numerics.length, 1)
        : undefined
      const maxValue = numerics.every((numeric) => typeof numeric!.max === 'number')
        ? numerics.reduce((sum, numeric) => sum + (numeric!.max ?? numeric!.value), 0) / Math.max(numerics.length, 1)
        : undefined
      const confidence = numerics.length > 0 ? Math.min(...numerics.map((numeric) => numeric!.confidence)) : 1
      const assumptionsUsed = [
        ...new Set(values.flatMap((estimate) => estimate?.assumptions ?? [])),
      ]

      perStrategy[ownStrategy] = {
        expected_value: Number(expectedValue.toFixed(4)),
        min_value: typeof minValue === 'number' ? Number(minValue.toFixed(4)) : undefined,
        max_value: typeof maxValue === 'number' ? Number(maxValue.toFixed(4)) : undefined,
        confidence,
        assumptions_used: assumptionsUsed,
      }
    }

    const bestResponse = Object.entries(perStrategy).sort((a, b) => b[1].expected_value - a[1].expected_value)[0]?.[0] ?? ownStrategies[0] ?? ''
    playerUtilities[playerId] = {
      player_id: playerId,
      per_strategy: perStrategy,
      best_response: bestResponse,
    }
  }

  buildUtility(rowPlayerId, rowStrategies, colStrategies, (rowStrategy, colStrategy) =>
    formalization.payoff_cells.find(
      (cell) =>
        cell.strategy_profile[rowPlayerId] === rowStrategy &&
        cell.strategy_profile[colPlayerId] === colStrategy,
    )?.payoffs[rowPlayerId],
  )

  buildUtility(colPlayerId, colStrategies, rowStrategies, (colStrategy, rowStrategy) =>
    formalization.payoff_cells.find(
      (cell) =>
        cell.strategy_profile[rowPlayerId] === rowStrategy &&
        cell.strategy_profile[colPlayerId] === colStrategy,
    )?.payoffs[colPlayerId],
  )

  return {
    ...result,
    warnings,
    player_utilities: playerUtilities,
  }
}
