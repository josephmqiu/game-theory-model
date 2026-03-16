import { beforeEach, describe, expect, it } from 'vitest'

import { resetPersistedEventStore } from '../engine/event-persistence'
import { getDerivedStore, resetDerivedState } from '../store/derived'
import { appendConversationMessage, clearConversation, getConversationState, resetConversationStore } from '../store/conversation'
import { createAppStore, resetPipelineRuntimeStore } from '../store'
import { getPipelineRuntimeState, registerPendingRevalidationApproval, setActiveRerunCycle } from '../store/pipeline-runtime'
import { getPipelineState, resetPipelineStore, setPhaseResult, updateAnalysisState } from '../store/pipeline'
import type { EliminationResult, MetaCheckResult, ScenarioGenerationResult } from '../types/analysis-pipeline'
import { createPipelineOrchestrator } from './orchestrator'
import { storeToAnalysisFile } from '../utils/serialization'

function createTestHarness() {
  const appStore = createAppStore()
  const orchestrator = createPipelineOrchestrator({
    getCanonical: () => appStore.getState().canonical,
    getAnalysisFile: () => {
      const meta = appStore.getState().fileMeta.meta
      return meta ? storeToAnalysisFile(appStore.getState().canonical, meta) : null
    },
    getPersistedRevision: () => appStore.getState().eventLog.persisted_revision,
    getActiveAnalysisId: () => appStore.getState().eventLog.analysis_id,
    resetAnalysisSession: () => appStore.getState().resetAnalysisSession(),
    dispatch: (command, opts) => appStore.getState().dispatch(command, opts),
    emitConversationMessage: (message) => appendConversationMessage(message),
  })

  return {
    appStore,
    orchestrator,
  }
}

async function seedPhase2Revalidation() {
  const harness = createTestHarness()
  await harness.orchestrator.startAnalysis('State A cabinet bargaining with State B')
  await harness.orchestrator.runPhase(1)
  clearConversation()
  await harness.orchestrator.runPhase(2, {
    additional_context: 'Cabinet faction has its own independent incentives.',
  })

  const event = Object.values(harness.appStore.getState().canonical.revalidation_events)[0]
  if (!event) {
    throw new Error('Expected a revalidation event to be created.')
  }

  return {
    ...harness,
    event,
  }
}

function seedModelForPhase8(appStore: ReturnType<typeof createAppStore>): void {
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
    kind: 'add_claim',
    id: 'claim_support',
    payload: { statement: 'Support claim', based_on: [], confidence: 0.8 },
  })
  appStore.getState().dispatch({
    kind: 'add_assumption',
    id: 'assumption_existing',
    payload: {
      statement: 'State B retains coercive capacity.',
      type: 'capability',
      sensitivity: 'medium',
      confidence: 0.6,
      supported_by: ['claim_support'],
      game_theoretic_vs_empirical: 'empirical',
      correlated_cluster_id: null,
    },
  })
  appStore.getState().dispatch({
    kind: 'add_game',
    id: 'game_1',
    payload: {
      name: 'Baseline game',
      description: 'Accepted baseline',
      semantic_labels: ['bargaining'],
      players: ['player_a', 'player_b'],
      status: 'active',
      formalizations: [],
      coupling_links: [],
      key_assumptions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      canonical_game_type: 'bargaining',
      move_order: 'simultaneous',
    },
  })
  appStore.getState().dispatch({
    kind: 'add_formalization',
    id: 'formalization_base',
    payload: {
      game_id: 'game_1',
      kind: 'normal_form',
      purpose: 'explanatory',
      abstraction_level: 'minimal',
      assumptions: ['assumption_existing'],
      strategies: {
        player_a: ['Escalate', 'Hold'],
        player_b: ['Resist', 'Accommodate'],
      },
      payoff_cells: [],
    } as Omit<import('../types/formalizations').NormalFormModel, 'id'>,
  })
  appStore.getState().dispatch({
    kind: 'attach_formalization_to_game',
    payload: {
      game_id: 'game_1',
      formalization_id: 'formalization_base',
    },
  })
  appStore.getState().dispatch({
    kind: 'add_scenario',
    id: 'scenario_1',
    payload: {
      name: 'Baseline scenario',
      formalization_id: 'formalization_base',
      path: [],
      probability_model: 'ordinal_only',
      key_assumptions: ['assumption_existing'],
      invalidators: [],
      narrative: 'Baseline scenario narrative.',
    },
  })

  setPhaseResult(6, {
    phase: 6,
    status: { status: 'complete', phase: 6, execution_id: 'phase_6', retriable: true },
    subsections_run: ['6c'],
    subsection_statuses: [],
    formal_representations: {
      status: 'complete',
      summaries: [{
        formalization_id: 'formalization_base',
        game_id: 'game_1',
        game_name: 'Baseline game',
        kind: 'normal_form',
        purpose: 'explanatory',
        abstraction_level: 'minimal',
        reused_existing: true,
        rationale: 'Accepted baseline',
        assumption_ids: ['assumption_existing'],
      }],
      reused_formalization_ids: ['formalization_base'],
      new_game_hypotheses: [],
      assumption_proposal_ids: [],
      warnings: [],
    },
    payoff_estimation: { status: 'complete', updates: [], warnings: [] },
    baseline_equilibria: { status: 'complete', analyses: [], warnings: [] },
    equilibrium_selection: {
      status: 'complete',
      selections: [{
        formalization_id: 'formalization_base',
        selected_equilibrium_id: 'eq_1',
        rationale: 'Selected baseline equilibrium.',
        alternatives: [],
      }],
      warnings: [],
    },
    bargaining_dynamics: null,
    communication_analysis: { status: 'complete', classifications: [], warnings: [] },
    option_value: null,
    behavioral_overlays: null,
    cross_game_effects: null,
    proposals: [],
    proposal_groups: [],
    workspace_previews: {},
    revalidation_signals: { triggers_found: [], affected_entities: [], description: 'none' },
  })

  getDerivedStore().setState((state) => ({
    ...state,
    sensitivityByFormalizationAndSolver: {
      ...state.sensitivityByFormalizationAndSolver,
      formalization_base: {
        nash: {
          formalization_id: 'formalization_base',
          solver: 'nash',
          solver_result_id: 'solver_1',
          computed_at: new Date().toISOString(),
          payoff_sensitivities: [],
          assumption_sensitivities: [{
            assumption_id: 'assumption_existing',
            statement: 'State B retains coercive capacity.',
            impact: 'result_changes',
            description: 'Flips the current equilibrium.',
            affected_payoffs: ['player_a:Escalate|Resist'],
          }],
          threshold_analysis: [],
          overall_robustness: 'fragile',
        },
      },
    },
  }))
}

describe('pipeline orchestrator revalidation flow', () => {
  beforeEach(() => {
    resetPersistedEventStore()
    resetConversationStore()
    resetPipelineStore()
    resetPipelineRuntimeStore()
    resetDerivedState()
  })

  it('creates a revalidation event and conversation card after phase 2 reveals internal agency', async () => {
    const { appStore, event } = await seedPhase2Revalidation()

    expect(event.trigger_condition).toBe('new_player_discovered')
    expect(getPipelineState().analysis_state?.phase_states[3]?.status).toBe('needs_rerun')
    expect(getPipelineState().analysis_state?.phase_states[4]?.status).toBe('needs_rerun')
    expect(getPipelineRuntimeState().pending_revalidation_approvals[event.id]).toBeDefined()
    expect(
      getConversationState().messages.some((message) => message.message_type === 'revalidation'),
    ).toBe(true)
    expect(appStore.getState().canonical.revalidation_events[event.id]).toBeDefined()
  })

  it('approving a revalidation event increments the pass number and queues a rerun cycle', async () => {
    const { appStore, orchestrator, event } = await seedPhase2Revalidation()

    const outcome = await orchestrator.approveRevalidation(event.id)

    expect(outcome?.new_pass_number).toBe(2)
    expect(getPipelineState().analysis_state?.pass_number).toBe(2)
    expect(getPipelineRuntimeState().active_rerun_cycle?.event_id).toBe(event.id)
    expect(getPipelineRuntimeState().active_rerun_cycle?.earliest_phase).toBe(3)
    expect(appStore.getState().canonical.revalidation_events[event.id]?.resolution).toBe('approved')
    expect(orchestrator.getPendingRevalidations()).toHaveLength(0)
    await expect(orchestrator.approveRevalidation(event.id)).resolves.toBeNull()
  })

  it('keeps an approved rerun active until review clears, then marks it complete', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'objective_function_changed',
        source_phase: 4,
        target_phases: [3],
        entity_refs: [],
        description: 'Historical evidence changed the baseline framing.',
        pass_number: 1,
      },
    })

    const event = Object.values(appStore.getState().canonical.revalidation_events)[0]
    if (!event) {
      throw new Error('Expected a seeded revalidation event.')
    }

    appStore.getState().dispatch({
      kind: 'update_revalidation_event',
      payload: {
        id: event.id,
        resolution: 'approved',
      },
    })

    setActiveRerunCycle({
      event_id: event.id,
      source_phase: 4,
      target_phases: [3],
      earliest_phase: 3,
      pass_number: 2,
      started_at: new Date().toISOString(),
      status: 'queued',
    })

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }

      return {
        ...analysisState,
        pass_number: 2,
        phase_states: {
          ...analysisState.phase_states,
          3: { ...analysisState.phase_states[3], status: 'review_needed', pass_number: 2 },
        },
      }
    })

    orchestrator.reconcileActiveRerunCycle()
    expect(getPipelineRuntimeState().active_rerun_cycle?.status).toBe('running')
    expect(appStore.getState().canonical.revalidation_events[event.id]?.resolution).toBe('approved')

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }

      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          3: { ...analysisState.phase_states[3], status: 'complete' },
        },
      }
    })

    orchestrator.reconcileActiveRerunCycle()
    expect(getPipelineRuntimeState().active_rerun_cycle).toBeNull()
    expect(appStore.getState().canonical.revalidation_events[event.id]?.resolution).toBe('rerun_complete')
  })

  it('returns phase 5 as partial while pending revalidation or active rerun state exists', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'objective_function_changed',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [],
        description: 'Historical evidence changed the baseline framing.',
        pass_number: 1,
      },
    })

    const result = await orchestrator.runPhase(5)

    expect(result.status).toBe('partial')
    expect(getPipelineState().analysis_state?.phase_states[5]?.status).toBe('review_needed')
  })

  it('dismissing a revalidation event restores phase statuses while keeping stale warnings intact', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

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
      id: 'game_revalidation',
      payload: {
        name: 'Baseline game',
        description: 'Test baseline',
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
        entity_refs: [{ type: 'game', id: 'game_revalidation' }],
        description: 'Historical review changed the baseline.',
        pass_number: 1,
      },
    })
    appStore.getState().dispatch({
      kind: 'mark_stale',
      payload: {
        id: 'game_revalidation',
        reason: 'Revalidation should keep the stale warning after dismissal.',
      },
    })

    const event = Object.values(appStore.getState().canonical.revalidation_events)[0]
    if (!event) {
      throw new Error('Expected a seeded revalidation event.')
    }

    registerPendingRevalidationApproval({
      event_id: event.id,
      source_phase: 4,
      target_phases: [3, 4],
      affected_entities: [{ type: 'game', id: 'game_revalidation' }],
      previous_phase_statuses: { 3: 'complete', 4: 'review_needed' },
      created_at: new Date().toISOString(),
    })
    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          3: { ...analysisState.phase_states[3], status: 'needs_rerun' },
          4: { ...analysisState.phase_states[4], status: 'needs_rerun' },
        },
      }
    })

    orchestrator.dismissRevalidation(event.id)

    expect(appStore.getState().canonical.revalidation_events[event.id]?.resolution).toBe('dismissed')
    expect(getPipelineState().analysis_state?.phase_states[3]?.status).toBe('complete')
    expect(getPipelineState().analysis_state?.phase_states[4]?.status).toBe('review_needed')
    expect(getPipelineRuntimeState().pending_revalidation_approvals[event.id]).toBeUndefined()
    expect(appStore.getState().canonical.games.game_revalidation.stale_markers?.length).toBeGreaterThan(0)
  })

  it('preserves needs_rerun when dismissing one of multiple overlapping pending events', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'objective_function_changed',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [],
        description: 'Historical evidence changed the baseline framing.',
        pass_number: 1,
      },
    })
    appStore.getState().dispatch({
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'repeated_dominates_oneshot',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [],
        description: 'Repeated interaction dominates the one-shot baseline.',
        pass_number: 1,
      },
    })

    const [firstEvent, secondEvent] = Object.values(appStore.getState().canonical.revalidation_events)
    if (!firstEvent || !secondEvent) {
      throw new Error('Expected overlapping revalidation events.')
    }

    registerPendingRevalidationApproval({
      event_id: firstEvent.id,
      source_phase: 4,
      target_phases: [3, 4],
      affected_entities: [],
      previous_phase_statuses: { 3: 'complete', 4: 'complete' },
      created_at: new Date().toISOString(),
    })
    registerPendingRevalidationApproval({
      event_id: secondEvent.id,
      source_phase: 4,
      target_phases: [3, 4],
      affected_entities: [],
      previous_phase_statuses: { 3: 'complete', 4: 'complete' },
      created_at: new Date().toISOString(),
    })

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }

      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          3: { ...analysisState.phase_states[3], status: 'needs_rerun' },
          4: { ...analysisState.phase_states[4], status: 'needs_rerun' },
        },
      }
    })

    orchestrator.dismissRevalidation(firstEvent.id)

    expect(appStore.getState().canonical.revalidation_events[firstEvent.id]?.resolution).toBe('dismissed')
    expect(appStore.getState().canonical.revalidation_events[secondEvent.id]?.resolution).toBe('pending')
    expect(getPipelineState().analysis_state?.phase_states[3]?.status).toBe('needs_rerun')
    expect(getPipelineState().analysis_state?.phase_states[4]?.status).toBe('needs_rerun')
  })

  it('runs phase 7 once phase 6 is complete and stores the extracted assumptions', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

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
      kind: 'add_claim',
      id: 'claim_support',
      payload: { statement: 'Support claim', based_on: [], confidence: 0.8 },
    })
    appStore.getState().dispatch({
      kind: 'add_assumption',
      id: 'assumption_existing',
      payload: {
        statement: 'State B retains coercive capacity.',
        type: 'capability',
        sensitivity: 'medium',
        confidence: 0.6,
        supported_by: ['claim_support'],
        game_theoretic_vs_empirical: 'empirical',
        correlated_cluster_id: null,
      },
    })
    appStore.getState().dispatch({
      kind: 'add_game',
      id: 'game_1',
      payload: {
        name: 'Baseline game',
        description: 'Accepted baseline',
        semantic_labels: ['bargaining'],
        players: ['player_a', 'player_b'],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        canonical_game_type: 'bargaining',
        move_order: 'simultaneous',
      },
    })
    appStore.getState().dispatch({
      kind: 'add_formalization',
      id: 'formalization_base',
      payload: {
        game_id: 'game_1',
        kind: 'normal_form',
        purpose: 'explanatory',
        abstraction_level: 'minimal',
        assumptions: ['assumption_existing'],
        strategies: {
          player_a: ['Escalate', 'Hold'],
          player_b: ['Resist', 'Accommodate'],
        },
        payoff_cells: [],
      } as Omit<import('../types/formalizations').NormalFormModel, 'id'>,
    })
    appStore.getState().dispatch({
      kind: 'attach_formalization_to_game',
      payload: {
        game_id: 'game_1',
        formalization_id: 'formalization_base',
      },
    })
    appStore.getState().dispatch({
      kind: 'add_scenario',
      id: 'scenario_1',
      payload: {
        name: 'Baseline scenario',
        formalization_id: 'formalization_base',
        path: [],
        probability_model: 'ordinal_only',
        key_assumptions: ['assumption_existing'],
        invalidators: [],
        narrative: 'Baseline scenario narrative.',
      },
    })

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 6; phase += 1) {
        phase_states[phase] = { ...phase_states[phase], status: 'complete' }
      }
      return { ...analysisState, phase_states }
    })

    setPhaseResult(6, {
      phase: 6,
      status: { status: 'complete', phase: 6, execution_id: 'phase_6', retriable: true },
      subsections_run: ['6c'],
      subsection_statuses: [],
      formal_representations: {
        status: 'complete',
        summaries: [{
          formalization_id: 'formalization_base',
          game_id: 'game_1',
          game_name: 'Baseline game',
          kind: 'normal_form',
          purpose: 'explanatory',
          abstraction_level: 'minimal',
          reused_existing: true,
          rationale: 'Accepted baseline',
          assumption_ids: ['assumption_existing'],
        }],
        reused_formalization_ids: ['formalization_base'],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      },
      payoff_estimation: { status: 'complete', updates: [], warnings: [] },
      baseline_equilibria: { status: 'complete', analyses: [], warnings: [] },
      equilibrium_selection: {
        status: 'complete',
        selections: [{
          formalization_id: 'formalization_base',
          selected_equilibrium_id: 'eq_1',
          rationale: 'Selected baseline equilibrium.',
          alternatives: [],
        }],
        warnings: [],
      },
      bargaining_dynamics: null,
      communication_analysis: { status: 'complete', classifications: [], warnings: [] },
      option_value: null,
      behavioral_overlays: null,
      cross_game_effects: null,
      proposals: [],
      proposal_groups: [],
      workspace_previews: {},
      revalidation_signals: { triggers_found: [], affected_entities: [], description: 'none' },
    })

    getDerivedStore().setState((state) => ({
      ...state,
      sensitivityByFormalizationAndSolver: {
        ...state.sensitivityByFormalizationAndSolver,
        formalization_base: {
          nash: {
            formalization_id: 'formalization_base',
            solver: 'nash',
            solver_result_id: 'solver_1',
            computed_at: new Date().toISOString(),
            payoff_sensitivities: [],
            assumption_sensitivities: [{
              assumption_id: 'assumption_existing',
              statement: 'State B retains coercive capacity.',
              impact: 'result_changes',
              description: 'Flips the current equilibrium.',
              affected_payoffs: ['player_a:Escalate|Resist'],
            }],
            threshold_analysis: [],
            overall_robustness: 'fragile',
          },
        },
      },
    }))

    const result = await orchestrator.runPhase(7)

    expect(result.status).toBe('complete')
    expect(getPipelineState().phase_results[7]).toBeDefined()
    expect(getConversationState().proposal_review.proposals.length).toBeGreaterThan(0)
  })

  it('creates a revalidation event when phase 7 finds a stale critical empirical assumption', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')

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
      kind: 'add_claim',
      id: 'claim_support',
      payload: { statement: 'Support claim', based_on: [], confidence: 0.8 },
    })
    appStore.getState().dispatch({
      kind: 'add_assumption',
      id: 'assumption_stale',
      payload: {
        statement: 'State B retains coercive capacity.',
        type: 'capability',
        sensitivity: 'medium',
        confidence: 0.6,
        supported_by: ['claim_support'],
        game_theoretic_vs_empirical: 'empirical',
        correlated_cluster_id: null,
      },
    })
    appStore.getState().dispatch({
      kind: 'mark_stale',
      payload: {
        id: 'assumption_stale',
        reason: 'New evidence undercuts this assumption.',
      },
    })
    appStore.getState().dispatch({
      kind: 'add_game',
      id: 'game_1',
      payload: {
        name: 'Baseline game',
        description: 'Accepted baseline',
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
      kind: 'add_formalization',
      id: 'formalization_base',
      payload: {
        game_id: 'game_1',
        kind: 'normal_form',
        purpose: 'explanatory',
        abstraction_level: 'minimal',
        assumptions: ['assumption_stale'],
        strategies: {
          player_a: ['Escalate', 'Hold'],
          player_b: ['Resist', 'Accommodate'],
        },
        payoff_cells: [],
      } as Omit<import('../types/formalizations').NormalFormModel, 'id'>,
    })
    appStore.getState().dispatch({
      kind: 'attach_formalization_to_game',
      payload: {
        game_id: 'game_1',
        formalization_id: 'formalization_base',
      },
    })
    appStore.getState().dispatch({
      kind: 'add_scenario',
      id: 'scenario_1',
      payload: {
        name: 'Baseline scenario',
        formalization_id: 'formalization_base',
        path: [],
        probability_model: 'ordinal_only',
        key_assumptions: ['assumption_stale'],
        invalidators: [],
        narrative: 'Baseline scenario narrative.',
      },
    })

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 6; phase += 1) {
        phase_states[phase] = { ...phase_states[phase], status: 'complete' }
      }
      return { ...analysisState, phase_states }
    })

    setPhaseResult(6, {
      phase: 6,
      status: { status: 'complete', phase: 6, execution_id: 'phase_6', retriable: true },
      subsections_run: ['6c'],
      subsection_statuses: [],
      formal_representations: {
        status: 'complete',
        summaries: [{
          formalization_id: 'formalization_base',
          game_id: 'game_1',
          game_name: 'Baseline game',
          kind: 'normal_form',
          purpose: 'explanatory',
          abstraction_level: 'minimal',
          reused_existing: true,
          rationale: 'Accepted baseline',
          assumption_ids: ['assumption_stale'],
        }],
        reused_formalization_ids: ['formalization_base'],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      },
      payoff_estimation: { status: 'complete', updates: [], warnings: [] },
      baseline_equilibria: { status: 'complete', analyses: [], warnings: [] },
      equilibrium_selection: {
        status: 'complete',
        selections: [{
          formalization_id: 'formalization_base',
          selected_equilibrium_id: 'eq_1',
          rationale: 'Selected baseline equilibrium.',
          alternatives: [],
        }],
        warnings: [],
      },
      bargaining_dynamics: null,
      communication_analysis: { status: 'complete', classifications: [], warnings: [] },
      option_value: null,
      behavioral_overlays: null,
      cross_game_effects: null,
      proposals: [],
      proposal_groups: [],
      workspace_previews: {},
      revalidation_signals: { triggers_found: [], affected_entities: [], description: 'none' },
    })

    getDerivedStore().setState((state) => ({
      ...state,
      sensitivityByFormalizationAndSolver: {
        ...state.sensitivityByFormalizationAndSolver,
        formalization_base: {
          nash: {
            formalization_id: 'formalization_base',
            solver: 'nash',
            solver_result_id: 'solver_1',
            computed_at: new Date().toISOString(),
            payoff_sensitivities: [],
            assumption_sensitivities: [{
              assumption_id: 'assumption_stale',
              statement: 'State B retains coercive capacity.',
              impact: 'result_changes',
              description: 'Flips the current equilibrium.',
              affected_payoffs: ['player_a:Escalate|Resist'],
            }],
            threshold_analysis: [],
            overall_robustness: 'fragile',
          },
        },
      },
    }))

    await orchestrator.runPhase(7)

    const phase7 = getPipelineState().phase_results[7] as {
      assumptions: Array<{ temp_id: string; sensitivity: string }>
    } | undefined
    expect(phase7?.assumptions.find((assumption) => assumption.temp_id === 'assumption_stale')?.sensitivity).toBe('critical')
    const event = Object.values(appStore.getState().canonical.revalidation_events)[0]
    expect(event?.trigger_condition).toBe('critical_empirical_assumption_invalidated')
    expect(event?.target_phases).toEqual([7, 8, 9])
  })

  it('runs phase 8 elimination after prior phases are seeded', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')
    seedModelForPhase8(appStore)

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 7; phase += 1) {
        phase_states[phase] = { ...phase_states[phase], status: 'complete' }
      }
      return { ...analysisState, phase_states }
    })

    const result = await orchestrator.runPhase(8)

    expect(result.status).toBe('complete')
    const phase8 = getPipelineState().phase_results[8] as EliminationResult | undefined
    expect(phase8).toBeDefined()
    expect(phase8?.eliminated_outcomes).toBeDefined()
    expect(getConversationState().messages.some((m) => m.phase === 8)).toBe(true)
  })

  it('runs phase 9 scenario generation after phase 8 completes', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')
    seedModelForPhase8(appStore)

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 7; phase += 1) {
        phase_states[phase] = { ...phase_states[phase], status: 'complete' }
      }
      return { ...analysisState, phase_states }
    })

    await orchestrator.runPhase(8)
    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          8: { ...analysisState.phase_states[8], status: 'complete' },
        },
      }
    })

    const result = await orchestrator.runPhase(9)

    expect(result.status).toBe('complete')
    const phase9 = getPipelineState().phase_results[9] as ScenarioGenerationResult | undefined
    expect(phase9).toBeDefined()
    expect(phase9?.central_thesis).toBeDefined()
    expect(phase9?.proposed_scenarios).toBeDefined()
  })

  it('runs phase 10 meta-check and reports analysis_complete', async () => {
    const { appStore, orchestrator } = createTestHarness()
    await orchestrator.startAnalysis('State A vs State B bargaining')
    seedModelForPhase8(appStore)

    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 7; phase += 1) {
        phase_states[phase] = { ...phase_states[phase], status: 'complete' }
      }
      return { ...analysisState, phase_states }
    })

    await orchestrator.runPhase(8)
    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          8: { ...analysisState.phase_states[8], status: 'complete' },
        },
      }
    })

    await orchestrator.runPhase(9)
    clearConversation()
    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }
      return {
        ...analysisState,
        phase_states: {
          ...analysisState.phase_states,
          9: { ...analysisState.phase_states[9], status: 'complete' },
        },
      }
    })

    const result = await orchestrator.runPhase(10)

    expect(result.status).toBe('complete')
    const phase10 = getPipelineState().phase_results[10] as MetaCheckResult | undefined
    expect(phase10).toBeDefined()
    expect(typeof phase10?.analysis_complete).toBe('boolean')
    expect(phase10?.meta_check_answers).toHaveLength(10)
    expect(phase10?.final_test_answers).toHaveLength(6)
    expect(phase10?.adversarial_result).toBeDefined()
    expect(getConversationState().messages.some((m) => m.phase === 10)).toBe(true)
  })
})
