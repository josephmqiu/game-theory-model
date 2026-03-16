import type { ReactNode } from 'react'

export function TimelineScreen(): ReactNode {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-lg font-bold text-text-primary mb-4">Timeline</h1>
      <p className="text-sm text-text-muted">Chronological events across all phases — populated during analysis</p>
    </div>
  )
}
