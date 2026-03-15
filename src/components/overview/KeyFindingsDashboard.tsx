import type { ReactNode } from 'react'

import type { ViewType } from '../../store'
import { useAppStore } from '../../store'

interface KeyFindingsDashboardProps {
  findings: ReadonlyArray<{
    label: string
    count: number
    route: ViewType
  }>
}

export function KeyFindingsDashboard({ findings }: KeyFindingsDashboardProps): ReactNode {
  const setActiveView = useAppStore((state) => state.setActiveView)

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-card p-4 text-sm text-text-muted">
        Key findings will accumulate here as accepted evidence, players, and model structures enter the canonical store.
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {findings.map((finding) => (
        <button
          key={finding.label}
          type="button"
          className="rounded-xl border border-border bg-bg-card p-4 text-left hover:border-accent"
          onClick={() => setActiveView(finding.route)}
        >
          <div className="text-xs uppercase tracking-[0.2em] text-text-dim">{finding.label}</div>
          <div className="mt-3 text-2xl font-semibold text-text-primary">{finding.count}</div>
        </button>
      ))}
    </div>
  )
}
