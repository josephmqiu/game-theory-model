import type { ReactNode } from 'react'

import { FormalizationPhaseScreen } from './FormalizationPhaseScreen'
import { RevalidationPhaseScreen } from './RevalidationPhaseScreen'

const PHASE_NAMES: Record<number, string> = {
  1: 'Situational Grounding', 2: 'Player Identification', 3: 'Baseline Strategic Model',
  4: 'Historical Repeated Game', 5: 'Recursive Revalidation', 6: 'Full Formalization',
  7: 'Assumption Extraction', 8: 'Elimination', 9: 'Scenario Generation', 10: 'Meta-check',
}

export function PhaseDetailScreen({ phase }: { phase: number }): ReactNode {
  if (phase === 5) {
    return <RevalidationPhaseScreen />
  }
  if (phase === 6) {
    return <FormalizationPhaseScreen />
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="px-2 py-1 bg-bg-surface border border-border rounded text-xs font-mono text-text-muted">P{phase}</span>
        <h1 className="text-lg font-bold text-text-primary">{PHASE_NAMES[phase] ?? `Phase ${phase}`}</h1>
      </div>
      <p className="text-sm text-text-muted">Phase detail content — populated when AI runs this phase</p>
    </div>
  )
}
