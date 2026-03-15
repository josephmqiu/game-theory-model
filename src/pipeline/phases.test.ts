import { beforeEach, describe, expect, it } from 'vitest'

import { emptyCanonicalStore } from '../types/canonical'
import type { AnalysisState, PhaseExecution } from '../types/analysis-pipeline'
import { runPhase1Grounding } from './phase-1-grounding'
import { runPhase2Players } from './phase-2-players'
import { runPhase3Baseline, runPhase4History } from './phase-3-4'
import { classifySituation, createEntityId, createEstimate } from './helpers'

function createExecution(phase: number): PhaseExecution {
  return {
    id: createEntityId('phase_execution'),
    phase,
    pass_number: 1,
    provider_id: 'test',
    model_id: 'test-model',
    prompt_version_id: 'test',
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    status: 'running',
    error: null,
  }
}

function createAnalysisState(description: string): AnalysisState {
  return {
    id: createEntityId('analysis'),
    event_description: description,
    domain: classifySituation(description).domain,
    current_phase: null,
    phase_states: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const phase = index + 1
        return [phase, { phase, status: phase === 1 ? 'complete' : 'pending', pass_number: 1, started_at: null, completed_at: null, phase_execution_id: null }]
      }),
    ) as AnalysisState['phase_states'],
    pass_number: 1,
    status: 'running',
    started_at: new Date().toISOString(),
    completed_at: null,
    classification: classifySituation(description),
  }
}

function createPlayersCanonicalStore() {
  const store = emptyCanonicalStore()
  store.players.player_a = {
    id: 'player_a',
    name: 'State A',
    type: 'state',
    role: 'primary',
    objectives: [{ label: 'Preserve leverage', weight: createEstimate(0.8, 'Primary objective') }],
    constraints: [{ label: 'Budget', type: 'resource', severity: 'hard' }],
  }
  store.players.player_b = {
    id: 'player_b',
    name: 'State B',
    type: 'state',
    role: 'primary',
    objectives: [{ label: 'Avoid escalation', weight: createEstimate(0.7, 'Primary objective') }],
    constraints: [{ label: 'Alliance commitments', type: 'diplomatic', severity: 'soft' }],
  }
  store.games.game_1 = {
    id: 'game_1',
    name: 'Baseline game',
    description: 'Existing baseline game.',
    semantic_labels: ['bargaining'],
    players: ['player_a', 'player_b'],
    status: 'active',
    formalizations: [],
    coupling_links: [],
    key_assumptions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return store
}

describe('M5 phase runners', () => {
  beforeEach(() => {
    // No shared mutable runner state; this keeps test setup explicit.
  })

  it('builds phase 1 grounding proposals across all seven evidence categories', () => {
    const output = runPhase1Grounding(
      { situation_description: 'State A vs State B sanctions bargaining' },
      {
        canonical: emptyCanonicalStore(),
        baseRevision: 0,
        phaseExecution: createExecution(1),
      },
    )

    expect(output.classification.domain).toBe('geopolitical')
    expect(Object.keys(output.result.evidence_by_category)).toHaveLength(7)
    expect(output.result.proposals).toHaveLength(7)
  })

  it('adds an internal player proposal and revalidation trigger when internal agency is detected', () => {
    const output = runPhase2Players(
      { additional_context: 'Cabinet faction has its own independent incentives.' },
      {
        canonical: emptyCanonicalStore(),
        analysisState: createAnalysisState('State A cabinet bargaining with State B'),
        baseRevision: 0,
        phaseExecution: createExecution(2),
      },
    )

    expect(output.proposed_players.some((player) => player.role === 'internal')).toBe(true)
    expect(output.proposals.some((proposal) =>
      proposal.commands.some((command) => command.kind === 'trigger_revalidation'),
    )).toBe(true)
  })

  it('builds a minimal baseline game proposal with a formalization', () => {
    const output = runPhase3Baseline({
      canonical: createPlayersCanonicalStore(),
      analysisState: createAnalysisState('State A vs State B sanctions bargaining'),
      baseRevision: 0,
      phaseExecution: createExecution(3),
    })

    expect(output.status.status).toBe('complete')
    expect(output.proposed_games).toHaveLength(1)
    expect(output.proposals.some((proposal) => proposal.proposal_type === 'game')).toBe(true)
    expect(output.proposals.some((proposal) =>
      proposal.entity_previews.some((preview) => preview.entity_type === 'formalization'),
    )).toBe(true)
  })

  it('builds historical trust/risk proposals and requests revalidation for fragile commitment environments', () => {
    const output = runPhase4History({
      canonical: createPlayersCanonicalStore(),
      analysisState: createAnalysisState('Volatile election cycle raises sanctions bargaining risk'),
      baseRevision: 0,
      phaseExecution: createExecution(4),
    })

    expect(output.status.status).toBe('complete')
    expect(output.trust_assessment).toHaveLength(1)
    expect(output.dynamic_inconsistency_risks[0]?.durability).toBe('fragile')
    expect(output.baseline_recheck.revalidation_needed).toBe(true)
    expect(output.proposals.some((proposal) =>
      proposal.commands.some((command) => command.kind === 'trigger_revalidation'),
    )).toBe(true)
  })
})
