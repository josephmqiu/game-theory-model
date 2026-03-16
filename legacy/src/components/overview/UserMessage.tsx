import type { ReactNode } from 'react'

import type { ConversationMessage } from '../../types/conversation'

export function UserMessage({ message }: { message: ConversationMessage }): ReactNode {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-accent px-4 py-3 text-sm text-black shadow-sm">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}
