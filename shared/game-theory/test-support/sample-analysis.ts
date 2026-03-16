import type { AnalysisFileMeta } from '../types/file'
import type { CanonicalStore } from '../types/index'

export function createSampleAnalysisMeta(): AnalysisFileMeta {
  return {
    name: 'Sample strategic analysis',
    description: 'Fixture used for file format round-trip tests.',
    created_at: '2026-03-14T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
    metadata: {
      tags: ['fixture', 'roundtrip'],
      primary_event_dates: {
        start: '2026-03-01',
        end: '2026-03-31',
      },
    },
  }
}

export function createSampleCanonicalStore(): CanonicalStore {
  const staleMarkers = [
    {
      reason: 'Source updated',
      stale_since: '2026-03-14T02:00:00Z',
      caused_by: { type: 'source' as const, id: 'source_1' },
    },
  ] as const

  const estimateValue = {
    representation: 'cardinal_estimate' as const,
    value: 4,
    confidence: 0.82,
    rationale: 'Supported by the current evidence ladder.',
    source_claims: ['claim_1'],
    assumptions: ['assumption_1'],
  }

  const store: CanonicalStore = {
    games: {
      game_1: {
        id: 'game_1',
        name: 'Sanctions bargaining',
        description: 'A coercive bargaining game.',
        semantic_labels: ['coercive_bargaining', 'bargaining'],
        players: ['player_1', 'player_2'],
        status: 'active',
        formalizations: ['formalization_1'],
        coupling_links: ['cross_game_link_1'],
        key_assumptions: ['assumption_1'],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
        stale_markers: staleMarkers,
      },
    },
    formalizations: {
      formalization_1: {
        id: 'formalization_1',
        game_id: 'game_1',
        kind: 'normal_form',
        purpose: 'computational',
        abstraction_level: 'moderate',
        assumptions: ['assumption_1'],
        readiness_cache: {
          overall: 'usable_with_warnings',
          completeness_score: 0.7,
          confidence_floor: 0.5,
          blockers: ['Need a second payoff review'],
          warnings: ['Missing sensitivity analysis'],
          supported_solvers: ['nash', 'dominance'],
        },
        notes: 'Primary formalization.',
        strategies: {
          player_1: ['Escalate', 'Hold'],
          player_2: ['Concede', 'Resist'],
        },
        payoff_cells: [
          {
            strategy_profile: {
              player_1: 'Escalate',
              player_2: 'Resist',
            },
            payoffs: {
              player_1: estimateValue,
              player_2: estimateValue,
            },
          },
        ],
        stale_markers: staleMarkers,
      },
    },
    players: {
      player_1: {
        id: 'player_1',
        name: 'State A',
        type: 'state',
        objectives: [
          {
            label: 'Preserve leverage',
            weight: estimateValue,
          },
        ],
        constraints: [
          {
            label: 'Budget pressure',
            type: 'resource',
            severity: 'hard',
          },
        ],
        metadata: {
          aliases: ['A'],
        },
        stale_markers: staleMarkers,
      },
      player_2: {
        id: 'player_2',
        name: 'State B',
        type: 'state',
        objectives: [
          {
            label: 'Avoid domestic backlash',
            weight: estimateValue,
          },
        ],
        constraints: [
          {
            label: 'Alliance commitments',
            type: 'diplomatic',
            severity: 'soft',
          },
        ],
      },
    },
    nodes: {
      game_node_1: {
        id: 'game_node_1',
        formalization_id: 'formalization_1',
        actor: { kind: 'player', player_id: 'player_1' },
        type: 'decision',
        label: 'Choose response',
        available_actions: ['Escalate', 'Hold'],
        claims: ['claim_1'],
        inferences: ['inference_1'],
        assumptions: ['assumption_1'],
        stale_markers: staleMarkers,
      },
    },
    edges: {
      game_edge_1: {
        id: 'game_edge_1',
        formalization_id: 'formalization_1',
        from: 'game_node_1',
        to: 'game_node_1',
        label: 'Escalate',
        action_id: 'action_1',
        choice_forecast: {
          mode: 'conditional',
          value: 0.6,
          conditions: [{ kind: 'assumption_holds', ref_id: 'assumption_1', negated: false }],
          confidence: 0.75,
          rationale: 'Conditional on current bargaining posture.',
          source_claims: ['claim_1'],
          assumptions: ['assumption_1'],
        },
        assumptions: ['assumption_1'],
        stale_markers: staleMarkers,
      },
    },
    sources: {
      source_1: {
        id: 'source_1',
        kind: 'report',
        title: 'Analyst briefing',
        captured_at: '2026-03-14T00:00:00Z',
        quality_rating: 'high',
        stale_markers: staleMarkers,
      },
    },
    observations: {
      observation_1: {
        id: 'observation_1',
        source_id: 'source_1',
        text: 'Officials signaled willingness to negotiate.',
        captured_at: '2026-03-14T00:00:00Z',
        stale_markers: staleMarkers,
      },
    },
    claims: {
      claim_1: {
        id: 'claim_1',
        statement: 'State A prefers leverage over immediate compromise.',
        based_on: ['observation_1'],
        confidence: 0.73,
        stale_markers: staleMarkers,
      },
    },
    inferences: {
      inference_1: {
        id: 'inference_1',
        statement: 'State A is likely to resist first-round concessions.',
        derived_from: ['claim_1'],
        confidence: 0.68,
        rationale: 'Derived from the public bargaining posture.',
        stale_markers: staleMarkers,
      },
    },
    assumptions: {
      assumption_1: {
        id: 'assumption_1',
        statement: 'Domestic audience costs remain high.',
        type: 'behavioral',
        sensitivity: 'high',
        confidence: 0.66,
        supported_by: ['claim_1'],
        stale_markers: staleMarkers,
      },
    },
    contradictions: {
      contradiction_1: {
        id: 'contradiction_1',
        left_ref: 'claim_1',
        right_ref: 'claim_1',
        description: 'The public signal and analyst inference remain in tension.',
        resolution_status: 'open',
        stale_markers: staleMarkers,
      },
    },
    derivations: {
      derivation_1: {
        id: 'derivation_1',
        from_ref: 'claim_1',
        to_ref: 'inference_1',
        relation: 'infers',
        stale_markers: staleMarkers,
      },
    },
    latent_factors: {
      latent_factor_1: {
        id: 'latent_factor_1',
        name: 'Elite cohesion',
        states: [
          {
            label: 'high',
            probability: 0.5,
            confidence: 0.6,
          },
        ],
        affects: ['game_node_1'],
        source_claims: ['claim_1'],
        stale_markers: staleMarkers,
      },
    },
    cross_game_links: {
      cross_game_link_1: {
        id: 'cross_game_link_1',
        source_game_id: 'game_1',
        target_game_id: 'game_1',
        trigger_ref: 'game_edge_1',
        effect_type: 'payoff_shift',
        target_ref: 'formalization_1',
        target_player_id: 'player_1',
        magnitude: estimateValue,
        rationale: 'Escalation shifts leverage and expected payoffs.',
        source_claims: ['claim_1'],
        assumptions: ['assumption_1'],
        stale_markers: staleMarkers,
      },
    },
    scenarios: {
      scenario_1: {
        id: 'scenario_1',
        name: 'Escalation path',
        formalization_id: 'formalization_1',
        path: ['game_edge_1'],
        probability_model: 'dependency_aware',
        estimated_probability: {
          mode: 'point',
          value: 0.4,
          confidence: 0.7,
          rationale: 'Consistent with current negotiation dynamics.',
          source_claims: ['claim_1'],
          assumptions: ['assumption_1'],
        },
        key_assumptions: ['assumption_1'],
        invalidators: ['claim_1'],
        narrative: 'A high-pressure escalation branch.',
        stale_markers: staleMarkers,
      },
    },
    playbooks: {
      playbook_1: {
        id: 'playbook_1',
        name: 'Pressure response',
        formalization_id: 'formalization_1',
        derived_from_scenario: 'scenario_1',
        role_assignments: {
          player_1: {
            kind: 'heuristic',
            heuristic_id: 'tit-for-tat',
          },
        },
        notes: 'Fallback branch for rapid response.',
        stale_markers: staleMarkers,
      },
    },
    escalation_ladders: {},
    trust_assessments: {},
    eliminated_outcomes: {},
    signal_classifications: {},
    repeated_game_patterns: {},
    revalidation_events: {},
    dynamic_inconsistency_risks: {},
    cross_game_constraint_tables: {},
    central_theses: {},
    tail_risks: {},
  }

  return store
}
