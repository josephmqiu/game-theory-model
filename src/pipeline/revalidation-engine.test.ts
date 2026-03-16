import { describe, expect, it } from 'vitest'

import { emptyCanonicalStore } from '../types/canonical'
import type {
  BaselineModelResult,
  FormalizationResult,
  HistoricalGameResult,
  PlayerIdentificationResult,
} from '../types/analysis-pipeline'
import { createRevalidationEngine } from './revalidation-engine'

function createEngine() {
  return createRevalidationEngine({
    getCanonical: () => emptyCanonicalStore(),
    getAnalysisState: () => null,
    getPendingApproval: () => null,
    clearPendingApproval: () => {},
    setActiveRerunCycle: () => {},
  })
}

describe('revalidation engine', () => {
  it('detects downstream rerun needs when phase 2 reveals internal agency', () => {
    const engine = createEngine()
    const result: PlayerIdentificationResult = {
      phase: 2,
      status: {
        status: 'complete',
        phase: 2,
        execution_id: 'phase_execution_2',
        retriable: true,
      },
      proposed_players: [
        {
          temp_id: 'player_internal',
          name: 'Internal Decision Cell',
          type: 'organization',
          role: 'internal',
          parent_player_id: 'player_a',
          objectives: [],
          priority_ordering: [],
          stability_indicator: 'shifting',
          non_standard_utility: null,
          information_state: { knows: [], doesnt_know: [], beliefs: [] },
          constraints: [],
          evidence_refs: [],
          confidence: { representation: 'cardinal_estimate', value: 0.7, confidence: 0.7, rationale: 'test', source_claims: [] },
          rationale: 'test',
        },
      ],
      information_asymmetry_map: { entries: [] },
      proposals: [],
    }

    const check = engine.checkTriggers(result, 2)
    expect(check.triggers_found).toContain('new_player_discovered')
    expect(check.recommendation).toBe('revalidate')
    expect(check.affected_phases).toEqual([3, 4])
  })

  it('detects repeated-game revalidation from phase 4 baseline recheck output', () => {
    const engine = createEngine()
    const result: HistoricalGameResult = {
      phase: 4,
      status: {
        status: 'complete',
        phase: 4,
        execution_id: 'phase_execution_4',
        retriable: true,
      },
      repeated_game_map: [],
      patterns_found: [],
      trust_assessment: [
        {
          assessor_player_id: 'player_a',
          target_player_id: 'player_b',
          level: 'low',
          posterior_belief: { representation: 'cardinal_estimate', value: 0.4, confidence: 0.4, rationale: 'test', source_claims: [] },
          evidence_refs: [],
          interaction_history_summary: 'test',
          driving_patterns: [],
          implications: 'test',
        },
      ],
      dynamic_inconsistency_risks: [
        {
          player_id: 'player_a',
          commitment_description: 'test',
          risk_type: 'leadership_transition',
          durability: 'fragile',
          evidence_refs: [],
          affected_games: [{ type: 'game', id: 'game_1' }],
          mitigation: 'test',
        },
      ],
      global_signaling_effects: [],
      baseline_recheck: {
        game_still_correct: false,
        revealed_repeated_not_oneshot: true,
        hidden_player_found: false,
        hidden_commitment_problem: true,
        hidden_type_uncertainty: false,
        cooperative_equilibria_eliminated: false,
        objective_function_changed: true,
        deterrence_compellence_reframed: false,
        revalidation_needed: true,
        revalidation_triggers: ['objective_function_changed'],
      },
      proposals: [],
    }

    const check = engine.checkTriggers(result, 4)
    expect(check.triggers_found).toContain('objective_function_changed')
    expect(check.recommendation).toBe('revalidate')
    expect(check.affected_phases).toEqual([3, 4])
    expect(check.affected_entities).toContainEqual({ type: 'game', id: 'game_1' })
  })

  it('captures all phase 3 trigger conditions when the baseline framing shifts in multiple ways', () => {
    const engine = createEngine()
    const result: BaselineModelResult = {
      phase: 3,
      status: {
        status: 'complete',
        phase: 3,
        execution_id: 'phase_execution_3',
        retriable: true,
      },
      proposed_games: [
        {
          temp_id: 'game_1',
          name: 'Baseline',
          description: 'Primary baseline game',
          canonical_type: 'bargaining',
          players: ['player_a', 'player_b'],
          move_order: 'sequential',
          time_structure: {
            event_time: 'weeks',
            model_time: 'turn',
            simulation_time: 'round',
          },
          deterrence_vs_compellence: 'both',
          institutional_constraints: [{
            category: 'international_institution',
            description: 'Treaty limits retaliation.',
            constraining_effect: 'Narrows the retaliation set.',
            evidence_refs: [],
          }],
          adjacent_game_test: 'changes_answer',
          evidence_refs: [],
          rationale: 'test',
          confidence: { representation: 'cardinal_estimate', value: 0.7, confidence: 0.7, rationale: 'test', source_claims: [] },
        },
        {
          temp_id: 'game_2',
          name: 'Outside option',
          description: 'Alternative reframing',
          canonical_type: 'signaling',
          players: ['player_a', 'player_b'],
          move_order: 'simultaneous',
          time_structure: {
            event_time: 'weeks',
            model_time: 'turn',
            simulation_time: 'round',
          },
          deterrence_vs_compellence: 'neither',
          institutional_constraints: [],
          adjacent_game_test: 'uncertain',
          evidence_refs: [],
          rationale: 'test',
          confidence: { representation: 'cardinal_estimate', value: 0.6, confidence: 0.6, rationale: 'test', source_claims: [] },
        },
      ],
      escalation_ladder: {
        game_id: 'game_1',
        rungs: [],
        escalation_dominance: null,
        stability_instability_paradox: true,
      },
      strategy_table: {
        players: ['player_a', 'player_b'],
        strategies: [],
        outcome_cells: null,
      },
      cross_game_constraint_table: null,
      model_gaps: ['The baseline model does not yet explain hidden reservation values.'],
      proposals: [],
    }

    const check = engine.checkTriggers(result, 3)
    expect(check.triggers_found).toEqual([
      'new_game_identified',
      'escalation_ladder_revision',
      'institutional_constraint_changed',
      'model_cannot_explain_fact',
    ])
    expect(check.recommendation).toBe('revalidate')
  })

  it('treats Phase 6 reframing triggers as rerun-worthy and monitor-only triggers as non-rerun signals', () => {
    const engine = createEngine()
    const revalidateResult: FormalizationResult = {
      phase: 6,
      status: {
        status: 'complete',
        phase: 6,
        execution_id: 'phase_execution_6',
        retriable: true,
      },
      subsections_run: ['6a'],
      subsection_statuses: [],
      formal_representations: {
        status: 'complete',
        summaries: [],
        reused_formalization_ids: [],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      },
      payoff_estimation: { status: 'not_applicable', updates: [], warnings: [] },
      baseline_equilibria: { status: 'not_applicable', analyses: [], warnings: [] },
      equilibrium_selection: { status: 'not_applicable', selections: [], warnings: [] },
      bargaining_dynamics: null,
      communication_analysis: { status: 'not_applicable', classifications: [], warnings: [] },
      option_value: null,
      behavioral_overlays: null,
      cross_game_effects: null,
      proposals: [],
      proposal_groups: [],
      workspace_previews: {},
      revalidation_signals: {
        triggers_found: ['game_reframed'],
        affected_entities: [{ type: 'game', id: 'game_1' }],
        description: 'Phase 6 reframed the baseline game.',
      },
    }

    const monitorResult: FormalizationResult = {
      ...revalidateResult,
      revalidation_signals: {
        triggers_found: ['new_cross_game_link', 'behavioral_overlay_changes_prediction'],
        affected_entities: [{ type: 'cross_game_link', id: 'link_1' }],
        description: 'Phase 6 produced monitor-only downstream signals.',
      },
    }

    const revalidateCheck = engine.checkTriggers(revalidateResult, 6)
    expect(revalidateCheck.recommendation).toBe('revalidate')
    expect(revalidateCheck.affected_phases).toEqual([3, 4, 6])

    const monitorCheck = engine.checkTriggers(monitorResult, 6)
    expect(monitorCheck.recommendation).toBe('monitor')
    expect(monitorCheck.affected_phases).toEqual([6])
  })
})
