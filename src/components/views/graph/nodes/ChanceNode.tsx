import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

import { StaleBadge } from '../../../design-system'
import type { GraphNode } from '../../../../store/selectors/graph-selectors'

export function ChanceNode({ data, selected }: NodeProps<GraphNode>): ReactNode {
  const hasStale = data.staleMarkers && data.staleMarkers.length > 0

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <Handle type="target" position={Position.Top} className="!bg-border" />

      {/* Diamond shape via rotated square */}
      <div
        className={`
          absolute bg-bg-card border border-border
          ${selected ? 'ring-2 ring-accent' : ''}
        `}
        style={{
          width: 70,
          height: 70,
          transform: 'rotate(45deg)',
        }}
      />

      {/* Counter-rotated content */}
      <div className="relative z-10 flex flex-col items-center gap-1">
        <div className="text-sm font-medium text-text-primary text-center">{data.label}</div>
        {hasStale && <StaleBadge />}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  )
}
