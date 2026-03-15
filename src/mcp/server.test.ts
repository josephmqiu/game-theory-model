import { beforeEach, describe, expect, it } from 'vitest'

import { createAppStore, resetConversationStore, resetMcpStore, resetPipelineStore } from '../store'
import { createToolContext } from './context'
import { createMcpServer } from './server'
import { registerModelTools } from './tools/model'
import { registerPhaseTools } from './tools/phases'
import { registerPlayTools } from './tools/play'
import { registerPrompts } from './prompts'
import { registerResources } from './resources'

function createRegisteredServer() {
  const appStore = createAppStore()
  const context = createToolContext(appStore)
  const server = createMcpServer({
    name: 'game-theory-analysis',
    version: '0.1.0',
    stdio_enabled: true,
    http_enabled: false,
    http_host: 'localhost',
    http_port: 3117,
  })

  registerPhaseTools(server, context)
  registerModelTools(server, context)
  registerPlayTools(server)
  registerResources(server, context)
  registerPrompts(server)

  return { appStore, context, server }
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

  it('returns model summary counts and phase statuses', async () => {
    const { server } = createRegisteredServer()
    const result = await server.callTool<{ success: boolean; data: { entity_counts: Record<string, number>; phase_statuses: unknown[] } }>('get_model_summary', {})
    expect(result.success).toBe(true)
    expect(result.data.entity_counts.player).toBe(0)
    expect(result.data.phase_statuses).toHaveLength(10)
  })
})
