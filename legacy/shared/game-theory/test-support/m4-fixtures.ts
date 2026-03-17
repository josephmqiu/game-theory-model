import { buildInverseIndex } from '../engine/inverse-index'
import { createEventLog } from '../engine/events'
import { emptyCanonicalStore } from '../types/canonical'
import type { CanonicalStore } from '../types/canonical'
import type { AnalysisFileMeta, LoadResult } from '../types/file'
import type { EstimateValue } from '../types/estimates'
import { storeToAnalysisFile } from '../utils/serialization'

export function createEstimate(
  value: number,
  overrides: Partial<EstimateValue> = {},
): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value,
    confidence: 0.8,
    rationale: 'Fixture estimate.',
    source_claims: [],
    assumptions: [],
    ...overrides,
  }
}

function baseMeta(): AnalysisFileMeta {
  return {
    name: 'M4 fixture',
    description: 'M4 fixture',
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    metadata: { tags: ['m4'] },
  }
}

export function createNormalFormStore(): CanonicalStore {
  const store = emptyCanonicalStore()
  store.games.game_1 = {
    id: 'game_1',
    name: 'Prisoners Dilemma',
    description: 'A 2x2 game.',
    semantic_labels: ['prisoners_dilemma'],
    players: ['player_1', 'player_2'],
    status: 'active',
    formalizations: ['formalization_1'],
    coupling_links: [],
    key_assumptions: ['assumption_1'],
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  }
  store.players.player_1 = {
    id: 'player_1',
    name: 'Player 1',
    type: 'state',
    objectives: [{ label: 'Win', weight: createEstimate(1) }],
    constraints: [{ label: 'Cost', type: 'resource', severity: 'soft' }],
  }
  store.players.player_2 = {
    id: 'player_2',
    name: 'Player 2',
    type: 'state',
    objectives: [{ label: 'Win', weight: createEstimate(1) }],
    constraints: [{ label: 'Cost', type: 'resource', severity: 'soft' }],
  }
  store.assumptions.assumption_1 = {
    id: 'assumption_1',
    statement: 'Both players are rational.',
    type: 'rationality',
    sensitivity: 'medium',
    confidence: 0.7,
    supported_by: ['claim_1'],
  }
  store.claims.claim_1 = {
    id: 'claim_1',
    statement: 'Rational play dominates.',
    based_on: [],
    confidence: 0.8,
  }
  store.formalizations.formalization_1 = {
    id: 'formalization_1',
    game_id: 'game_1',
    kind: 'normal_form',
    purpose: 'computational',
    abstraction_level: 'moderate',
    assumptions: ['assumption_1'],
    strategies: {
      player_1: ['Cooperate', 'Defect'],
      player_2: ['Cooperate', 'Defect'],
    },
    payoff_cells: [
      {
        strategy_profile: { player_1: 'Cooperate', player_2: 'Cooperate' },
        payoffs: { player_1: createEstimate(3), player_2: createEstimate(3) },
      },
      {
        strategy_profile: { player_1: 'Cooperate', player_2: 'Defect' },
        payoffs: { player_1: createEstimate(0), player_2: createEstimate(5) },
      },
      {
        strategy_profile: { player_1: 'Defect', player_2: 'Cooperate' },
        payoffs: { player_1: createEstimate(5), player_2: createEstimate(0) },
      },
      {
        strategy_profile: { player_1: 'Defect', player_2: 'Defect' },
        payoffs: { player_1: createEstimate(1), player_2: createEstimate(1) },
      },
    ],
  }
  return store
}

export function createExtensiveFormStore(): CanonicalStore {
  const store = emptyCanonicalStore()
  store.games.game_1 = {
    id: 'game_1',
    name: 'Tree Game',
    description: 'A simple extensive-form game.',
    semantic_labels: ['coordination'],
    players: ['player_1'],
    status: 'active',
    formalizations: ['formalization_1'],
    coupling_links: [],
    key_assumptions: [],
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  }
  store.players.player_1 = {
    id: 'player_1',
    name: 'Player 1',
    type: 'state',
    objectives: [{ label: 'Win', weight: createEstimate(1) }],
    constraints: [{ label: 'Cost', type: 'resource', severity: 'soft' }],
  }
  store.formalizations.formalization_1 = {
    id: 'formalization_1',
    game_id: 'game_1',
    kind: 'extensive_form',
    purpose: 'computational',
    abstraction_level: 'moderate',
    assumptions: [],
    root_node_id: 'node_root',
    information_sets: [],
  }
  store.nodes.node_root = {
    id: 'node_root',
    formalization_id: 'formalization_1',
    actor: { kind: 'player', player_id: 'player_1' },
    type: 'decision',
    label: 'Choose',
    available_actions: ['Left', 'Right'],
  }
  store.nodes.node_left = {
    id: 'node_left',
    formalization_id: 'formalization_1',
    actor: { kind: 'player', player_id: 'player_1' },
    type: 'terminal',
    label: 'Left payoff',
    terminal_payoffs: { player_1: createEstimate(5) },
  }
  store.nodes.node_right = {
    id: 'node_right',
    formalization_id: 'formalization_1',
    actor: { kind: 'player', player_id: 'player_1' },
    type: 'terminal',
    label: 'Right payoff',
    terminal_payoffs: { player_1: createEstimate(2) },
  }
  store.edges.edge_left = {
    id: 'edge_left',
    formalization_id: 'formalization_1',
    from: 'node_root',
    to: 'node_left',
    label: 'Left',
    action_id: 'left',
  }
  store.edges.edge_right = {
    id: 'edge_right',
    formalization_id: 'formalization_1',
    from: 'node_root',
    to: 'node_right',
    label: 'Right',
    action_id: 'right',
  }
  return store
}

export function createBayesianStore(): CanonicalStore {
  const store = emptyCanonicalStore()
  store.games.game_1 = {
    id: 'game_1',
    name: 'Bayesian Game',
    description: 'A simple Bayesian game.',
    semantic_labels: ['signaling'],
    players: ['player_1'],
    status: 'active',
    formalizations: ['formalization_1'],
    coupling_links: [],
    key_assumptions: [],
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  }
  store.players.player_1 = {
    id: 'player_1',
    name: 'Player 1',
    type: 'state',
    objectives: [{ label: 'Survive', weight: createEstimate(1) }],
    constraints: [{ label: 'Cost', type: 'resource', severity: 'soft' }],
  }
  store.formalizations.formalization_1 = {
    id: 'formalization_1',
    game_id: 'game_1',
    kind: 'bayesian',
    purpose: 'computational',
    abstraction_level: 'moderate',
    assumptions: [],
    player_types: {
      player_1: [
        { label: 'tough', prior_probability: 0.5 },
        { label: 'soft', prior_probability: 0.5 },
      ],
    },
    priors: [
      {
        player_id: 'player_1',
        types: [
          { label: 'tough', prior_probability: 0.5 },
          { label: 'soft', prior_probability: 0.5 },
        ],
      },
    ],
    signal_structure: {
      signals: [
        { label: 'hawkish', type_label: 'tough', probability: 0.8 },
        { label: 'hawkish', type_label: 'soft', probability: 0.2 },
      ],
    },
  }
  return store
}

export function createSuccessLoadResult(store: CanonicalStore): Extract<LoadResult, { status: 'success' }> {
  return {
    status: 'success',
    path: null,
    analysis: storeToAnalysisFile(store, baseMeta()),
    store,
    derived: {
      inverse_index: buildInverseIndex(store),
    },
    integrity: {
      ok: true,
    },
    event_log: createEventLog('analysis_1'),
    migration: {
      from: 1,
      to: 1,
      steps_applied: [],
    },
  }
}
