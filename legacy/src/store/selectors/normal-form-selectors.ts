import type { CanonicalStore } from '../../types/canonical'
import type { NormalFormModel } from '../../types/formalizations'
import type { EstimateValue } from '../../types/estimates'

export interface NormalFormCell {
  rowStrategy: string
  colStrategy: string
  payoffs: Record<string, EstimateValue>
  cellIndex: number
}

export interface NormalFormViewModel {
  players: readonly string[]
  rowStrategies: readonly string[]
  colStrategies: readonly string[]
  cells: readonly NormalFormCell[]
  formalization: NormalFormModel | null
}

const EMPTY_VIEW_MODEL: NormalFormViewModel = {
  players: [],
  rowStrategies: [],
  colStrategies: [],
  cells: [],
  formalization: null,
}

export function selectNormalFormViewModel(
  canonical: CanonicalStore,
  formalizationId: string | null,
): NormalFormViewModel {
  if (!formalizationId) {
    return EMPTY_VIEW_MODEL
  }

  const formalization = canonical.formalizations[formalizationId]
  if (!formalization || formalization.kind !== 'normal_form') {
    return EMPTY_VIEW_MODEL
  }

  const nf = formalization as NormalFormModel
  const playerIds = Object.keys(nf.strategies)

  if (playerIds.length < 2) {
    return {
      players: playerIds,
      rowStrategies: playerIds.length > 0 ? (nf.strategies[playerIds[0]!] ?? []) : [],
      colStrategies: [],
      cells: [],
      formalization: nf,
    }
  }

  const rowPlayerId = playerIds[0]!
  const colPlayerId = playerIds[1]!
  const rowStrategies = nf.strategies[rowPlayerId] ?? []
  const colStrategies = nf.strategies[colPlayerId] ?? []

  const cells: NormalFormCell[] = []

  for (const payoffCell of nf.payoff_cells) {
    const rowStrategy = payoffCell.strategy_profile[rowPlayerId]
    const colStrategy = payoffCell.strategy_profile[colPlayerId]

    if (rowStrategy === undefined || colStrategy === undefined) {
      continue
    }

    cells.push({
      rowStrategy,
      colStrategy,
      payoffs: payoffCell.payoffs,
      cellIndex: nf.payoff_cells.indexOf(payoffCell),
    })
  }

  return {
    players: playerIds,
    rowStrategies,
    colStrategies,
    cells,
    formalization: nf,
  }
}

export function findCell(
  viewModel: NormalFormViewModel,
  rowStrategy: string,
  colStrategy: string,
): NormalFormCell | undefined {
  return viewModel.cells.find(
    (cell) => cell.rowStrategy === rowStrategy && cell.colStrategy === colStrategy,
  )
}
