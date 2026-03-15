import { useState, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'

import { useAppStore } from '../../../store'
import {
  useNormalFormViewModel,
  findCell,
  type NormalFormCell,
} from '../../../store/selectors/normal-form-selectors'
import { EstimateEditor } from '../../editors/EstimateEditor'
import { PayoffCell } from './PayoffCell'
import type { EstimateValue } from '../../../types/estimates'

export function MatrixView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const dispatch = useAppStore((s) => s.dispatch)

  const [selectedCell, setSelectedCell] = useState<NormalFormCell | null>(null)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)

  const viewModel = useMemo(
    () => useNormalFormViewModel(canonical, activeFormalizationId),
    [canonical, activeFormalizationId],
  )

  const gameName = activeGameId ? (canonical.games[activeGameId]?.name ?? '') : ''
  const formName = viewModel.formalization
    ? `${viewModel.formalization.kind.replace('_', ' ')}`
    : ''
  const title = gameName && formName ? `${gameName} — ${formName}` : gameName || formName

  const handleCellSelect = useCallback((cell: NormalFormCell) => {
    setSelectedCell(cell)
    setEditingPlayerId(null)
  }, [])

  const handleEditPayoff = useCallback((playerId: string) => {
    setEditingPlayerId(playerId)
  }, [])

  const handleSavePayoff = useCallback(
    (updated: EstimateValue) => {
      if (!selectedCell || !editingPlayerId || !activeFormalizationId) return

      dispatch({
        kind: 'update_normal_form_payoff',
        payload: {
          formalization_id: activeFormalizationId,
          cell_index: selectedCell.cellIndex,
          player_id: editingPlayerId,
          value: updated,
        },
      })

      setEditingPlayerId(null)
    },
    [selectedCell, editingPlayerId, activeFormalizationId, dispatch],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingPlayerId(null)
  }, [])

  if (!viewModel.formalization) {
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

  const rowPlayer = viewModel.players[0]
  const colPlayer = viewModel.players[1]
  const rowPlayerName = rowPlayer ? (canonical.players[rowPlayer]?.name ?? rowPlayer) : ''
  const colPlayerName = colPlayer ? (canonical.players[colPlayer]?.name ?? colPlayer) : ''

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
                    className="border border-border p-2 bg-bg-surface text-xs font-mono font-bold text-text-primary"
                  >
                    {strategy}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewModel.rowStrategies.map((rowStrategy) => (
                <tr key={rowStrategy}>
                  <th className="border border-border p-2 bg-bg-surface text-xs font-mono font-bold text-text-primary text-left">
                    {rowStrategy}
                  </th>
                  {viewModel.colStrategies.map((colStrategy) => {
                    const cell = findCell(viewModel, rowStrategy, colStrategy)
                    const isSelected =
                      selectedCell !== null &&
                      selectedCell.rowStrategy === rowStrategy &&
                      selectedCell.colStrategy === colStrategy

                    return (
                      <PayoffCell
                        key={`${rowStrategy}-${colStrategy}`}
                        cell={cell}
                        playerIds={viewModel.players}
                        isSelected={isSelected}
                        onSelect={handleCellSelect}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCell && !editingPlayerId && (
          <div className="mt-4 bg-bg-card border border-border rounded p-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wide text-text-muted mb-3">
              Selected: {selectedCell.rowStrategy} / {selectedCell.colStrategy}
            </h3>
            <div className="flex flex-col gap-2">
              {viewModel.players.map((playerId) => {
                const playerName = canonical.players[playerId]?.name ?? playerId
                const payoff = selectedCell.payoffs[playerId]

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
                          className="text-xs text-accent hover:underline"
                          onClick={() => handleEditPayoff(playerId)}
                        >
                          Edit
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-text-muted">No payoff</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedCell && editingPlayerId && (
          <div className="mt-4">
            <div className="text-xs text-text-muted mb-2 font-mono">
              Editing payoff for{' '}
              {canonical.players[editingPlayerId]?.name ?? editingPlayerId}
            </div>
            <EstimateEditor
              existing={selectedCell.payoffs[editingPlayerId]!}
              onSave={handleSavePayoff}
              onCancel={handleCancelEdit}
            />
          </div>
        )}
      </div>
    </div>
  )
}
