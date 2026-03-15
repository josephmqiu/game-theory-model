import type { ReactNode } from 'react'

import { Badge } from '../../design-system'
import type { CanonicalStore } from '../../../types/canonical'

const RESOLUTION_COLORS: Record<string, string> = {
  open: '#EF4444',
  partially_resolved: '#F59E0B',
  resolved: '#22C55E',
  deferred: '#6B7280',
}

interface ContradictionCardProps {
  contradictionId: string
  canonical: CanonicalStore
  onClick: (contradictionId: string) => void
}

export function ContradictionCard({
  contradictionId,
  canonical,
  onClick,
}: ContradictionCardProps): ReactNode {
  const contradiction = canonical.contradictions[contradictionId]

  if (!contradiction) {
    return null
  }

  const leftClaim = canonical.claims[contradiction.left_ref]
  const rightClaim = canonical.claims[contradiction.right_ref]
  const statusColor = RESOLUTION_COLORS[contradiction.resolution_status] ?? '#6B7280'

  return (
    <button
      className="w-full text-left bg-bg-card border border-border rounded px-4 py-3 hover:border-accent transition-colors cursor-pointer"
      onClick={() => onClick(contradictionId)}
      data-testid={`contradiction-card-${contradictionId}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Badge color="#EF4444">CONTRADICTION</Badge>
        <Badge color={statusColor}>{contradiction.resolution_status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded p-2">
          <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Left</div>
          <div className="text-xs text-text-primary leading-relaxed">
            {leftClaim?.statement ?? contradiction.left_ref}
          </div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Right</div>
          <div className="text-xs text-text-primary leading-relaxed">
            {rightClaim?.statement ?? contradiction.right_ref}
          </div>
        </div>
      </div>

      {contradiction.description && (
        <div className="mt-2 text-xs text-text-muted">
          {contradiction.description}
        </div>
      )}
    </button>
  )
}
