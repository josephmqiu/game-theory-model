import type { ReactNode } from 'react'

import type { ProposalGroup } from '../../types/conversation'
import { InlineProposalCard } from './InlineProposalCard'

interface InlineProposalGroupProps {
  group: ProposalGroup
  onAccept: (proposalId: string) => void
  onReject: (proposalId: string) => void
  onModify: (proposalId: string) => void
}

export function InlineProposalGroup({
  group,
  onAccept,
  onReject,
  onModify,
}: InlineProposalGroupProps): ReactNode {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.2em] text-text-dim">
        Phase {group.phase} proposals · {group.status.replace('_', ' ')}
      </div>
      {group.proposals.map((proposal) => (
        <InlineProposalCard
          key={proposal.id}
          proposal={proposal}
          onAccept={() => onAccept(proposal.id)}
          onReject={() => onReject(proposal.id)}
          onModify={() => onModify(proposal.id)}
        />
      ))}
    </div>
  )
}
