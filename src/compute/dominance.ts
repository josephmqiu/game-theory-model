import type { CanonicalStore } from '../types/canonical'
import type { NormalFormModel } from '../types/formalizations'
import type {
  DominanceResult,
  DominatedStrategy,
  DominanceRound,
} from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'
import { getNormalFormShape, readEstimateNumeric } from './utils'

function baseResult(formalization: NormalFormModel, store: CanonicalStore): DominanceResult {
  return {
    id: crypto.randomUUID(),
    formalization_id: formalization.id,
    solver: 'dominance',
    computed_at: new Date().toISOString(),
    readiness_snapshot: computeReadiness(formalization, store).readiness,
    status: 'success',
    warnings: [],
    meta: {
      method_id: 'dominance_iterated_strict',
      method_label: 'Iterated Strict Dominance',
      limitations: ['M4 implementation performs strict dominance elimination only.'],
      assumptions_used: [],
    },
    eliminated_strategies: [],
    reduced_game: {
      strategies: {},
      remaining_cells: [],
    },
    rounds: [],
  }
}

function payoffForPlayer(
  formalization: NormalFormModel,
  playerId: string,
  rowPlayerId: string,
  colPlayerId: string,
  rowStrategy: string,
  colStrategy: string,
): number | null {
  const cell = formalization.payoff_cells.find(
    (entry) =>
      entry.strategy_profile[rowPlayerId] === rowStrategy &&
      entry.strategy_profile[colPlayerId] === colStrategy,
  )
  const estimate = cell?.payoffs[playerId]
  const numeric = estimate ? readEstimateNumeric(estimate) : null
  return numeric?.value ?? null
}

export function eliminateDominance(
  formalization: NormalFormModel,
  store: CanonicalStore,
): DominanceResult {
  const gate = checkSolverGate('dominance', formalization, store)
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
      warnings: ['Dominance solver requires exactly two players.'],
      error: 'Dominance solver requires exactly two players.',
    }
  }

  const remainingRowStrategies = [...rowStrategies]
  const remainingColStrategies = [...colStrategies]
  const eliminated: DominatedStrategy[] = []
  const rounds: DominanceRound[] = []
  let round = 1

  while (true) {
    const roundEliminations: DominatedStrategy[] = []

    for (const candidate of [...remainingRowStrategies]) {
      for (const challenger of remainingRowStrategies) {
        if (candidate === challenger) {
          continue
        }

        const strictlyLowerAgainstAll = remainingColStrategies.every((colStrategy) => {
          const candidatePayoff = payoffForPlayer(formalization, rowPlayerId, rowPlayerId, colPlayerId, candidate, colStrategy)
          const challengerPayoff = payoffForPlayer(formalization, rowPlayerId, rowPlayerId, colPlayerId, challenger, colStrategy)
          return candidatePayoff !== null && challengerPayoff !== null && candidatePayoff < challengerPayoff
        })

        if (strictlyLowerAgainstAll) {
          roundEliminations.push({
            player_id: rowPlayerId,
            strategy: candidate,
            dominated_by: challenger,
            dominance_type: 'strict',
            round,
          })
          break
        }
      }
    }

    for (const candidate of [...remainingColStrategies]) {
      for (const challenger of remainingColStrategies) {
        if (candidate === challenger) {
          continue
        }

        const strictlyLowerAgainstAll = remainingRowStrategies.every((rowStrategy) => {
          const candidatePayoff = payoffForPlayer(formalization, colPlayerId, rowPlayerId, colPlayerId, rowStrategy, candidate)
          const challengerPayoff = payoffForPlayer(formalization, colPlayerId, rowPlayerId, colPlayerId, rowStrategy, challenger)
          return candidatePayoff !== null && challengerPayoff !== null && candidatePayoff < challengerPayoff
        })

        if (strictlyLowerAgainstAll) {
          roundEliminations.push({
            player_id: colPlayerId,
            strategy: candidate,
            dominated_by: challenger,
            dominance_type: 'strict',
            round,
          })
          break
        }
      }
    }

    if (roundEliminations.length === 0) {
      break
    }

    for (const elimination of roundEliminations) {
      if (elimination.player_id === rowPlayerId) {
        const index = remainingRowStrategies.indexOf(elimination.strategy)
        if (index >= 0) {
          remainingRowStrategies.splice(index, 1)
        }
      } else {
        const index = remainingColStrategies.indexOf(elimination.strategy)
        if (index >= 0) {
          remainingColStrategies.splice(index, 1)
        }
      }
    }

    eliminated.push(...roundEliminations)
    rounds.push({ round, eliminated: roundEliminations })
    round += 1
  }

  const remainingCells = formalization.payoff_cells.filter((cell) => {
    const rowStrategy = cell.strategy_profile[rowPlayerId]
    const colStrategy = cell.strategy_profile[colPlayerId]
    return remainingRowStrategies.includes(rowStrategy) && remainingColStrategies.includes(colStrategy)
  })

  return {
    ...result,
    warnings: gate.warnings,
    status: 'success',
    eliminated_strategies: eliminated,
    reduced_game: {
      strategies: {
        [rowPlayerId]: remainingRowStrategies,
        [colPlayerId]: remainingColStrategies,
      },
      remaining_cells: remainingCells,
    },
    rounds,
  }
}
