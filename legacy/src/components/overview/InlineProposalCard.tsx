import type { ReactNode } from 'react'

import { Button } from '../design-system'
import type { Proposal } from '../../types/conversation'

interface InlineProposalCardProps {
  proposal: Proposal
  onAccept: () => void
  onReject: () => void
  onModify: () => void
}

function statusTone(status: Proposal['status']): string {
  switch (status) {
    case 'accepted':
      return 'text-green-400 border-green-500/40 bg-green-500/10'
    case 'rejected':
      return 'text-red-300 border-red-500/30 bg-red-500/10'
    case 'modified':
      return 'text-amber-300 border-amber-500/30 bg-amber-500/10'
    default:
      return 'text-text-muted border-border bg-bg-page'
  }
}

export function InlineProposalCard({
  proposal,
  onAccept,
  onReject,
  onModify,
}: InlineProposalCardProps): ReactNode {
  return (
    <div className={`rounded-lg border p-4 ${statusTone(proposal.status)}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">{proposal.description}</div>
          <div className="mt-1 text-xs uppercase tracking-wide">{proposal.status.replace('_', ' ')}</div>
        </div>
      </div>

      <div className="space-y-2">
        {proposal.entity_previews.map((preview) => (
          <div key={`${proposal.id}:${preview.entity_type}:${preview.entity_id ?? preview.action}`} className="rounded border border-white/5 bg-black/10 p-3 text-xs text-text-muted">
            <div className="font-semibold uppercase tracking-wide text-text-primary">
              {preview.action} {preview.entity_type.replace(/_/g, ' ')}
            </div>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-text-dim">
              {JSON.stringify(preview.preview, null, 2)}
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onAccept} disabled={proposal.status === 'accepted'}>
          Accept
        </Button>
        <Button variant="secondary" onClick={onReject} disabled={proposal.status === 'rejected'}>
          Reject
        </Button>
        <Button variant="secondary" onClick={onModify}>
          Modify
        </Button>
      </div>
    </div>
  )
}
