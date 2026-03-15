import type { CanonicalStore } from '../../types/canonical'
import type { StrategicGame } from '../../types/canonical'
import type { Formalization } from '../../types/formalizations'

export type WorkflowColumn = 'draft' | 'modeling' | 'formalized' | 'review'

export interface WorkflowGameCard {
  game: StrategicGame
  column: WorkflowColumn
}

export interface WorkflowColumns {
  draft: StrategicGame[]
  modeling: StrategicGame[]
  formalized: StrategicGame[]
  review: StrategicGame[]
}

function isFormalizationComplete(formalization: Formalization): boolean {
  if (formalization.kind !== 'normal_form') {
    return true
  }
  const strategies = formalization.strategies
  const playerIds = Object.keys(strategies)
  if (playerIds.length === 0) return false

  const expectedCellCount = playerIds.reduce((acc, pid) => acc * (strategies[pid]?.length ?? 0), 1)
  return formalization.payoff_cells.length >= expectedCellCount
}

function categorizeGame(game: StrategicGame, formalizations: CanonicalStore['formalizations']): WorkflowColumn {
  if (game.status === 'resolved' || game.status === 'paused') {
    return 'review'
  }

  if (game.formalizations.length === 0) {
    return 'draft'
  }

  const gameFormalizations = game.formalizations
    .map((id) => formalizations[id])
    .filter((f): f is Formalization => f !== undefined)

  if (gameFormalizations.length === 0) {
    return 'draft'
  }

  const hasComplete = gameFormalizations.some(isFormalizationComplete)
  if (hasComplete) {
    return 'formalized'
  }

  return 'modeling'
}

export function useWorkflowColumns(canonical: CanonicalStore): WorkflowColumns {
  const columns: WorkflowColumns = {
    draft: [],
    modeling: [],
    formalized: [],
    review: [],
  }

  for (const game of Object.values(canonical.games)) {
    const column = categorizeGame(game, canonical.formalizations)
    columns[column].push(game)
  }

  return columns
}
