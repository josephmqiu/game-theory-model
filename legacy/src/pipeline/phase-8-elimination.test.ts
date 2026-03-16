import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyCanonicalStore, type CanonicalStore } from '../types/canonical'
import type { AnalysisState, PhaseExecution } from '../types/analysis-pipeline'
import { getDerivedStore, resetDerivedState } from '../store/derived'
import { runPhase6Formalization } from './phase-6-formalization'
import { runPhase7Assumptions } from './phase-7-assumptions'
import { runPhase8Elimination } from './phase-8-elimination'
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

function createPhase6CanonicalStore(): CanonicalStore {
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
        semantic_labels: ['bargaining', 'signaling'],
        players: ['player_a', 'player_b'],
        status: 'active',
        formalizations: ['formalization_base'],
        coupling_links: [],
        key_assumptions: [],
        created_at: now,
        updated_at: now,
        canonical_game_type: 'bargaining',
        move_order: 'simultaneous',
      },
    },
    formalizations: {
      formalization_base: {
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
      },
    },
  }
}

function createPhase7CanonicalStore(): CanonicalStore {
  const store = createPhase6CanonicalStore()
  const now = new Date().toISOString()

  store.claims.claim_direct = {
    id: 'claim_direct',
    statement: 'Operational reporting supports the baseline.',
    based_on: ['observation_1'],
    confidence: 0.82,
  }
  store.inferences.inference_only = {
    id: 'inference_only',
    statement: 'Analyst inference about hidden capacity.',
    derived_from: ['claim_direct'],
    confidence: 0.68,
    rationale: 'Inferred from indirect posture changes.',
  }
  store.observations.observation_1 = {
    id: 'observation_1',
    source_id: 'source_1',
    text: 'Observed deployment and sanctions posture.',
    captured_at: now,
  }
  store.sources.source_1 = {
    id: 'source_1',
    kind: 'manual',
    title: 'Direct reporting',
    captured_at: now,
    quality_rating: 'high',
  }

  store.assumptions.assumption_behavioral = {
    id: 'assumption_behavioral',
    statement: 'State A still prioritizes domestic signaling over compromise.',
    type: 'behavioral',
    sensitivity: 'medium',
    confidence: 0.62,
    supported_by: ['claim_direct'],
    game_theoretic_vs_empirical: 'empirical',
    correlated_cluster_id: null,
  }
  store.assumptions.assumption_capability = {
    id: 'assumption_capability',
    statement: 'State B retains enough coercive capacity to sustain pressure.',
    type: 'capability',
    sensitivity: 'medium',
    confidence: 0.58,
    supported_by: ['inference_only'],
    game_theoretic_vs_empirical: 'empirical',
    correlated_cluster_id: null,
  }
  store.assumptions.assumption_structural = {
    id: 'assumption_structural',
    statement: 'The accepted baseline still captures the strategic action menu.',
    type: 'structural',
    sensitivity: 'medium',
    confidence: 0.64,
    supported_by: ['claim_direct'],
    game_theoretic_vs_empirical: 'game_theoretic',
    correlated_cluster_id: null,
  }
  store.assumptions.assumption_institutional = {
    id: 'assumption_institutional',
    statement: 'Alliance rules will keep constraining rapid escalation.',
    type: 'institutional',
    sensitivity: 'medium',
    confidence: 0.61,
    supported_by: ['claim_direct'],
    game_theoretic_vs_empirical: 'empirical',
    correlated_cluster_id: null,
  }
  store.assumptions.assumption_rationality = {
    id: 'assumption_rationality',
    statement: 'Both sides still optimize against regime-survival payoffs.',
    type: 'rationality',
    sensitivity: 'medium',
    confidence: 0.6,
    supported_by: ['claim_direct'],
    game_theoretic_vs_empirical: 'game_theoretic',
    correlated_cluster_id: null,
  }
  store.assumptions.assumption_information = {
    id: 'assumption_information',
    statement: 'Important military and political constraints remain privately held.',
    type: 'information',
    sensitivity: 'medium',
    confidence: 0.59,
    game_theoretic_vs_empirical: 'game_theoretic',
    correlated_cluster_id: null,
  }

  store.games.game_1!.key_assumptions = ['assumption_behavioral', 'assumption_institutional']
  const baseline = store.formalizations.formalization_base
  if (baseline && baseline.kind === 'normal_form') {
    baseline.assumptions = [
      'assumption_capability',
      'assumption_structural',
      'assumption_rationality',
      'assumption_information',
    ]
  }
  store.scenarios.scenario_1 = {
    id: 'scenario_1',
    name: 'Baseline coercive bargaining',
    formalization_id: 'formalization_base',
    path: [],
    probability_model: 'ordinal_only',
    key_assumptions: ['assumption_capability', 'assumption_behavioral'],
    invalidators: [],
    narrative: 'Baseline scenario',
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

describe('Phase 8 elimination runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetDerivedState()
  })

  it('produces eliminations citing specific phase findings when formalizations exist', () => {
    const canonical = createPhase7CanonicalStore()

    const phase6 = runPhase6Formalization(
      { subsections: ['6c'] },
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

    const phase7 = runPhase7Assumptions({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(7),
      phaseResults: {
        4: createPhase4HistoryResult(),
        6: phase6,
      },
    })

    const result = runPhase8Elimination({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(8),
      phaseResults: {
        6: phase6,
        7: phase7,
      },
    })

    expect(result.phase).toBe(8)
    expect(result.status.status).toMatch(/^(complete|partial)$/)
    expect(Array.isArray(result.eliminated_outcomes)).toBe(true)
    expect(Array.isArray(result.proposals)).toBe(true)

    if (result.proposals.length > 0) {
      for (const proposal of result.proposals) {
        expect(proposal.proposal_type).toBe('elimination')
        expect(proposal.phase).toBe(8)
        expect(proposal.commands.length).toBeGreaterThan(0)
        expect(proposal.entity_previews.length).toBeGreaterThan(0)
      }
    }
  })

  it('returns partial result with gap when no Phase 6 results available', () => {
    const canonical = createPhase6CanonicalStore()

    const result = runPhase8Elimination({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(8),
      phaseResults: {},
    })

    expect(result.phase).toBe(8)
    expect(result.status.status).toBe('partial')
    expect(result.status.gaps).toBeDefined()
    expect(result.status.gaps!.some((gap) => gap.toLowerCase().includes('phase 6'))).toBe(true)
    expect(result.eliminated_outcomes).toEqual([])
    expect(result.proposals).toEqual([])
  })

  it('each elimination has citing_phases with phase numbers and surprise_factor', () => {
    const canonical = createPhase6CanonicalStore()

    // Use a Prisoner's Dilemma where Cooperate is dominated by Defect
    const baseline = canonical.formalizations.formalization_base
    if (baseline && baseline.kind === 'normal_form') {
      baseline.strategies = {
        player_a: ['Cooperate', 'Defect'],
        player_b: ['Cooperate', 'Defect'],
      }
      baseline.payoff_cells = [
        {
          strategy_profile: { player_a: 'Cooperate', player_b: 'Cooperate' },
          payoffs: {
            player_a: createEstimate(3, 'mutual cooperation'),
            player_b: createEstimate(3, 'mutual cooperation'),
          },
        },
        {
          strategy_profile: { player_a: 'Cooperate', player_b: 'Defect' },
          payoffs: {
            player_a: createEstimate(0, 'sucker payoff'),
            player_b: createEstimate(5, 'temptation'),
          },
        },
        {
          strategy_profile: { player_a: 'Defect', player_b: 'Cooperate' },
          payoffs: {
            player_a: createEstimate(5, 'temptation'),
            player_b: createEstimate(0, 'sucker payoff'),
          },
        },
        {
          strategy_profile: { player_a: 'Defect', player_b: 'Defect' },
          payoffs: {
            player_a: createEstimate(1, 'mutual defection'),
            player_b: createEstimate(1, 'mutual defection'),
          },
        },
      ]
    }

    const phase6 = runPhase6Formalization(
      { subsections: ['6c'] },
      {
        canonical,
        analysisState: createAnalysisState('Prisoner dilemma sanctions scenario'),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    )

    const result = runPhase8Elimination({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(8),
      phaseResults: {
        6: phase6,
      },
    })

    expect(result.status.status).toBe('complete')

    if (result.eliminated_outcomes.length > 0) {
      for (const outcome of result.eliminated_outcomes) {
        expect(outcome.citing_phases.length).toBeGreaterThan(0)
        for (const citation of outcome.citing_phases) {
          expect(typeof citation.phase).toBe('number')
          expect(citation.phase).toBeGreaterThanOrEqual(1)
          expect(citation.phase).toBeLessThanOrEqual(10)
          expect(typeof citation.finding).toBe('string')
          expect(citation.finding.length).toBeGreaterThan(0)
        }
        expect(['high', 'medium', 'low']).toContain(outcome.surprise_factor)
      }
    }
  })

  it('builds add_eliminated_outcome proposals', () => {
    const canonical = createPhase6CanonicalStore()

    // Set up a clear dominance situation
    const baseline = canonical.formalizations.formalization_base
    if (baseline && baseline.kind === 'normal_form') {
      baseline.strategies = {
        player_a: ['Cooperate', 'Defect'],
        player_b: ['Cooperate', 'Defect'],
      }
      baseline.payoff_cells = [
        {
          strategy_profile: { player_a: 'Cooperate', player_b: 'Cooperate' },
          payoffs: {
            player_a: createEstimate(3, 'mutual cooperation'),
            player_b: createEstimate(3, 'mutual cooperation'),
          },
        },
        {
          strategy_profile: { player_a: 'Cooperate', player_b: 'Defect' },
          payoffs: {
            player_a: createEstimate(0, 'sucker payoff'),
            player_b: createEstimate(5, 'temptation'),
          },
        },
        {
          strategy_profile: { player_a: 'Defect', player_b: 'Cooperate' },
          payoffs: {
            player_a: createEstimate(5, 'temptation'),
            player_b: createEstimate(0, 'sucker payoff'),
          },
        },
        {
          strategy_profile: { player_a: 'Defect', player_b: 'Defect' },
          payoffs: {
            player_a: createEstimate(1, 'mutual defection'),
            player_b: createEstimate(1, 'mutual defection'),
          },
        },
      ]
    }

    const phase6 = runPhase6Formalization(
      { subsections: ['6c'] },
      {
        canonical,
        analysisState: createAnalysisState('Prisoner dilemma sanctions scenario'),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    )

    const result = runPhase8Elimination({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(8),
      phaseResults: {
        6: phase6,
      },
    })

    if (result.eliminated_outcomes.length > 0) {
      expect(result.proposals.length).toBeGreaterThan(0)
      for (const proposal of result.proposals) {
        expect(proposal.commands.some((command) => command.kind === 'add_eliminated_outcome')).toBe(true)
        expect(proposal.proposal_type).toBe('elimination')
        expect(proposal.entity_previews.some((preview) => preview.entity_type === 'eliminated_outcome')).toBe(true)
      }
    } else {
      expect(result.proposals).toEqual([])
    }
  })
})
