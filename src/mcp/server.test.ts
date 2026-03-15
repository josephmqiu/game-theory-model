import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it } from 'vitest'

import { registerProposalGroup, resetConversationStore, resetMcpStore, resetPipelineStore } from '../store'
import { createConfiguredMcpServer } from './bootstrap'
import { createStdioTransport } from './transports/stdio'
import { startServer, stopServer } from './server'

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
    resetMcpStore()
  })

  it('registers all 10 phase tools', () => {
    const { server } = createRegisteredServer()
    const phaseTools = [...server.tools.keys()].filter((name) => name.startsWith('run_phase_'))
    expect(phaseTools).toHaveLength(10)
  })

  it('returns a prerequisite error when phase 2 is called before phase 1', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{ success: boolean; error?: string }>('run_phase_2_players', {})
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Phase 1/)
  })

  it('runs phase 1 grounding and returns pending proposals', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{ success: boolean; proposals: Array<{ id: string }> }>('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })
    expect(result.success).toBe(true)
    expect(result.proposals.length).toBeGreaterThan(0)
  })

  it('blocks later phases until prior proposals are reviewed', async () => {
    const { server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    const result = await server.callTool<{ success: boolean; error?: string }>('run_phase_2_players', {})
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pending review/i)
  })

  it('proposes and accepts an entity through the command spine', async () => {
    const { appStore, server } = createRegisteredServer()
    const proposal = await server.callTool<{ success: boolean; data: { proposal_id: string } }>('propose_entity', {
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

    const accepted = await server.callTool<{ success: boolean }>('accept_proposal', {
      proposal_id: proposal.data.proposal_id,
    })

    expect(accepted.success).toBe(true)
    expect(Object.keys(appStore.getState().canonical.players)).toHaveLength(1)
  })

  it('accepts multiple proposals from the same revision snapshot sequentially', async () => {
    const { appStore, server } = createRegisteredServer()
    registerProposalGroup({
      phase: 1,
      content: 'Review both sources.',
      proposals: [
        {
          id: 'proposal_source_1',
          description: 'Add source one',
          phase: 1,
          phase_execution_id: 'phase_execution_1',
          base_revision: 0,
          status: 'pending',
          commands: [
            {
              kind: 'add_source',
              id: 'source_one',
              payload: {
                kind: 'manual',
                title: 'Source one',
                captured_at: new Date().toISOString(),
                quality_rating: 'high',
              },
            },
          ],
          entity_previews: [
            {
              entity_type: 'source',
              action: 'add',
              entity_id: 'source_one',
              preview: { title: 'Source one' },
              accepted: false,
            },
          ],
          conflicts: [],
        },
        {
          id: 'proposal_source_2',
          description: 'Add source two',
          phase: 1,
          phase_execution_id: 'phase_execution_1',
          base_revision: 0,
          status: 'pending',
          commands: [
            {
              kind: 'add_source',
              id: 'source_two',
              payload: {
                kind: 'manual',
                title: 'Source two',
                captured_at: new Date().toISOString(),
                quality_rating: 'medium',
              },
            },
          ],
          entity_previews: [
            {
              entity_type: 'source',
              action: 'add',
              entity_id: 'source_two',
              preview: { title: 'Source two' },
              accepted: false,
            },
          ],
          conflicts: [],
        },
      ],
    })

    const firstResult = await server.callTool<{ success: boolean }>('accept_proposal', {
      proposal_id: 'proposal_source_1',
    })
    const secondResult = await server.callTool<{ success: boolean }>('accept_proposal', {
      proposal_id: 'proposal_source_2',
    })

    expect(firstResult.success).toBe(true)
    expect(secondResult.success).toBe(true)
    expect(Object.keys(appStore.getState().canonical.sources)).toHaveLength(2)
  })

  it('restarts phase 1 when a new situation description is provided', async () => {
    const { context, server } = createRegisteredServer()
    await server.callTool('run_phase_1_grounding', {
      situation_description: 'State A vs State B sanctions bargaining',
    })

    await server.callTool('run_phase_1_grounding', {
      situation_description: 'Platform incumbent versus entrant pricing war',
    })

    expect(context.orchestrator.getState()?.event_description).toBe('Platform incumbent versus entrant pricing war')
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
    const result = await server.callTool<{ success: boolean; data: { entity_counts: Record<string, number>; phase_statuses: unknown[] } }>('get_model_summary', {})
    expect(result.success).toBe(true)
    expect(result.data.entity_counts.player).toBe(0)
    expect(result.data.phase_statuses).toHaveLength(10)
  })
})
