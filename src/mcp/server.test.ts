import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearConversation,
  getPipelineState,
  resetConversationStore,
  resetMcpStore,
  resetPipelineRuntimeStore,
  resetPipelineStore,
  startPipelineAnalysis,
  updateAnalysisState,
} from '../store'
import type {
  FormalizationResult,
  GroundingResult,
  PlayerIdentificationResult,
} from '../types/analysis-pipeline'
import type { NormalFormModel } from '../types/formalizations'
import { createConfiguredMcpServer } from './bootstrap'
import { startServer, stopServer } from './server'
import { createStdioTransport } from './transports/stdio'

function createRegisteredServer() {
  return createConfiguredMcpServer({
    name: 'game-theory-analysis',
    version: '0.1.0',
    stdio_enabled: true,
    http_enabled: false,
    http_host: 'localhost',
    http_port: 3117,
  })
}

describe('MCP server shell', () => {
  beforeEach(() => {
    resetConversationStore()
    resetPipelineStore()
    resetPipelineRuntimeStore()
    resetMcpStore()
  })

  it('registers all 10 phase tools', () => {
    const { server } = createRegisteredServer()
    const phaseTools = [...server.tools.keys()].filter((name) => name.startsWith('run_phase_'))
    expect(phaseTools).toHaveLength(10)
  })

  it('returns a prerequisite error when phase 2 is called before phase 1', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{ success: boolean; error?: string }>(
      'run_phase_2_players',
      {},
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Phase 1/)
  })

  it('does not expose accept_proposal on the MCP surface', () => {
    const { server } = createRegisteredServer()
    expect(server.tools.has('accept_proposal')).toBe(false)
  })

  it('rejects removed no-op phase inputs at the tool boundary', () => {
    const { server } = createRegisteredServer()

    expect(
      server.tools.get('run_phase_1_grounding')?.inputSchema.safeParse({
        situation_description: 'State A vs State B sanctions bargaining',
        attachments: ['memo.pdf'],
      }).success,
    ).toBe(false)
    expect(
      server.tools.get('run_phase_3_baseline')?.inputSchema.safeParse({
        game_type_hints: ['signaling'],
      }).success,
    ).toBe(false)
    expect(
      server.tools.get('run_phase_4_history')?.inputSchema.safeParse({
        time_horizon: '10 years',
      }).success,
    ).toBe(false)
  })

  it('runs phase 1 grounding and returns pending proposals', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{
      success: boolean
      proposals: Array<{ id: string }>
    }>('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    expect(result.success).toBe(true)
    expect(result.proposals.length).toBeGreaterThan(0)
  })

  it('threads focus areas into the phase 1 grounding result', async () => {
    const { server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
      focus_areas: ['intel'],
    })

    const phaseResult = getPipelineState().phase_results[1] as GroundingResult | undefined
    expect(phaseResult?.coverage_assessment.gaps).toContain('intel')
  })

  it('blocks later phases until prior proposals are reviewed', async () => {
    const { server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    const result = await server.callTool<{ success: boolean; error?: string }>(
      'run_phase_2_players',
      {},
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pending review/i)
  })

  it('proposes an entity without mutating canonical state', async () => {
    const { appStore, server } = createRegisteredServer()
    const proposal = await server.callTool<{
      success: boolean
      data: { proposal_id: string }
    }>('propose_entity', {
      action: 'create',
      entity_type: 'player',
      data: {
        name: 'Entrant',
        type: 'organization',
        objectives: [],
        constraints: [],
      },
      rationale: 'Add the entrant as a proposed player.',
      phase: 2,
    })

    expect(proposal.success).toBe(true)
    expect(Object.keys(appStore.getState().canonical.players)).toHaveLength(0)
  })

  it('threads additional_context into phase 2 player identification', async () => {
    const { server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A bargaining with State B',
    })

    clearConversation()

    await server.callTool('run_phase_2_players', {
      additional_context: 'Cabinet faction has its own independent incentives.',
    })

    const phaseResult = getPipelineState().phase_results[2] as
      | PlayerIdentificationResult
      | undefined
    expect(
      phaseResult?.proposed_players.some((player) => player.role === 'internal'),
    ).toBe(true)
  })

  it('keeps the same analysis session when phase 1 is rerun with the same description', async () => {
    const { appStore, server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    appStore.getState().dispatch({
      kind: 'add_source',
      id: 'same_session_source',
      payload: {
        kind: 'manual',
        title: 'Keep me',
        captured_at: new Date().toISOString(),
        quality_rating: 'high',
      },
    })
    const initialAnalysisId = appStore.getState().eventLog.analysis_id

    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    expect(appStore.getState().eventLog.analysis_id).toBe(initialAnalysisId)
    expect(appStore.getState().canonical.sources.same_session_source).toBeDefined()
  })

  it('replaces the active analysis session when a new situation description is provided', async () => {
    const { appStore, context, server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    appStore.getState().dispatch({
      kind: 'add_source',
      id: 'stale_source',
      payload: {
        kind: 'manual',
        title: 'Old source',
        captured_at: new Date().toISOString(),
        quality_rating: 'medium',
      },
    })
    const initialAnalysisId = appStore.getState().eventLog.analysis_id

    await server.callTool('run_phase_1_grounding', {
      situation_description: 'Platform incumbent versus entrant pricing war',
    })

    expect(appStore.getState().eventLog.analysis_id).not.toBe(initialAnalysisId)
    expect(appStore.getState().eventLog.events).toHaveLength(0)
    expect(appStore.getState().canonical.sources.stale_source).toBeUndefined()
    expect(context.orchestrator.getState()?.event_description).toBe(
      'Platform incumbent versus entrant pricing war',
    )
  })

  it('starts and stops a real stdio-backed MCP server lifecycle', async () => {
    const { server } = createRegisteredServer()
    const stdin = new PassThrough()
    const stdout = new PassThrough()

    await startServer(server, createStdioTransport({ stdin, stdout }))
    expect(server.runtime).not.toBeNull()

    await stopServer(server)
    expect(server.runtime).toBeNull()
  })

  it('returns model summary counts and phase statuses', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{
      success: boolean
      data: {
        entity_counts: Record<string, number>
        phase_statuses: unknown[]
      }
    }>('get_model_summary', {})

    expect(result.success).toBe(true)
    expect(result.data.entity_counts.player).toBe(0)
    expect(result.data.phase_statuses).toHaveLength(10)
  })

  it('supports phase 5 revalidation status and approval actions', async () => {
    const { appStore, server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

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

    const event = Object.values(appStore.getState().canonical.revalidation_events)[0]
    if (!event) {
      throw new Error('Expected a revalidation event to exist.')
    }

    const status = await server.callTool<{
      success: boolean
      revalidation?: { pending_events: Array<{ id: string }> }
    }>('run_phase_5_revalidation', {
      action: 'status',
    })

    expect(status.success).toBe(true)
    expect(status.revalidation?.pending_events[0]?.id).toBe(event.id)

    const approved = await server.callTool<{
      success: boolean
      revalidation?: { active_rerun_cycle?: { event_id: string } | null }
    }>('run_phase_5_revalidation', {
      action: 'approve',
      event_id: event.id,
    })

    expect(approved.success).toBe(true)
    expect(approved.revalidation?.active_rerun_cycle?.event_id).toBe(event.id)

    const secondApproval = await server.callTool<{
      success: boolean
      error?: string
    }>('run_phase_5_revalidation', {
      action: 'approve',
      event_id: event.id,
    })

    expect(secondApproval.success).toBe(false)
    expect(secondApproval.error).toMatch(/No pending revalidation event found/i)
  })

  it('accepts Phase 6 subsection input and returns the structured formalization result summary', async () => {
    const { appStore, server } = createRegisteredServer()
    startPipelineAnalysis({
      analysisId: appStore.getState().eventLog.analysis_id,
      description: 'Negotiation with repeated signaling and private information',
      domain: 'geopolitical',
      classification: null,
    })
    updateAnalysisState((analysisState) => {
      if (!analysisState) {
        return analysisState
      }

      const phase_states = { ...analysisState.phase_states }
      for (let phase = 1; phase <= 5; phase += 1) {
        phase_states[phase] = {
          ...phase_states[phase],
          status: 'complete',
        }
      }

      return {
        ...analysisState,
        phase_states,
      }
    })

    appStore.getState().dispatch({
      kind: 'add_player',
      id: 'player_a',
      payload: {
        name: 'State A',
        type: 'state',
        objectives: [],
        constraints: [],
      },
    })
    appStore.getState().dispatch({
      kind: 'add_player',
      id: 'player_b',
      payload: {
        name: 'State B',
        type: 'state',
        objectives: [],
        constraints: [],
      },
    })
    appStore.getState().dispatch({
      kind: 'add_game',
      id: 'game_1',
      payload: {
        name: 'Baseline game',
        description: 'Accepted baseline',
        semantic_labels: ['bargaining', 'signaling'],
        players: ['player_a', 'player_b'],
        status: 'active',
        formalizations: ['formalization_base'],
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
        assumptions: [],
        strategies: {
          player_a: ['Escalate', 'Hold'],
          player_b: ['Resist', 'Accommodate'],
        },
        payoff_cells: [],
      } as Omit<NormalFormModel, 'id'>,
    })

    const result = await server.callTool<{
      success: boolean
      summary: string
      warnings: string[]
    }>('run_phase_6_formalization', {
      subsections: ['6a', '6b', '6c', '6f'],
    })

    expect(result.success).toBe(true)
    expect(result.summary).toMatch(/Phase 6/)
    expect(server.tools.get('run_phase_6_formalization')?.inputSchema.safeParse({
      subsections: ['6x'],
    }).success).toBe(false)
  })
})
