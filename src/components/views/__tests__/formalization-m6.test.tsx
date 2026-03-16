import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { PlatformProvider } from '../../../platform'
import {
  resetConversationStore,
  resetMcpStore,
  resetPipelineRuntimeStore,
  resetPipelineStore,
  setPhaseResult,
  startPipelineAnalysis,
  useAppStoreApi,
} from '../../../store'
import { StoreProvider } from '../../../store'
import {
  createNormalFormStore,
  createSuccessLoadResult,
} from '../../../test-support/m4-fixtures'
import type { FormalizationResult } from '../../../types/analysis-pipeline'
import { PhaseDetailScreen } from '../phases/PhaseDetailScreen'

function Providers({ children }: { children: ReactNode }) {
  return (
    <PlatformProvider>
      <StoreProvider>{children}</StoreProvider>
    </PlatformProvider>
  )
}

function SeedFormalizationPhaseScreen() {
  const appStore = useAppStoreApi()

  useEffect(() => {
    appStore.getState().loadFromResult(createSuccessLoadResult(createNormalFormStore()))

    startPipelineAnalysis({
      analysisId: appStore.getState().eventLog.analysis_id,
      description: 'Negotiation with repeated signaling and private information',
      domain: 'geopolitical',
      classification: null,
    })
    appStore.getState().setActiveGame('game_1')
    appStore.getState().setActiveFormalization('formalization_1')

    const phaseResult: FormalizationResult = {
      phase: 6,
      status: {
        status: 'complete',
        phase: 6,
        execution_id: 'phase_execution_6',
        retriable: true,
      },
      subsections_run: ['6a', '6c', '6h'],
      subsection_statuses: [
        { subsection: '6a', status: 'complete', summary: 'Prepared formal representations.', warnings: [] },
        { subsection: '6c', status: 'complete', summary: 'Generated baseline equilibrium summaries.', warnings: [] },
        { subsection: '6h', status: 'complete', summary: 'Behavioral overlays documented.', warnings: [] },
      ],
      formal_representations: {
        status: 'complete',
        summaries: [
          {
            formalization_id: 'formalization_1',
            game_id: 'game_1',
            game_name: 'Baseline game',
            kind: 'normal_form',
            purpose: 'computational',
            abstraction_level: 'moderate',
            reused_existing: true,
            rationale: 'Reuse the accepted matrix as the computational anchor.',
            assumption_ids: ['assumption_1'],
          },
        ],
        reused_formalization_ids: ['formalization_1'],
        new_game_hypotheses: [],
        assumption_proposal_ids: ['assumption_1'],
        warnings: [],
      },
      payoff_estimation: { status: 'not_applicable', updates: [], warnings: [] },
      baseline_equilibria: {
        status: 'complete',
        analyses: [
          {
            formalization_id: 'formalization_1',
            game_id: 'game_1',
            kind: 'normal_form',
            readiness: {
              overall: 'usable_with_warnings',
              completeness_score: 1,
              confidence_floor: 0.6,
              blockers: [],
              warnings: ['Readiness warning'],
              supported_solvers: ['dominance', 'expected_utility'],
            },
            solver_summaries: [
              {
                solver: 'readiness',
                status: 'partial',
                summary: 'Usable with warnings.',
                warnings: ['Readiness warning'],
              },
            ],
            classification: 'Single focal equilibrium candidate.',
          },
        ],
        warnings: [],
      },
      equilibrium_selection: { status: 'partial', selections: [], warnings: [] },
      bargaining_dynamics: null,
      communication_analysis: { status: 'not_applicable', classifications: [], warnings: [] },
      option_value: null,
      behavioral_overlays: {
        status: 'complete',
        label: 'ADJACENT — NOT CORE GAME THEORY',
        methodology_flags: [],
        overlays: [
          {
            label: 'Behavioral misperception risk',
            effect_on_prediction: 'changes_prediction',
            summary: 'Behavioral overlay changes the expected branch weights.',
          },
        ],
        warnings: [],
      },
      cross_game_effects: null,
      proposals: [],
      proposal_groups: [],
      revalidation_signals: {
        triggers_found: ['behavioral_overlay_changes_prediction'],
        affected_entities: [{ type: 'game', id: 'game_1' }],
        description: 'Behavioral overlays affect the prediction.',
      },
    }

    setPhaseResult(6, phaseResult)
  }, [appStore])

  return <PhaseDetailScreen phase={6} />
}

describe('M6 formalization UI', () => {
  beforeEach(() => {
    resetConversationStore()
    resetPipelineStore()
    resetPipelineRuntimeStore()
    resetMcpStore()
  })

  it('renders the Phase 6 dashboard and reuses the matrix workspace for normal-form formalizations', async () => {
    render(
      <Providers>
        <SeedFormalizationPhaseScreen />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText(/Phase 6: Full Formalization/i)).toBeInTheDocument())
    expect(screen.getByText(/Subsection Progress/i)).toBeInTheDocument()
    expect(screen.getByText(/ADJACENT — NOT CORE GAME THEORY/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('matrix-view')).toBeInTheDocument())
  })
})
