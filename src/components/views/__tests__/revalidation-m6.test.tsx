import { useEffect } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

import { usePipelineController } from '../../../hooks/usePipelineController'
import { PlatformProvider } from '../../../platform'
import { StoreProvider, setActiveRerunCycle, startPipelineAnalysis, updateAnalysisState, useAppStore, useAppStoreApi } from '../../../store'
import { appendConversationMessage, resetConversationStore, resetMcpStore, resetPipelineRuntimeStore, resetPipelineStore } from '../../../store'
import { OverviewScreen } from '../overview/OverviewScreen'
import { PhaseDetailScreen } from '../phases/PhaseDetailScreen'

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <StoreProvider>{children}</StoreProvider>
    </PlatformProvider>
  )
}

function SeedRevalidationOverview() {
  const appStore = useAppStoreApi()
  const sourceCount = useAppStore((state) => Object.keys(state.canonical.revalidation_events).length)

  useEffect(() => {
    startPipelineAnalysis({
      analysisId: appStore.getState().eventLog.analysis_id,
      description: 'State A vs State B bargaining',
      domain: 'geopolitical',
      classification: null,
    })
    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'objective_function_changed',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [],
        description: 'Historical evidence changed the baseline model.',
        pass_number: 1,
      },
    })

    const event = Object.values(appStore.getState().canonical.revalidation_events)[0]
    if (!event) {
      return
    }

    appendConversationMessage({
      role: 'ai',
      content: 'Revalidation is pending review.',
      message_type: 'revalidation',
      phase: 5,
      structured_content: {
        revalidation_actions: [{
          event_id: event.id,
          trigger_condition: event.trigger_condition,
          source_phase: event.source_phase,
          target_phases: event.target_phases,
          description: event.description,
          pass_number: event.pass_number,
          resolution: event.resolution,
          entity_refs: event.entity_refs,
        }],
      },
    })
  }, [appStore])

  return (
    <>
      <OverviewScreen />
      <div data-testid="revalidation-count">{sourceCount}</div>
    </>
  )
}

function SeedRevalidationPhaseScreen() {
  const appStore = useAppStoreApi()

  useEffect(() => {
    appStore.getState().dispatch({
      kind: 'add_player',
      id: 'player_a',
      payload: { name: 'State A', type: 'state', objectives: [], constraints: [] },
    })
    appStore.getState().dispatch({
      kind: 'add_player',
      id: 'player_b',
      payload: { name: 'State B', type: 'state', objectives: [], constraints: [] },
    })
    appStore.getState().dispatch({
      kind: 'add_game',
      id: 'game_phase_5',
      payload: {
        name: 'Escalation baseline',
        description: 'Test game',
        semantic_labels: ['bargaining'],
        players: ['player_a', 'player_b'],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'repeated_dominates_oneshot',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [{ type: 'game', id: 'game_phase_5' }],
        description: 'Repeated interaction dominates the one-shot baseline.',
        pass_number: 2,
      },
    })
  }, [appStore])

  return <PhaseDetailScreen phase={5} />
}

function PipelineDecisionProbe() {
  const { nextPhaseDecision } = usePipelineController()

  return (
    <div data-testid="next-phase-decision">
      {String(nextPhaseDecision.canRun)}|{String(nextPhaseDecision.nextPhase)}|{nextPhaseDecision.message}
    </div>
  )
}

describe('M6 revalidation UI', () => {
  beforeEach(() => {
    resetConversationStore()
    resetPipelineStore()
    resetPipelineRuntimeStore()
    resetMcpStore()
  })

  it('renders revalidation action cards in the overview conversation', async () => {
    render(
      <Providers>
        <SeedRevalidationOverview />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText(/Approve rerun/i)).toBeInTheDocument())
    expect(screen.getByText(/Historical evidence changed the baseline model/i)).toBeInTheDocument()
    expect(screen.getByTestId('revalidation-count')).toHaveTextContent('1')
  })

  it('renders the Phase 5 dashboard with the revalidation log and prompt version controls', async () => {
    render(
      <Providers>
        <SeedRevalidationPhaseScreen />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText(/Revalidation Log/i)).toBeInTheDocument())
    expect(screen.getByText(/Repeated interaction dominates the one-shot baseline/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prompt Versions' })).toBeInTheDocument()
    expect(screen.getByText(/Fork active prompt/i)).toBeInTheDocument()
  })

  it('blocks next-phase advancement while revalidation events are pending', async () => {
    render(
      <Providers>
        <SeedRevalidationOverview />
        <PipelineDecisionProbe />
      </Providers>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('next-phase-decision')).toHaveTextContent('false|null|Resolve 1 pending revalidation event'),
    )
  })

  it('routes the next phase to the earliest incomplete rerun target', async () => {
    render(
      <Providers>
        <SeedRevalidationOverview />
        <PipelineDecisionProbe />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByTestId('revalidation-count')).toHaveTextContent('1'))

    act(() => {
      updateAnalysisState((analysisState) => {
        if (!analysisState) {
          return analysisState
        }

        return {
          ...analysisState,
          pass_number: 2,
          phase_states: {
            ...analysisState.phase_states,
            3: { ...analysisState.phase_states[3], status: 'needs_rerun', pass_number: 2 },
            4: { ...analysisState.phase_states[4], status: 'complete', pass_number: 2 },
          },
        }
      })
      setActiveRerunCycle({
        event_id: 'rerun_event',
        source_phase: 4,
        target_phases: [3, 4],
        earliest_phase: 4,
        pass_number: 2,
        started_at: new Date().toISOString(),
        status: 'queued',
      })
    })

    await waitFor(() =>
      expect(screen.getByTestId('next-phase-decision')).toHaveTextContent('true|3|Revalidation pass 2 is queued from Phase 3.'),
    )
  })

  // --- Convergence indicator tests ---

  function SeedConvergedAnalysis() {
    const appStore = useAppStoreApi()

    useEffect(() => {
      startPipelineAnalysis({
        analysisId: appStore.getState().eventLog.analysis_id,
        description: 'Converged scenario',
        domain: 'geopolitical',
        classification: null,
      })
      updateAnalysisState((state) =>
        state
          ? { ...state, pass_number: 2, status: 'paused' }
          : state,
      )
    }, [appStore])

    return <PhaseDetailScreen phase={5} />
  }

  function SeedIteratingAnalysis() {
    const appStore = useAppStoreApi()

    useEffect(() => {
      startPipelineAnalysis({
        analysisId: appStore.getState().eventLog.analysis_id,
        description: 'Iterating scenario',
        domain: 'geopolitical',
        classification: null,
      })
      updateAnalysisState((state) =>
        state
          ? { ...state, pass_number: 3, status: 'paused' }
          : state,
      )
      appStore.getState().dispatch({
        kind: 'trigger_revalidation',
        payload: {
          trigger_condition: 'new_game_identified',
          source_phase: 3,
          target_phases: [3, 4],
          entity_refs: [],
          description: 'New game found.',
          pass_number: 3,
        },
      })
    }, [appStore])

    return <PhaseDetailScreen phase={5} />
  }

  it('shows "Analysis converged after 2 passes" when pass > 1 and no open revalidation', async () => {
    render(
      <Providers>
        <SeedConvergedAnalysis />
      </Providers>,
    )

    await waitFor(() =>
      expect(screen.getByText(/Analysis converged after 2 passes/i)).toBeInTheDocument(),
    )
  })

  it('shows "Still iterating — pass 3" when revalidation events are pending', async () => {
    render(
      <Providers>
        <SeedIteratingAnalysis />
      </Providers>,
    )

    await waitFor(() =>
      expect(screen.getByText(/Still iterating — pass 3/i)).toBeInTheDocument(),
    )
  })
})
