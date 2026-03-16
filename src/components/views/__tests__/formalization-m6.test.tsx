import { useEffect, type ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

function SeedAcceptedFormalizationPhaseScreen() {
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
      workspace_previews: {
        formalization_1: {
          kind: 'normal_form',
          formalization_id: 'formalization_1',
          game_id: 'game_1',
          player_ids: ['player_1', 'player_2'],
          row_player_id: 'player_1',
          col_player_id: 'player_2',
          row_strategies: ['Cooperate', 'Defect'],
          col_strategies: ['Cooperate', 'Defect'],
          cells: [
            {
              row_strategy: 'Cooperate',
              col_strategy: 'Cooperate',
              payoffs: {},
            },
          ],
        },
      },
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

function SeedProposedFormalizationPhaseScreen() {
  const appStore = useAppStoreApi()

  useEffect(() => {
    appStore.getState().loadFromResult(createSuccessLoadResult(createNormalFormStore()))

    startPipelineAnalysis({
      analysisId: appStore.getState().eventLog.analysis_id,
      description: 'Negotiation with a proposed formalization preview',
      domain: 'geopolitical',
      classification: null,
    })
    appStore.getState().setActiveGame('game_1')
    appStore.getState().setActiveFormalization('formalization_preview_normal')

    const phaseResult: FormalizationResult = {
      phase: 6,
      status: {
        status: 'complete',
        phase: 6,
        execution_id: 'phase_execution_6',
        retriable: true,
      },
      subsections_run: ['6a', '6c'],
      subsection_statuses: [
        { subsection: '6a', status: 'complete', summary: 'Prepared formal representations.', warnings: [] },
        { subsection: '6c', status: 'complete', summary: 'Generated baseline equilibrium summaries.', warnings: [] },
      ],
      formal_representations: {
        status: 'complete',
        summaries: [
          {
            formalization_id: 'formalization_preview_normal',
            game_id: 'game_1',
            game_name: 'Prisoners Dilemma',
            kind: 'normal_form',
            purpose: 'computational',
            abstraction_level: 'moderate',
            reused_existing: false,
            rationale: 'Preview a proposed matrix before acceptance.',
            assumption_ids: [],
          },
          {
            formalization_id: 'formalization_preview_tree',
            game_id: 'game_1',
            game_name: 'Prisoners Dilemma',
            kind: 'extensive_form',
            purpose: 'computational',
            abstraction_level: 'moderate',
            reused_existing: false,
            rationale: 'Preview a proposed tree before acceptance.',
            assumption_ids: [],
          },
        ],
        reused_formalization_ids: [],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      },
      payoff_estimation: { status: 'not_applicable', updates: [], warnings: [] },
      baseline_equilibria: {
        status: 'complete',
        analyses: [
          {
            formalization_id: 'formalization_preview_normal',
            game_id: 'game_1',
            kind: 'normal_form',
            readiness: {
              overall: 'ready',
              completeness_score: 1,
              confidence_floor: 0.7,
              blockers: [],
              warnings: [],
              supported_solvers: ['nash'],
            },
            solver_summaries: [],
            classification: 'Preview-ready matrix.',
          },
          {
            formalization_id: 'formalization_preview_tree',
            game_id: 'game_1',
            kind: 'extensive_form',
            readiness: {
              overall: 'usable_with_warnings',
              completeness_score: 0.8,
              confidence_floor: 0.6,
              blockers: [],
              warnings: ['Tree preview warning'],
              supported_solvers: ['backward_induction'],
            },
            solver_summaries: [],
            classification: 'Preview-ready tree.',
          },
        ],
        warnings: [],
      },
      equilibrium_selection: { status: 'not_applicable', selections: [], warnings: [] },
      bargaining_dynamics: null,
      communication_analysis: { status: 'not_applicable', classifications: [], warnings: [] },
      option_value: null,
      behavioral_overlays: null,
      cross_game_effects: null,
      proposals: [],
      proposal_groups: [],
      workspace_previews: {
        formalization_preview_normal: {
          kind: 'normal_form',
          formalization_id: 'formalization_preview_normal',
          game_id: 'game_1',
          player_ids: ['player_1', 'player_2'],
          row_player_id: 'player_1',
          col_player_id: 'player_2',
          row_strategies: ['Signal hard', 'Hold back'],
          col_strategies: ['Concede', 'Resist'],
          cells: [
            {
              row_strategy: 'Signal hard',
              col_strategy: 'Concede',
              payoffs: {},
            },
            {
              row_strategy: 'Hold back',
              col_strategy: 'Resist',
              payoffs: {},
            },
          ],
        },
        formalization_preview_tree: {
          kind: 'extensive_form',
          formalization_id: 'formalization_preview_tree',
          game_id: 'game_1',
          root_node_id: 'node_root_preview',
          nodes: [
            {
              id: 'node_root_preview',
              type: 'decision',
              label: 'Opening move',
              actor_label: 'Player 1',
            },
            {
              id: 'node_terminal_preview',
              type: 'terminal',
              label: 'Settlement outcome',
              actor_label: 'nature',
              terminal_payoffs: {},
            },
          ],
          edges: [
            {
              id: 'edge_preview',
              from: 'node_root_preview',
              to: 'node_terminal_preview',
              label: 'Offer',
            },
          ],
        },
      },
      revalidation_signals: {
        triggers_found: [],
        affected_entities: [],
        description: 'No revalidation signal.',
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

  it('renders the Phase 6 dashboard and reuses the matrix workspace for accepted normal-form formalizations', async () => {
    render(
      <Providers>
        <SeedAcceptedFormalizationPhaseScreen />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText(/Phase 6: Full Formalization/i)).toBeInTheDocument())
    expect(screen.getByText(/Subsection Progress/i)).toBeInTheDocument()
    expect(screen.getByText(/ADJACENT — NOT CORE GAME THEORY/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('matrix-view')).toBeInTheDocument())
  })

  it('renders a read-only preview matrix for proposed normal-form formalizations', async () => {
    render(
      <Providers>
        <SeedProposedFormalizationPhaseScreen />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByTestId('phase6-preview-normal-form')).toBeInTheDocument())
    expect(screen.getByText(/Signal hard/i)).toBeInTheDocument()
  })

  it('renders a read-only preview tree for proposed extensive-form formalizations', async () => {
    render(
      <Providers>
        <SeedProposedFormalizationPhaseScreen />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByTestId('phase6-preview-normal-form')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Prisoners Dilemma · extensive form/i }))
    await waitFor(() => expect(screen.getByTestId('phase6-preview-extensive-form')).toBeInTheDocument())
    expect(screen.getByText(/Opening move/i)).toBeInTheDocument()
  })
})
