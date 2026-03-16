import type { ReactNode } from 'react'

export function AssumptionsScreen(): ReactNode {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-lg font-bold text-text-primary mb-4">Assumptions</h1>
      <p className="text-sm text-text-muted">Assumption cards with sensitivity ratings — populated during Phase 7</p>
    </div>
  )
}
