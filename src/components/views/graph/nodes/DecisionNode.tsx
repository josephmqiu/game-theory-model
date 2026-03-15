import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { StaleBadge } from '../../../design-system'
import type { GraphNode } from '../../../../store/selectors/graph-selectors'

export function DecisionNode({ data, selected }: NodeProps<GraphNode>): ReactNode {
  const hasStale = data.staleMarkers && data.staleMarkers.length > 0
  const borderColor = data.playerColor ?? '#6B7280'

  return (
    <div
      className={`
        bg-bg-card border rounded px-4 py-3 min-w-[140px]
        ${selected ? 'ring-2 ring-accent' : ''}
      `}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          {data.playerName && (
            <div
              className="text-[10px] font-mono font-bold uppercase tracking-wide mb-1"
              style={{ color: borderColor }}
            >
              {data.playerName}
            </div>
          )}
          <div className="text-sm font-medium text-text-primary">{data.label}</div>
        </div>
        {hasStale && <StaleBadge />}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  )
}
