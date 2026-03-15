import type { CanonicalStore } from '../types/canonical'
import type { NormalFormModel } from '../types/formalizations'
import type { NashEquilibrium, NashResult } from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'
import { getNormalFormShape, readEstimateNumeric } from './utils'

interface PayoffLookupEntry {
  payoffs: Record<string, number>
  usedMidpoint: boolean
}

function payoffKey(rowStrategy: string, colStrategy: string): string {
  return `${rowStrategy}__${colStrategy}`
}

function buildPayoffLookup(
  formalization: NormalFormModel,
  rowPlayerId: string,
  colPlayerId: string,
): Map<string, PayoffLookupEntry> {
  const lookup = new Map<string, PayoffLookupEntry>()
  for (const cell of formalization.payoff_cells) {
    const rowStrategy = cell.strategy_profile[rowPlayerId]
    const colStrategy = cell.strategy_profile[colPlayerId]
    if (!rowStrategy || !colStrategy) {
      continue
    }

    const payoffs: Record<string, number> = {}
    let usedMidpoint = false
    for (const [playerId, estimate] of Object.entries(cell.payoffs)) {
      const numeric = readEstimateNumeric(estimate)
      if (!numeric) {
        continue
      }

      payoffs[playerId] = numeric.value
      usedMidpoint = usedMidpoint || Boolean(numeric.usedMidpoint)
    }

    lookup.set(payoffKey(rowStrategy, colStrategy), {
      payoffs,
      usedMidpoint,
    })
  }

  return lookup
}

function payoffAt(
  lookup: Map<string, PayoffLookupEntry>,
  playerId: string,
  rowStrategy: string,
  colStrategy: string,
): number | null {
  return lookup.get(payoffKey(rowStrategy, colStrategy))?.payoffs[playerId] ?? null
}

function baseResult(formalization: NormalFormModel, store: CanonicalStore): NashResult {
  return {
    id: crypto.randomUUID(),
    formalization_id: formalization.id,
    solver: 'nash',
    computed_at: new Date().toISOString(),
    readiness_snapshot: computeReadiness(formalization, store).readiness,
    status: 'success',
    warnings: [],
    meta: {
      method_id: 'nash_support_enumeration',
      method_label: 'Nash Equilibrium (Support Enumeration, 2-Player)',
      limitations: ['M4 implementation is limited to 2-player normal-form games.'],
      assumptions_used: [],
    },
    method: 'support_enumeration',
    equilibria: [],
  }
}

export function solveNash(
  formalization: NormalFormModel,
  store: CanonicalStore,
): NashResult {
  const gate = checkSolverGate('nash', formalization, store)
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
      warnings: ['Nash solver requires exactly two players.'],
      error: 'Nash solver requires exactly two players.',
    }
  }

  const lookup = buildPayoffLookup(formalization, rowPlayerId, colPlayerId)
  const equilibria: NashEquilibrium[] = []
  let usedMidpoint = false
  const warnings = [...gate.warnings]

  for (const rowStrategy of rowStrategies) {
    for (const colStrategy of colStrategies) {
      const currentRowPayoff = payoffAt(lookup, rowPlayerId, rowStrategy, colStrategy)
      const currentColPayoff = payoffAt(lookup, colPlayerId, rowStrategy, colStrategy)
      if (currentRowPayoff === null || currentColPayoff === null) {
        continue
      }

      const rowBest = Math.max(
        ...rowStrategies
          .map((candidate) => payoffAt(lookup, rowPlayerId, candidate, colStrategy))
          .filter((value): value is number => value !== null),
      )
      const colBest = Math.max(
        ...colStrategies
          .map((candidate) => payoffAt(lookup, colPlayerId, rowStrategy, candidate))
          .filter((value): value is number => value !== null),
      )

      const rowBestCount = rowStrategies.filter(
        (candidate) => payoffAt(lookup, rowPlayerId, candidate, colStrategy) === rowBest,
      ).length
      const colBestCount = colStrategies.filter(
        (candidate) => payoffAt(lookup, colPlayerId, rowStrategy, candidate) === colBest,
      ).length

      if (currentRowPayoff === rowBest && currentColPayoff === colBest) {
        usedMidpoint = usedMidpoint || Boolean(lookup.get(payoffKey(rowStrategy, colStrategy))?.usedMidpoint)

        equilibria.push({
          id: `${rowStrategy}__${colStrategy}`,
          strategies: {
            [rowPlayerId]: {
              player_id: rowPlayerId,
              distribution: { [rowStrategy]: 1 },
            },
            [colPlayerId]: {
              player_id: colPlayerId,
              distribution: { [colStrategy]: 1 },
            },
          },
          payoffs: {
            [rowPlayerId]: currentRowPayoff,
            [colPlayerId]: currentColPayoff,
          },
          type: 'pure',
          stability: rowBestCount === 1 && colBestCount === 1 ? 'strict' : 'weak',
        })
      }
    }
  }

  if (rowStrategies.length === 2 && colStrategies.length === 2) {
    const [r1, r2] = rowStrategies
    const [c1, c2] = colStrategies
    const a = payoffAt(lookup, rowPlayerId, r1!, c1!)
    const b = payoffAt(lookup, rowPlayerId, r1!, c2!)
    const c = payoffAt(lookup, rowPlayerId, r2!, c1!)
    const d = payoffAt(lookup, rowPlayerId, r2!, c2!)
    const e = payoffAt(lookup, colPlayerId, r1!, c1!)
    const f = payoffAt(lookup, colPlayerId, r1!, c2!)
    const g = payoffAt(lookup, colPlayerId, r2!, c1!)
    const h = payoffAt(lookup, colPlayerId, r2!, c2!)
    const mixedInputs = [a, b, c, d, e, f, g, h]

    if (mixedInputs.every((value): value is number => value !== null)) {
      const [a1, b1, c1Value, d1, e1, f1, g1, h1] = mixedInputs
      const qDenominator = a1 - b1 - c1Value + d1
      const pDenominator = e1 - f1 - g1 + h1
      if (qDenominator !== 0 && pDenominator !== 0) {
        const q = (d1 - b1) / qDenominator
        const p = (h1 - g1) / pDenominator
        if (q >= 0 && q <= 1 && p >= 0 && p <= 1) {
          equilibria.push({
            id: `${rowPlayerId}__mixed__${colPlayerId}`,
            strategies: {
              [rowPlayerId]: {
                player_id: rowPlayerId,
                distribution: {
                  [r1!]: Number(p.toFixed(4)),
                  [r2!]: Number((1 - p).toFixed(4)),
                },
              },
              [colPlayerId]: {
                player_id: colPlayerId,
                distribution: {
                  [c1!]: Number(q.toFixed(4)),
                  [c2!]: Number((1 - q).toFixed(4)),
                },
              },
            },
            payoffs: {
              [rowPlayerId]: Number((q * a1 + (1 - q) * b1).toFixed(4)),
              [colPlayerId]: Number((p * e1 + (1 - p) * g1).toFixed(4)),
            },
            type: 'mixed',
            stability: 'weak',
          })
        }
      }
    }
  } else if (rowStrategies.length > 2 || colStrategies.length > 2) {
    warnings.push('Mixed-strategy search is limited to 2x2 games and was skipped for this matrix.')
  }

  return {
    ...result,
    warnings: [
      ...warnings,
      ...(usedMidpoint ? ['Equilibria computed on midpoint of interval estimates.'] : []),
    ],
    equilibria,
    status: equilibria.length > 0 ? 'success' : 'partial',
  }
}
