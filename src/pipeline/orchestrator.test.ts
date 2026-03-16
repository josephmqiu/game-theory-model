import { beforeEach, describe, expect, it } from 'vitest'

import { resetPersistedEventStore } from '../engine/event-persistence'
import { appendConversationMessage, clearConversation, getConversationState, resetConversationStore } from '../store/conversation'
import { createAppStore, resetPipelineRuntimeStore } from '../store'
import { getPipelineRuntimeState, registerPendingRevalidationApproval, setActiveRerunCycle } from '../store/pipeline-runtime'
import { getPipelineState, resetPipelineStore, updateAnalysisState } from '../store/pipeline'
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

describe('pipeline orchestrator revalidation flow', () => {
  beforeEach(() => {
    resetPersistedEventStore()
    resetConversationStore()
    resetPipelineStore()
    resetPipelineRuntimeStore()
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
})
