import type { ReactNode } from 'react'

export function OverviewScreen(): ReactNode {
  return (
    <div className="flex-1 flex flex-col h-full p-6">
      <h1 className="text-lg font-bold text-text-primary mb-4">Overview</h1>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-muted">Command center — conversation UI coming in M5</p>
      </div>
    </div>
  )
}
