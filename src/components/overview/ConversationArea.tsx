import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import type { ConversationMessage } from '../../types/conversation'
import { AIMessage } from './AIMessage'
import { UserMessage } from './UserMessage'

interface ConversationAreaProps {
  messages: ReadonlyArray<ConversationMessage>
  onAcceptProposal: (proposalId: string) => void
  onRejectProposal: (proposalId: string) => void
  onModifyProposal: (proposalId: string) => void
}

export function ConversationArea({
  messages,
  onAcceptProposal,
  onRejectProposal,
  onModifyProposal,
}: ConversationAreaProps): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }
    node.scrollTop = node.scrollHeight
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-bg-card px-6 py-10 text-center text-sm text-text-muted">
        Describe a strategic situation to begin, or connect an MCP-capable AI client and let it drive the analysis via tools.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full space-y-4 overflow-y-auto rounded-xl border border-border bg-bg-surface p-4">
      {messages.map((message) => (
        message.role === 'user'
          ? <UserMessage key={message.id} message={message} />
          : (
            <AIMessage
              key={message.id}
              message={message}
              onAcceptProposal={onAcceptProposal}
              onRejectProposal={onRejectProposal}
              onModifyProposal={onModifyProposal}
            />
          )
      ))}
    </div>
  )
}
