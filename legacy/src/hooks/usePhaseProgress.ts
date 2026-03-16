import { useMemo } from 'react'

import { usePipelineStore } from '../store'

const PHASE_LABELS: Record<number, string> = {
  1: 'Grounding',
  2: 'Players',
  3: 'Baseline',
  4: 'History',
  5: 'Revalidation',
  6: 'Formalization',
  7: 'Assumptions',
  8: 'Elimination',
  9: 'Scenarios',
  10: 'Meta-check',
}

export type PhaseDisplayStatus = 'pending' | 'active' | 'complete' | 'needs_rerun' | 'partial' | 'review_needed'

export function usePhaseProgress() {
  const analysisState = usePipelineStore((state) => state.analysis_state)

  const phases = useMemo(() => (
    Array.from({ length: 10 }, (_, index) => {
      const number = index + 1
      const phaseState = analysisState?.phase_states[number]
      let status: PhaseDisplayStatus = 'pending'

      if (phaseState?.status === 'running') {
        status = 'active'
      } else if (phaseState?.status === 'review_needed') {
        status = 'review_needed'
      } else if (phaseState?.status === 'needs_rerun') {
        status = 'needs_rerun'
      } else if (phaseState?.status === 'complete') {
        status = 'complete'
      }

      return {
        number,
        label: PHASE_LABELS[number],
        status,
      }
    })
  ), [analysisState])

  return {
    phases,
    currentPhase: analysisState?.current_phase ?? null,
    passNumber: analysisState?.pass_number ?? 1,
    overallStatus: analysisState?.status === 'failed'
      ? 'blocked'
      : analysisState?.status === 'complete'
        ? 'complete'
        : analysisState?.status === 'running'
          ? 'running'
          : 'idle',
  }
}
