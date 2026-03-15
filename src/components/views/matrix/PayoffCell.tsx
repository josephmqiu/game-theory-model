import type { ReactNode } from 'react'

import { EstimateValueDisplay } from '../../design-system'
import type { NormalFormCell } from '../../../store/selectors/normal-form-selectors'

interface PayoffCellProps {
  cell: NormalFormCell | undefined
  playerIds: readonly string[]
  isSelected: boolean
  onSelect: (cell: NormalFormCell) => void
}

export function PayoffCell({
  cell,
  playerIds,
  isSelected,
  onSelect,
}: PayoffCellProps): ReactNode {
  if (!cell) {
    return (
      <td className="border border-border p-2 text-center text-text-muted text-xs">
        —
      </td>
    )
  }

  return (
    <td
      className={`border border-border p-2 cursor-pointer transition-colors hover:bg-bg-surface ${
        isSelected ? 'ring-2 ring-amber-500 ring-inset' : ''
      }`}
      onClick={() => onSelect(cell)}
      data-testid={`payoff-cell-${cell.rowStrategy}-${cell.colStrategy}`}
    >
      <div className="flex flex-col gap-1">
        {playerIds.map((playerId) => {
          const payoff = cell.payoffs[playerId]
          if (!payoff) {
            return (
              <div key={playerId} className="text-xs text-text-muted font-mono">
                {playerId}: —
              </div>
            )
          }

          return (
            <div key={playerId} className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted font-mono truncate max-w-[40px]">
                {playerId}:
              </span>
              <EstimateValueDisplay estimate={payoff} />
            </div>
          )
        })}
      </div>
    </td>
  )
}
