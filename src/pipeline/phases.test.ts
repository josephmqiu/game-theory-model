import { beforeEach, describe, expect, it } from 'vitest'

import { emptyCanonicalStore, type CanonicalStore } from '../types/canonical'
import type { AnalysisState, PhaseExecution } from '../types/analysis-pipeline'
import { runPhase1Grounding } from './phase-1-grounding'
import { runPhase2Players } from './phase-2-players'
import { runPhase6Formalization } from './phase-6-formalization'
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

function createPlayersCanonicalStore(): CanonicalStore {
  const now = new Date().toISOString()
  return {
    ...emptyCanonicalStore(),
    players: {
      player_a: {
        id: 'player_a',
        name: 'State A',
        type: 'state',
        role: 'primary',
        objectives: [{ label: 'Preserve leverage', weight: createEstimate(0.8, 'Primary objective') }],
        constraints: [{ label: 'Budget', type: 'resource', severity: 'hard' }],
      },
      player_b: {
        id: 'player_b',
        name: 'State B',
        type: 'state',
        role: 'primary',
        objectives: [{ label: 'Avoid escalation', weight: createEstimate(0.7, 'Primary objective') }],
        constraints: [{ label: 'Alliance commitments', type: 'diplomatic', severity: 'soft' }],
      },
    },
    games: {
      game_1: {
        id: 'game_1',
        name: 'Baseline game',
        description: 'Existing baseline game.',
        semantic_labels: ['bargaining'],
        players: ['player_a', 'player_b'],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: now,
        updated_at: now,
      },
    },
  }
}

function createPhase6CanonicalStore(includeSecondGame = false): CanonicalStore {
  const now = new Date().toISOString()
  const store = createPlayersCanonicalStore()

  store.games.game_1 = {
    ...store.games.game_1!,
    formalizations: ['formalization_base'],
    canonical_game_type: 'bargaining',
    move_order: 'simultaneous',
    semantic_labels: ['bargaining', 'signaling'],
  }
  store.formalizations.formalization_base = {
    id: 'formalization_base',
    game_id: 'game_1',
    kind: 'normal_form',
    purpose: 'explanatory',
    abstraction_level: 'minimal',
    assumptions: [],
    strategies: {
      player_a: ['Escalate', 'Hold'],
      player_b: ['Resist', 'Accommodate'],
    },
    payoff_cells: [
      {
        strategy_profile: { player_a: 'Escalate', player_b: 'Resist' },
        payoffs: {
          player_a: createEstimate(1, 'baseline'),
          player_b: createEstimate(3, 'baseline'),
        },
      },
      {
        strategy_profile: { player_a: 'Escalate', player_b: 'Accommodate' },
        payoffs: {
          player_a: createEstimate(4, 'baseline'),
          player_b: createEstimate(1, 'baseline'),
        },
      },
      {
        strategy_profile: { player_a: 'Hold', player_b: 'Resist' },
        payoffs: {
          player_a: createEstimate(2, 'baseline'),
          player_b: createEstimate(2, 'baseline'),
        },
      },
      {
        strategy_profile: { player_a: 'Hold', player_b: 'Accommodate' },
        payoffs: {
          player_a: createEstimate(3, 'baseline'),
          player_b: createEstimate(2, 'baseline'),
        },
      },
    ],
  }

  if (includeSecondGame) {
    store.games.game_2 = {
      id: 'game_2',
      name: 'Second theater',
      description: 'Parallel strategic theater.',
      semantic_labels: ['coordination'],
      players: ['player_a', 'player_b'],
      status: 'active',
      formalizations: [],
      coupling_links: [],
      key_assumptions: [],
      created_at: now,
      updated_at: now,
    }
  }

  return store
}

function createPhase4HistoryResult() {
  return {
    phase: 4 as const,
    status: {
      status: 'complete' as const,
      phase: 4,
      execution_id: 'phase_execution_4',
      retriable: true,
    },
    repeated_game_map: [],
    patterns_found: [
      {
        game_id: 'game_1',
        pattern_type: 'grim_trigger' as const,
        description: 'Repeated punishment pattern.',
        instances: [],
        impact_on_trust: 'lowers trust',
        impact_on_model: 'supports repeated-game framing',
      },
    ],
    trust_assessment: [],
    dynamic_inconsistency_risks: [],
    global_signaling_effects: ['Signals shape beliefs.'],
    baseline_recheck: {
      game_still_correct: true,
      revealed_repeated_not_oneshot: false,
      hidden_player_found: false,
      hidden_commitment_problem: false,
      hidden_type_uncertainty: true,
      cooperative_equilibria_eliminated: false,
      objective_function_changed: false,
      deterrence_compellence_reframed: false,
      revalidation_needed: false,
      revalidation_triggers: [],
    },
    proposals: [],
  }
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

  it('surfaces unmatched focus areas as phase 1 grounding gaps', () => {
    const output = runPhase1Grounding(
      {
        situation_description: 'State A vs State B sanctions bargaining',
        focus_areas: ['intel', 'timeline'],
      },
      {
        canonical: emptyCanonicalStore(),
        baseRevision: 0,
        phaseExecution: createExecution(1),
      },
    )

    expect(output.result.coverage_assessment.gaps).toEqual(['intel'])
  })

  it('adds an internal player proposal when internal agency is detected', () => {
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
    expect(output.proposals.every((proposal) =>
      proposal.commands.every((command) => command.kind !== 'trigger_revalidation'),
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

  it('builds historical trust/risk proposals while surfacing a revalidation-worthy baseline recheck', () => {
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
    expect(output.proposals.every((proposal) =>
      proposal.commands.every((command) => command.kind !== 'trigger_revalidation'),
    )).toBe(true)
  })

  it('reuses the accepted baseline formalization and adds complementary Phase 6 representations without mutating canonical state', () => {
    const canonical = createPhase6CanonicalStore()
    const originalFormalizations = Object.keys(canonical.formalizations)

    const output = runPhase6Formalization(
      undefined,
      {
        canonical,
        analysisState: createAnalysisState('Negotiation with repeated signaling and private information'),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {
          4: createPhase4HistoryResult(),
        },
      },
    )

    expect(output.formal_representations.reused_formalization_ids).toContain('formalization_base')
    expect(output.formal_representations.summaries.some((summary) => summary.kind === 'repeated')).toBe(true)
    expect(output.formal_representations.summaries.some((summary) => summary.kind === 'bayesian')).toBe(true)
    expect(output.communication_analysis.classifications.length).toBeGreaterThan(0)
    expect(output.proposals.some((proposal) => proposal.proposal_type === 'formalization')).toBe(true)
    expect(Object.keys(canonical.formalizations)).toEqual(originalFormalizations)
    expect(Object.keys(canonical.signal_classifications)).toHaveLength(0)
  })

  it('returns a partial Phase 6 result when requested subsections lack prerequisites', () => {
    const output = runPhase6Formalization(
      { subsections: ['6i'] },
      {
        canonical: createPhase6CanonicalStore(false),
        analysisState: createAnalysisState('Single-game bargaining case'),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    )

    expect(output.status.status).toBe('partial')
    expect(output.cross_game_effects).toBeNull()
    expect(output.subsection_statuses.find((entry) => entry.subsection === '6i')?.status).toBe('not_applicable')
  })

  it('creates cross-game-link proposals only when multiple games are active', () => {
    const output = runPhase6Formalization(
      { subsections: ['6i'] },
      {
        canonical: createPhase6CanonicalStore(true),
        analysisState: createAnalysisState('Parallel bargaining and alliance management games'),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    )

    expect(output.cross_game_effects?.effects).toHaveLength(1)
    expect(output.proposals.some((proposal) => proposal.proposal_type === 'cross_game_link')).toBe(true)
  })
})
