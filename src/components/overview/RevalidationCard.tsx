import type { ReactNode } from 'react'

import { Button } from '../design-system'
import { useAppStore } from '../../store'
import type { RevalidationActionCard } from '../../types/conversation'

interface RevalidationCardProps {
  event: RevalidationActionCard
  onApprove: () => void
  onDismiss: () => void
}

function statusTone(status: RevalidationActionCard['resolution']): string {
  switch (status) {
    case 'approved':
      return 'text-sky-300 border-sky-500/30 bg-sky-500/10'
    case 'rerun_complete':
      return 'text-green-400 border-green-500/40 bg-green-500/10'
    case 'dismissed':
      return 'text-amber-300 border-amber-500/30 bg-amber-500/10'
    default:
      return 'text-text-muted border-border bg-bg-page'
  }
}

export function RevalidationCard({
  event,
  onApprove,
  onDismiss,
}: RevalidationCardProps): ReactNode {
  const setInspectedRefs = useAppStore((state) => state.setInspectedRefs)

  return (
    <div className={`rounded-lg border p-4 ${statusTone(event.resolution)}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {event.trigger_condition.replace(/_/g, ' ')}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide">
            Phase {event.source_phase} {'->'} P{event.target_phases.join(', P')} · pass {event.pass_number}
          </div>
        </div>
      </div>

      <p className="text-sm text-text-primary">{event.description}</p>

      {event.entity_refs.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {event.entity_refs.map((ref) => (
            <button
              key={`${event.event_id}:${ref.type}:${ref.id}`}
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] text-text-muted hover:border-accent hover:text-text-primary"
              onClick={() => setInspectedRefs([ref])}
            >
              {ref.type.replace(/_/g, ' ')} · {ref.id}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={onApprove}
          disabled={event.resolution !== 'pending'}
        >
          Approve rerun
        </Button>
        <Button
          variant="secondary"
          onClick={onDismiss}
          disabled={event.resolution !== 'pending'}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
