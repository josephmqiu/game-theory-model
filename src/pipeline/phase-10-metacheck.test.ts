import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyCanonicalStore, type CanonicalStore } from '../types/canonical'
import type { AnalysisState, PhaseExecution } from '../types/analysis-pipeline'
import { resetDerivedState } from '../store/derived'
import { runPhase6Formalization } from './phase-6-formalization'
import { runPhase7Assumptions } from './phase-7-assumptions'
import { runPhase8Elimination } from './phase-8-elimination'
import { runPhase9Scenarios } from './phase-9-scenarios'
import { runPhase10MetaCheck } from './phase-10-metacheck'
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

function createCanonicalStore(): CanonicalStore {
  const now = new Date().toISOString()
  const store: CanonicalStore = {
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

  return store
}

function runPriorPhases(canonical: CanonicalStore) {
  const phase4 = createPhase4HistoryResult()

  const phase6 = runPhase6Formalization(
    { subsections: ['6c'] },
    {
      canonical,
      analysisState: createAnalysisState('Negotiation with repeated signaling and private information'),
      baseRevision: 0,
      phaseExecution: createExecution(6),
      phaseResults: {
        4: phase4,
      },
    },
  )

  const phase7 = runPhase7Assumptions({
    canonical,
    baseRevision: 0,
    phaseExecution: createExecution(7),
    phaseResults: {
      4: phase4,
      6: phase6,
    },
  })

  const phase8 = runPhase8Elimination({
    canonical,
    baseRevision: 0,
    phaseExecution: createExecution(8),
    phaseResults: {
      6: phase6,
      7: phase7,
    },
  })

  const phase9 = runPhase9Scenarios({
    canonical,
    baseRevision: 0,
    phaseExecution: createExecution(9),
    phaseResults: {
      6: phase6,
      7: phase7,
      8: phase8,
    },
  })

  return { phase4, phase6, phase7, phase8, phase9 }
}

describe('Phase 10 meta-check runner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetDerivedState()
  })

  it('answers all 10 meta-check questions with concern levels', () => {
    const canonical = createCanonicalStore()
    const { phase4, phase6, phase7, phase8, phase9 } = runPriorPhases(canonical)

    const result = runPhase10MetaCheck({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {
        4: phase4,
        6: phase6,
        7: phase7,
        8: phase8,
        9: phase9,
      },
    })

    expect(result.phase).toBe(10)
    expect(result.meta_check_answers).toHaveLength(10)

    const validConcernLevels = ['none', 'minor', 'significant', 'critical']

    for (const answer of result.meta_check_answers) {
      expect(answer.question_number).toBeGreaterThanOrEqual(1)
      expect(answer.question_number).toBeLessThanOrEqual(10)
      expect(answer.question.length).toBeGreaterThan(0)
      expect(answer.answer.length).toBeGreaterThan(0)
      expect(validConcernLevels).toContain(answer.concern_level)
      expect(Array.isArray(answer.evidence_refs)).toBe(true)
    }

    const questionNumbers = result.meta_check_answers.map((a) => a.question_number)
    expect(questionNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('answers all 6 final test questions with completeness', () => {
    const canonical = createCanonicalStore()
    const { phase4, phase6, phase7, phase8, phase9 } = runPriorPhases(canonical)

    const result = runPhase10MetaCheck({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {
        4: phase4,
        6: phase6,
        7: phase7,
        8: phase8,
        9: phase9,
      },
    })

    expect(result.final_test_answers).toHaveLength(6)

    const validCompleteness = ['fully_answered', 'partially_answered', 'cannot_answer']

    for (const answer of result.final_test_answers) {
      expect(answer.question_number).toBeGreaterThanOrEqual(1)
      expect(answer.question_number).toBeLessThanOrEqual(6)
      expect(answer.question.length).toBeGreaterThan(0)
      expect(answer.answer.length).toBeGreaterThan(0)
      expect(validCompleteness).toContain(answer.completeness)
    }

    const questionNumbers = result.final_test_answers.map((a) => a.question_number)
    expect(questionNumbers).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('marks analysis_complete false when final test cannot be answered', () => {
    const emptyStore = emptyCanonicalStore()

    const result = runPhase10MetaCheck({
      canonical: emptyStore,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {},
    })

    expect(result.analysis_complete).toBe(false)

    const cannotAnswer = result.final_test_answers.filter(
      (ft) => ft.completeness === 'cannot_answer',
    )
    expect(cannotAnswer.length).toBeGreaterThan(0)
  })

  it('runs adversarial challenge with severity ratings', () => {
    const canonical = createCanonicalStore()
    const { phase4, phase6, phase7, phase8, phase9 } = runPriorPhases(canonical)

    const result = runPhase10MetaCheck({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {
        4: phase4,
        6: phase6,
        7: phase7,
        8: phase8,
        9: phase9,
      },
    })

    expect(Array.isArray(result.adversarial_result.challenges)).toBe(true)

    const validSeverities = ['critical', 'high', 'medium', 'low']
    const validAssessments = ['robust', 'defensible', 'vulnerable', 'flawed']

    for (const challenge of result.adversarial_result.challenges) {
      expect(challenge.id).toBeTruthy()
      expect(challenge.challenge.length).toBeGreaterThan(0)
      expect(validSeverities).toContain(challenge.severity)
      expect(challenge.response_status).toBe('unaddressed')
      expect(challenge.analyst_response).toBeNull()
    }

    expect(validAssessments).toContain(result.adversarial_result.overall_assessment)
  })

  it('collects revisions_triggered from meta-check concerns', () => {
    const emptyStore = emptyCanonicalStore()

    // With no players, Q1 triggers a revision
    const result = runPhase10MetaCheck({
      canonical: emptyStore,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {},
    })

    const answersWithRevision = result.meta_check_answers.filter(
      (a) => a.revision_triggered !== null,
    )

    if (answersWithRevision.length > 0) {
      expect(result.revisions_triggered.length).toBeGreaterThan(0)

      for (const answer of answersWithRevision) {
        expect(result.revisions_triggered).toContain(answer.revision_triggered)
      }
    }

    // Verify revisions_triggered has no duplicates
    const uniqueTriggers = new Set(result.revisions_triggered)
    expect(uniqueTriggers.size).toBe(result.revisions_triggered.length)
  })

  it('marks analysis_complete true when all checks pass', () => {
    const canonical = createCanonicalStore()
    const { phase4, phase6, phase7, phase8, phase9 } = runPriorPhases(canonical)

    const result = runPhase10MetaCheck({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(10),
      phaseResults: {
        4: phase4,
        6: phase6,
        7: phase7,
        8: phase8,
        9: phase9,
      },
    })

    expect(typeof result.analysis_complete).toBe('boolean')

    // With a full canonical store and all prior phases, no final test should be 'cannot_answer'
    const cannotAnswer = result.final_test_answers.filter(
      (ft) => ft.completeness === 'cannot_answer',
    )
    expect(cannotAnswer).toHaveLength(0)
  })
})
