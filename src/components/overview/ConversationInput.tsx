import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '../design-system'

interface ConversationInputProps {
  disabled?: boolean
  placeholder?: string
  guidance?: string | null
  onSend: (content: string) => void
}

export function ConversationInput({
  disabled = false,
  placeholder = 'Steer the analysis or describe a new development...',
  guidance,
  onSend,
}: ConversationInputProps): ReactNode {
  const [value, setValue] = useState('')

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) {
      return
    }
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      {guidance ? (
        <div className="mb-3 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {guidance}
        </div>
      ) : null}
      <div className="flex gap-3">
        <textarea
          className="min-h-[88px] flex-1 resize-none rounded-lg border border-border bg-bg-surface px-3 py-3 text-sm text-text-primary outline-none placeholder:text-text-dim focus:border-accent"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <div className="flex items-end">
          <Button variant="primary" onClick={submit} disabled={disabled || value.trim().length === 0}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
