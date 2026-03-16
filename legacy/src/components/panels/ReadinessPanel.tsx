import type { ReactNode } from 'react'

import type { ReadinessReport } from '../../types/readiness'

interface ReadinessPanelProps {
  report: ReadinessReport | null
}

function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'text-green-400'
    case 'usable_with_warnings':
      return 'text-amber-400'
    default:
      return 'text-red-400'
  }
}

export function ReadinessPanel({ report }: ReadinessPanelProps): ReactNode {
  if (!report) {
    return (
      <div className="rounded border border-border bg-bg-card p-4">
        <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Readiness</div>
        <div className="mt-2 text-sm text-text-muted">No readiness report computed yet.</div>
      </div>
    )
  }

  return (
    <div className="rounded border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Readiness</div>
        <div className={`text-xs font-mono uppercase tracking-wide ${statusColor(report.readiness.overall)}`}>
          {report.readiness.overall.replace(/_/g, ' ')}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-text-muted md:grid-cols-2">
        <div>Completeness: {Math.round(report.readiness.completeness_score * 100)}%</div>
        <div>Confidence floor: {report.readiness.confidence_floor.toFixed(2)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {report.readiness.supported_solvers.map((solver) => (
          <span key={solver} className="rounded border border-border px-2 py-1 text-[10px] font-mono text-text-primary">
            {solver}
          </span>
        ))}
      </div>

      {report.readiness.blockers.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-mono uppercase tracking-wide text-red-400">Blockers</div>
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {report.readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {report.readiness.warnings.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-mono uppercase tracking-wide text-amber-400">Warnings</div>
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {report.readiness.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
