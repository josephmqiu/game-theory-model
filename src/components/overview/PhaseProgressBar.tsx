import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Loader } from 'lucide-react'

import { useAppStore } from '../../store'
import type { PhaseDisplayStatus } from '../../hooks/usePhaseProgress'

function StatusIcon({ status }: { status: PhaseDisplayStatus }): ReactNode {
  switch (status) {
    case 'active':
      return <Loader className="h-3.5 w-3.5 animate-spin text-accent" />
    case 'complete':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
    case 'needs_rerun':
    case 'review_needed':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
    default:
      return <Circle className="h-3.5 w-3.5 text-text-dim" />
  }
}

interface PhaseProgressBarProps {
  phases: ReadonlyArray<{ number: number; label: string; status: PhaseDisplayStatus }>
  currentPhase: number | null
  passNumber: number
  overallStatus: string
}

export function PhaseProgressBar({
  phases,
  currentPhase,
  passNumber,
  overallStatus,
}: PhaseProgressBarProps): ReactNode {
  const setActiveView = useAppStore((state) => state.setActiveView)

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-text-dim">Phase Progress</div>
          <div className="mt-1 text-sm text-text-primary">Pass {passNumber} · {overallStatus}</div>
        </div>
        <div className="text-sm text-text-muted">
          {currentPhase ? `Running P${currentPhase}` : 'Awaiting next step'}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-10">
        {phases.map((phase) => (
          <button
            key={phase.number}
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-3 py-2 text-left hover:border-accent"
            onClick={() => setActiveView(`phase_${phase.number}` as never)}
          >
            <StatusIcon status={phase.status} />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary">P{phase.number}</div>
              <div className="truncate text-[11px] text-text-dim">{phase.label}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
