import type { ReactNode } from 'react'

import { Badge, ConfidenceBadge, StaleBadge } from '../../design-system'
import type { EvidenceNotebookEntry } from '../../../store/selectors/evidence-notebook-selectors'

const TYPE_COLORS: Record<string, string> = {
  source: '#3B82F6',
  observation: '#06B6D4',
  claim: '#F59E0B',
  inference: '#8B5CF6',
  assumption: '#EC4899',
  contradiction: '#EF4444',
}

interface EvidenceCardProps {
  entry: EvidenceNotebookEntry
  onClick: (entry: EvidenceNotebookEntry) => void
}

export function EvidenceCard({ entry, onClick }: EvidenceCardProps): ReactNode {
  const color = TYPE_COLORS[entry.type] ?? '#6B7280'

  return (
    <button
      className="w-full text-left bg-bg-card border border-border rounded px-4 py-3 hover:border-accent transition-colors cursor-pointer"
      onClick={() => onClick(entry)}
      data-testid={`evidence-card-${entry.id}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={color}>{entry.type}</Badge>
        {entry.confidence !== undefined && (
          <ConfidenceBadge value={entry.confidence} />
        )}
        {entry.isStale && <StaleBadge />}
      </div>
      <div className="mt-2 text-sm text-text-primary leading-relaxed line-clamp-2">
        {entry.title}
      </div>
    </button>
  )
}
