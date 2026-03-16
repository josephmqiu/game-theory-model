import { useState, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'

import { useAppStore } from '../../../store'
import {
  selectNormalFormViewModel,
  findCell,
} from '../../../store/selectors/normal-form-selectors'
import { EstimateEditor } from '../../editors/EstimateEditor'
import { createEmptyEstimate } from '../../editors/create-empty-estimate'
import { PayoffCell } from './PayoffCell'
import type { EstimateValue } from '../../../types/estimates'
import { EmptyStateNewGame } from '../../shell/EmptyStateNewGame'
import { Button } from '../../design-system'
import { CreateFormalizationWizard } from '../../editors/wizards'
import { ReadinessPanel } from '../../panels/ReadinessPanel'
import { SensitivityPanel } from '../../uncertainty/SensitivityPanel'
import {
  useReadinessReport,
  useRunSolver,
  useSensitivityAnalysis,
  useSolverResults,
} from '../../../store'
import type {
  DominanceResult,
  ExpectedUtilityResult,
  NashResult,
  SolverResultUnion,
} from '../../../types/solver-results'

function isNashResult(result: SolverResultUnion | undefined): result is NashResult {
  return result?.solver === 'nash'
}

function isDominanceResult(result: SolverResultUnion | undefined): result is DominanceResult {
  return result?.solver === 'dominance'
}

function isExpectedUtilityResult(result: SolverResultUnion | undefined): result is ExpectedUtilityResult {
  return result?.solver === 'expected_utility'
}

export function MatrixView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const dispatch = useAppStore((s) => s.dispatch)
  const readinessReport = useReadinessReport(activeFormalizationId)
  const solverResults = useSolverResults(activeFormalizationId)
  const runSolver = useRunSolver()
  const nashSensitivity = useSensitivityAnalysis(activeFormalizationId, 'nash')
  const dominanceSensitivity = useSensitivityAnalysis(activeFormalizationId, 'dominance')
  const expectedUtilitySensitivity = useSensitivityAnalysis(activeFormalizationId, 'expected_utility')

  const [selectedCellKey, setSelectedCellKey] = useState<{ rowStrategy: string; colStrategy: string } | null>(null)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [showCreateFormalization, setShowCreateFormalization] = useState(false)

  const viewModel = useMemo(
    () => selectNormalFormViewModel(canonical, activeFormalizationId),
    [canonical, activeFormalizationId],
  )

  const gameName = activeGameId ? (canonical.games[activeGameId]?.name ?? '') : ''
  const formName = viewModel.formalization
    ? `${viewModel.formalization.kind.replace('_', ' ')}`
    : ''
  const title = gameName && formName ? `${gameName} — ${formName}` : gameName || formName
  const rowPlayer = viewModel.players[0]
  const colPlayer = viewModel.players[1]
  const nashResult = isNashResult(solverResults.nash) ? solverResults.nash : null
  const dominanceResult = isDominanceResult(solverResults.dominance) ? solverResults.dominance : null
  const expectedUtilityResult = isExpectedUtilityResult(solverResults.expected_utility)
    ? solverResults.expected_utility
    : null
  const activeSensitivity = nashSensitivity ?? dominanceSensitivity ?? expectedUtilitySensitivity

  const equilibriumCells = new Set(
    (nashResult?.equilibria ?? [])
      .filter((equilibrium) => equilibrium.type === 'pure')
      .map((equilibrium) => {
        const rowEntry = rowPlayer ? equilibrium.strategies[rowPlayer] : undefined
        const colEntry = colPlayer ? equilibrium.strategies[colPlayer] : undefined
        const rowStrategy = rowEntry ? Object.keys(rowEntry.distribution)[0] : ''
        const colStrategy = colEntry ? Object.keys(colEntry.distribution)[0] : ''
        return `${rowStrategy}__${colStrategy}`
      }),
  )

  const dominatedRowStrategies = new Set(
    (dominanceResult?.eliminated_strategies ?? [])
      .filter((entry) => viewModel.players[0] === entry.player_id)
      .map((entry) => entry.strategy),
  )
  const dominatedColStrategies = new Set(
    (dominanceResult?.eliminated_strategies ?? [])
      .filter((entry) => viewModel.players[1] === entry.player_id)
      .map((entry) => entry.strategy),
  )

  const handleCellSelect = useCallback((rowStrategy: string, colStrategy: string) => {
    setSelectedCellKey({ rowStrategy, colStrategy })
    setEditingPlayerId(null)
    setEditingError(null)
  }, [])

  const handleEditPayoff = useCallback((playerId: string) => {
    setEditingPlayerId(playerId)
    setEditingError(null)
  }, [])

  const handleSavePayoff = useCallback(
    (updated: EstimateValue) => {
      if (!selectedCellKey || !editingPlayerId || !activeFormalizationId) return

      const liveCell = findCell(viewModel, selectedCellKey.rowStrategy, selectedCellKey.colStrategy)
      const result = dispatch({
        kind: 'update_normal_form_payoff',
        payload: {
          formalization_id: activeFormalizationId,
          cell_index: liveCell?.cellIndex ?? -1,
          player_id: editingPlayerId,
          value: updated,
          row_strategy: selectedCellKey.rowStrategy,
          col_strategy: selectedCellKey.colStrategy,
        },
      })

      if (result.status === 'committed') {
        setEditingPlayerId(null)
        setEditingError(null)
        return
      }

      if (result.status === 'rejected') {
        setEditingError(result.errors.join('; '))
      }
    },
    [selectedCellKey, editingPlayerId, activeFormalizationId, dispatch, viewModel],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingPlayerId(null)
    setEditingError(null)
  }, [])

  if (!viewModel.formalization) {
    const activeGame = activeGameId ? canonical.games[activeGameId] : null
    if (activeGame && activeGame.formalizations.length === 0) {
      return <EmptyStateNewGame />
    }

    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-lg font-heading mb-2">
            No normal-form formalization selected
          </div>
          <div className="text-sm">
            Select a game with a normal-form formalization to view its payoff matrix.
          </div>
        </div>
      </div>
    )
  }

  const rowPlayerName = rowPlayer ? (canonical.players[rowPlayer]?.name ?? rowPlayer) : ''
  const colPlayerName = colPlayer ? (canonical.players[colPlayer]?.name ?? colPlayer) : ''
  const selectedCell = selectedCellKey
    ? findCell(viewModel, selectedCellKey.rowStrategy, selectedCellKey.colStrategy)
    : undefined

  if (viewModel.players.length < 2 || viewModel.rowStrategies.length === 0 || viewModel.colStrategies.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-lg text-center">
          <h2 className="mb-2 text-lg font-heading text-text-primary">Matrix setup incomplete</h2>
          <p className="mb-4 text-sm text-text-muted">
            Normal-form views need two players and seed strategies. Create a new normal-form formalization to initialize the matrix.
          </p>
          <Button variant="primary" onClick={() => setShowCreateFormalization(true)}>
            Create Normal-Form Formalization
          </Button>
          <CreateFormalizationWizard
            open={showCreateFormalization}
            onClose={() => setShowCreateFormalization(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex-1 h-full overflow-auto"
      data-testid="matrix-view"
    >
      <div className="max-w-4xl mx-auto px-6 py-6">
        {title && (
          <h1 className="text-lg font-heading font-bold text-text-primary mb-6">
            {title}
          </h1>
        )}

        <div className="mb-4 space-y-4">
          <ReadinessPanel report={readinessReport} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => activeFormalizationId && runSolver(activeFormalizationId, 'nash')}>
              Run Nash
            </Button>
            <Button variant="secondary" onClick={() => activeFormalizationId && runSolver(activeFormalizationId, 'dominance')}>
              Run Dominance
            </Button>
            <Button variant="secondary" onClick={() => activeFormalizationId && runSolver(activeFormalizationId, 'expected_utility')}>
              Run Expected Utility
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th className="border border-border p-2 bg-bg-surface text-xs font-mono text-text-muted">
                  {rowPlayerName} \ {colPlayerName}
                </th>
                {viewModel.colStrategies.map((strategy) => (
                  <th
                    key={strategy}
                    className={`border border-border p-2 bg-bg-surface text-xs font-mono font-bold text-text-primary ${
                      dominatedColStrategies.has(strategy) ? 'opacity-50 line-through' : ''
                    }`}
                  >
                    {strategy}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewModel.rowStrategies.map((rowStrategy) => (
                <tr key={rowStrategy}>
                  <th className={`border border-border p-2 bg-bg-surface text-xs font-mono font-bold text-text-primary text-left ${
                    dominatedRowStrategies.has(rowStrategy) ? 'opacity-50 line-through' : ''
                  }`}>
                    {rowStrategy}
                  </th>
                  {viewModel.colStrategies.map((colStrategy) => {
                    const cell = findCell(viewModel, rowStrategy, colStrategy)
                    const isSelected =
                      selectedCellKey !== null &&
                      selectedCellKey.rowStrategy === rowStrategy &&
                      selectedCellKey.colStrategy === colStrategy

                    return (
                      <PayoffCell
                        key={`${rowStrategy}-${colStrategy}`}
                        rowStrategy={rowStrategy}
                        colStrategy={colStrategy}
                        cell={cell}
                        playerIds={viewModel.players}
                        isSelected={isSelected}
                        isEquilibrium={equilibriumCells.has(`${rowStrategy}__${colStrategy}`)}
                        isDominated={
                          dominatedRowStrategies.has(rowStrategy) || dominatedColStrategies.has(colStrategy)
                        }
                        onSelect={handleCellSelect}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCellKey && !editingPlayerId && (
          <div className="mt-4 bg-bg-card border border-border rounded p-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wide text-text-muted mb-3">
              Selected: {selectedCellKey.rowStrategy} / {selectedCellKey.colStrategy}
            </h3>
            <div className="flex flex-col gap-2">
              {viewModel.players.map((playerId) => {
                const playerName = canonical.players[playerId]?.name ?? playerId
                const payoff = selectedCell?.payoffs[playerId]

                return (
                  <div key={playerId} className="flex items-center gap-3">
                    <span className="text-sm text-text-primary font-medium min-w-[80px]">
                      {playerName}
                    </span>
                    {payoff ? (
                      <>
                        <span className="text-sm font-mono text-text-primary">
                          {payoff.value ?? '—'}
                        </span>
                        <span className="text-xs text-text-muted">
                          conf: {payoff.confidence}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-accent hover:underline"
                          onClick={() => handleEditPayoff(playerId)}
                        >
                          Edit
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => handleEditPayoff(playerId)}
                      >
                        Add payoff
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedCellKey && editingPlayerId && (
          <div className="mt-4">
            <div className="text-xs text-text-muted mb-2 font-mono">
              Editing payoff for{' '}
              {canonical.players[editingPlayerId]?.name ?? editingPlayerId}
            </div>
            {editingError && (
              <div className="mb-2 font-mono text-xs text-warning">{editingError}</div>
            )}
            <EstimateEditor
              existing={selectedCell?.payoffs[editingPlayerId] ?? createEmptyEstimate()}
              onSave={handleSavePayoff}
              onCancel={handleCancelEdit}
            />
          </div>
        )}

        <div className="mt-6 space-y-4">
          {nashResult && (
            <div className="rounded border border-border bg-bg-card p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Nash Result</div>
              <div className="mt-2 text-sm text-text-primary">
                {nashResult.equilibria.length} equilibrium{nashResult.equilibria.length === 1 ? '' : 's'}
              </div>
              {nashResult.warnings.length > 0 && (
                <div className="mt-2 text-xs text-text-muted">{nashResult.warnings.join(' ')}</div>
              )}
            </div>
          )}
          {dominanceResult && (
            <div className="rounded border border-border bg-bg-card p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Dominance Result</div>
              <div className="mt-2 text-sm text-text-primary">
                Eliminated {dominanceResult.eliminated_strategies.length} {dominanceResult.eliminated_strategies.length === 1 ? 'strategy' : 'strategies'}
              </div>
            </div>
          )}
          {expectedUtilityResult && (
            <div className="rounded border border-border bg-bg-card p-4">
              <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Expected Utility</div>
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                {Object.values(expectedUtilityResult.player_utilities).map((utility) => (
                  <div key={utility.player_id}>
                    {utility.player_id}: best response {utility.best_response}
                  </div>
                ))}
              </div>
            </div>
          )}
          <SensitivityPanel analysis={activeSensitivity} />
        </div>
      </div>
    </div>
  )
}
