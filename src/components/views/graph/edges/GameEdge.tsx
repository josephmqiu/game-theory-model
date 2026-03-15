import type { ReactNode } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

import type { GraphEdge } from '../../../../store/selectors/graph-selectors'

export function GameEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps<GraphEdge>): ReactNode {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={selected ? 'stroke-accent' : 'stroke-border'}
        style={{ strokeWidth: 2 }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="bg-bg-surface border border-border rounded px-2 py-0.5 text-[10px] font-mono text-text-primary pointer-events-all nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
