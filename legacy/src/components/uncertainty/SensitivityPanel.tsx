import type { ReactNode } from 'react'

import type { SensitivityAnalysis } from '../../types/solver-results'

interface SensitivityPanelProps {
  analysis: SensitivityAnalysis | null
}

export function SensitivityPanel({ analysis }: SensitivityPanelProps): ReactNode {
  if (!analysis) {
    return null
  }

  return (
    <div className="rounded border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Sensitivity</div>
        <div className="text-xs font-mono uppercase tracking-wide text-text-primary">
          {analysis.overall_robustness}
        </div>
      </div>

      {analysis.threshold_analysis.length > 0 && (
        <div className="mt-3 space-y-2">
          {analysis.threshold_analysis.slice(0, 3).map((entry) => (
            <div key={entry.parameter} className="rounded border border-border bg-bg-surface px-3 py-2 text-xs text-text-muted">
              <div className="font-mono text-text-primary">{entry.parameter}</div>
              <div className="mt-1">
                Current: {entry.current.toFixed(2)} | Threshold: {entry.threshold.toFixed(2)} | Margin: {entry.margin.toFixed(2)}
              </div>
              <div className="mt-1">{entry.consequence}</div>
            </div>
          ))}
        </div>
      )}

      {analysis.assumption_sensitivities.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-mono uppercase tracking-wide text-text-muted">Assumptions</div>
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {analysis.assumption_sensitivities.map((entry) => (
              <li key={entry.assumption_id}>
                {entry.statement}: {entry.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
