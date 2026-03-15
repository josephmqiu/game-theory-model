import type { ReactNode } from 'react'

import { useAppStore } from '../../store'
import type { ConversationMessage } from '../../types/conversation'
import { InlineProposalGroup } from './InlineProposalGroup'

interface AIMessageProps {
  message: ConversationMessage
  onAcceptProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onModifyProposal: (proposalId: string) => void
}

export function AIMessage({
  message,
  onAcceptProposal,
  onRejectProposal,
  onModifyProposal,
}: AIMessageProps): ReactNode {
  const setInspectedRefs = useAppStore((state) => state.setInspectedRefs)

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl border border-border bg-bg-card px-4 py-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-text-dim">
          <span>AI</span>
          {message.phase ? <span>Phase {message.phase}</span> : null}
          {message.message_type ? <span>{message.message_type.replace('_', ' ')}</span> : null}
        </div>

        <div className="whitespace-pre-wrap text-sm text-text-primary">{message.content}</div>

        {message.structured_content?.entity_refs?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.structured_content.entity_refs.map((ref) => (
              <button
                key={`${ref.type}:${ref.id}`}
                type="button"
                className="rounded border border-border px-2 py-1 text-[11px] text-text-muted hover:border-accent hover:text-text-primary"
                onClick={() => setInspectedRefs([ref])}
              >
                {ref.type.replace(/_/g, ' ')} · {ref.id}
              </button>
            ))}
          </div>
        ) : null}

        {message.structured_content?.proposals?.length ? (
          <div className="mt-4 space-y-4">
            {message.structured_content.proposals.map((group) => (
              <InlineProposalGroup
                key={group.id}
                group={group}
                onAccept={onAcceptProposal}
                onReject={onRejectProposal}
                onModify={onModifyProposal}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
