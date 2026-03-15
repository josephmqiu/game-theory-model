import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { StaleBadge, EstimateValueDisplay } from '../../../design-system'
import type { GraphNode } from '../../../../store/selectors/graph-selectors'

export function TerminalNode({ data, selected }: NodeProps<GraphNode>): ReactNode {
  const hasStale = data.staleMarkers && data.staleMarkers.length > 0
  const payoffs = data.terminalPayoffs

  return (
    <div
      className={`
        bg-bg-card border border-border rounded-xl px-4 py-3 min-w-[140px]
        ${selected ? 'ring-2 ring-accent' : ''}
        ${data.highlighted ? 'ring-2 ring-yellow-400' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className="flex items-center gap-2 mb-1">
        <div className="text-sm font-medium text-text-primary flex-1">{data.label}</div>
        {hasStale && <StaleBadge />}
      </div>

      {payoffs && Object.keys(payoffs).length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {Object.entries(payoffs).map(([playerId, estimate]) => (
            <div key={playerId} className="flex items-center gap-2 text-[10px]">
              <span className="text-text-muted font-mono truncate max-w-[60px]">
                {playerId}
              </span>
              <EstimateValueDisplay estimate={estimate} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
