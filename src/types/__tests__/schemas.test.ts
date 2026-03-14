import { describe, expect, it } from 'vitest'

import {
  STORE_KEY,
  assumptionSchema,
  bargainingFormalizationSchema,
  bayesianGameModelSchema,
  beliefModelSchema,
  canonicalStoreSchema,
  chanceEstimateSchema,
  claimSchema,
  coalitionModelSchema,
  coalitionOptionSchema,
  conditionRefSchema,
  constraintRefSchema,
  contradictionSchema,
  createEntityRef,
  crossGameLinkSchema,
  derivationEdgeSchema,
  emptyCanonicalStore,
  entityRefSchema,
  entityTypeSchema,
  estimateValueSchema,
  evolutionaryFormalizationSchema,
  extensiveFormModelSchema,
  forecastEstimateSchema,
  formalizationSchema,
  gameEdgeSchema,
  gameNodeSchema,
  inferenceSchema,
  informationSetSchema,
  latentFactorSchema,
  normalFormCellSchema,
  normalFormModelSchema,
  observationSchema,
  objectiveRefSchema,
  playerSchema,
  playerTypeSchema,
  playbookSchema,
  policyRefSchema,
  priorDistributionSchema,
  refKey,
  repeatedGameModelSchema,
  scenarioSchema,
  signalStructureSchema,
  solverReadinessSchema,
  sourceSchema,
  staleMarkerSchema,
  strategicGameSchema,
  type EntityType,
} from '../index'

const staleMarkers = [
  {
    reason: 'Evidence changed',
    stale_since: '2026-03-14T00:00:00Z',
    caused_by: { type: 'source', id: 'source_1' },
  },
  {
    reason: 'Assumption revised',
    stale_since: '2026-03-14T01:00:00Z',
    caused_by: { type: 'assumption', id: 'assumption_1' },
  },
] as const

const estimateValue = {
  representation: 'cardinal_estimate',
  value: 3,
  confidence: 0.8,
  rationale: 'Supported by recent reporting.',
  source_claims: ['claim_1'],
  assumptions: ['assumption_1'],
} as const

const forecastEstimate = {
  mode: 'conditional',
  value: 0.6,
  conditions: [{ kind: 'assumption_holds', ref_id: 'assumption_1', negated: false }],
  confidence: 0.7,
  rationale: 'Conditional on current bargaining dynamics.',
  source_claims: ['claim_1'],
  assumptions: ['assumption_1'],
} as const

const chanceEstimate = {
  value: 0.35,
  confidence: 0.65,
  rationale: 'Chance branch estimate.',
  source_claims: ['claim_1'],
  assumptions: ['assumption_1'],
} as const

const solverReadiness = {
  overall: 'usable_with_warnings',
  completeness_score: 0.75,
  confidence_floor: 0.4,
  blockers: ['Missing some payoff details'],
  warnings: ['Sensitivity should be reviewed'],
  supported_solvers: ['nash', 'dominance'],
} as const

const objectiveRef = {
  label: 'Preserve leverage',
  weight: estimateValue,
  description: 'Primary strategic objective.',
} as const

const constraintRef = {
  label: 'Budget pressure',
  type: 'resource',
  severity: 'hard',
  description: 'Domestic funding constraints.',
} as const

const beliefModel = {
  about_player_id: 'player_2',
  beliefs: [{ type_label: 'hardliner', probability: 0.6, confidence: 0.7 }],
} as const

const strategyTemplate = {
  label: 'Escalate sanctions',
  conditions: ['assumption_1'],
  actions: ['announce', 'enforce'],
  notes: 'Use only after consultation.',
} as const

const playerType = {
  label: 'hardliner',
  prior_probability: 0.6,
  description: 'Prefers confrontation.',
} as const

const priorDistribution = {
  player_id: 'player_2',
  types: [playerType],
  source_claims: ['claim_1'],
} as const

const signalStructure = {
  signals: [{ label: 'speech', type_label: 'hardliner', probability: 0.7 }],
} as const

const coalitionOption = {
  members: ['player_1', 'player_2'],
  payoff_allocation: {
    player_1: estimateValue,
    player_2: estimateValue,
  },
  stable: true,
} as const

const policyRef = {
  kind: 'heuristic',
  heuristic_id: 'tit-for-tat',
} as const

const strategicGame = {
  id: 'game_1',
  name: 'Sanctions bargaining',
  description: 'A stylized coercive bargaining game.',
  semantic_labels: ['coercive_bargaining', 'bargaining'],
  players: ['player_1', 'player_2'],
  status: 'active',
  formalizations: ['formalization_nf'],
  coupling_links: ['cross_game_link_1'],
  key_assumptions: ['assumption_1'],
  created_at: '2026-03-14T00:00:00Z',
  updated_at: '2026-03-14T00:00:00Z',
  stale_markers: staleMarkers,
} as const

const player = {
  id: 'player_1',
  name: 'State A',
  type: 'state',
  objectives: [objectiveRef],
  constraints: [constraintRef],
  beliefs: beliefModel,
  strategy_library: [strategyTemplate],
  risk_profile: estimateValue,
  reservation_utility: estimateValue,
  audience_costs: estimateValue,
  metadata: { description: 'Lead actor', aliases: ['A'] },
  stale_markers: staleMarkers,
} as const

const gameNode = {
  id: 'game_node_1',
  formalization_id: 'formalization_ef',
  actor: { kind: 'player', player_id: 'player_1' },
  type: 'decision',
  label: 'Choose response',
  description: 'State A chooses its next move.',
  information_set_id: 'iset_1',
  available_actions: ['hold', 'escalate'],
  claims: ['claim_1'],
  inferences: ['inference_1'],
  assumptions: ['assumption_1'],
  model_time_index: 1,
  stale_markers: staleMarkers,
} as const

const terminalNode = {
  id: 'game_node_terminal',
  formalization_id: 'formalization_ef',
  actor: { kind: 'nature' },
  type: 'terminal',
  label: 'Outcome',
  terminal_payoffs: {
    player_1: estimateValue,
    player_2: estimateValue,
  },
} as const

const gameEdge = {
  id: 'game_edge_1',
  formalization_id: 'formalization_ef',
  from: 'game_node_1',
  to: 'game_node_terminal',
  label: 'Escalate',
  action_id: 'action_1',
  choice_forecast: forecastEstimate,
  chance_estimate: chanceEstimate,
  payoff_delta: { player_1: estimateValue },
  triggers_cross_game_links: ['cross_game_link_1'],
  assumptions: ['assumption_1'],
  stale_markers: staleMarkers,
} as const

const source = {
  id: 'source_1',
  kind: 'report',
  url: 'https://example.com/report',
  title: 'Briefing',
  publisher: 'Analyst Desk',
  published_at: '2026-03-13T00:00:00Z',
  captured_at: '2026-03-14T00:00:00Z',
  snapshot_ref: 'sqlite://snapshots/source_1',
  quality_rating: 'high',
  notes: 'Primary source.',
  stale_markers: staleMarkers,
} as const

const observation = {
  id: 'observation_1',
  source_id: 'source_1',
  text: 'Officials signaled willingness to negotiate.',
  quote_span: 'p.4',
  captured_at: '2026-03-14T00:00:00Z',
  stale_markers: staleMarkers,
} as const

const claim = {
  id: 'claim_1',
  statement: 'State A prefers leverage over immediate compromise.',
  based_on: ['observation_1'],
  confidence: 0.72,
  freshness: 'current',
  contested_by: ['claim_2'],
  stale_markers: staleMarkers,
} as const

const inference = {
  id: 'inference_1',
  statement: 'State A is unlikely to concede in round one.',
  derived_from: ['claim_1'],
  confidence: 0.69,
  rationale: 'Derived from bargaining posture.',
  stale_markers: staleMarkers,
} as const

const assumption = {
  id: 'assumption_1',
  statement: 'Domestic audience costs remain high.',
  type: 'behavioral',
  supported_by: ['claim_1'],
  contradicted_by: ['claim_2'],
  sensitivity: 'high',
  confidence: 0.66,
  stale_markers: staleMarkers,
} as const

const contradiction = {
  id: 'contradiction_1',
  left_ref: 'claim_1',
  right_ref: 'claim_2',
  description: 'Competing interpretations of the same briefing.',
  resolution_status: 'open',
  notes: 'Needs follow-up.',
  stale_markers: staleMarkers,
} as const

const derivationEdge = {
  id: 'derivation_1',
  from_ref: 'claim_1',
  to_ref: 'inference_1',
  relation: 'infers',
  stale_markers: staleMarkers,
} as const

const latentFactor = {
  id: 'latent_factor_1',
  name: 'Elite cohesion',
  description: 'Internal alignment among hardliners.',
  states: [{ label: 'high', probability: 0.5, confidence: 0.6 }],
  affects: ['formalization_nf'],
  source_claims: ['claim_1'],
  assumptions: ['assumption_1'],
  stale_markers: staleMarkers,
} as const

const crossGameLink = {
  id: 'cross_game_link_1',
  source_game_id: 'game_1',
  target_game_id: 'game_2',
  trigger_ref: 'game_edge_1',
  effect_type: 'payoff_shift',
  target_ref: 'formalization_nf',
  target_player_id: 'player_1',
  magnitude: estimateValue,
  conditions: [{ kind: 'scenario_active', ref_id: 'scenario_1', negated: false }],
  rationale: 'Escalation shifts outside options.',
  source_claims: ['claim_1'],
  assumptions: ['assumption_1'],
  mode_override: 'sum',
  priority: 'high',
  stale_markers: staleMarkers,
} as const

const scenario = {
  id: 'scenario_1',
  name: 'Escalation path',
  formalization_id: 'formalization_ef',
  path: ['game_node_1', 'game_edge_1', 'game_node_terminal'],
  probability_model: 'dependency_aware',
  estimated_probability: forecastEstimate,
  key_assumptions: ['assumption_1'],
  key_latent_factors: ['latent_factor_1'],
  invalidators: ['contradiction_1'],
  narrative: 'A high-pressure escalation sequence.',
  stale_markers: staleMarkers,
} as const

const playbook = {
  id: 'playbook_1',
  name: 'Pressure response',
  formalization_id: 'formalization_ef',
  derived_from_scenario: 'scenario_1',
  role_assignments: { player_1: policyRef },
  notes: 'Fallback branch.',
  stale_markers: staleMarkers,
} as const

const baseFormalization = {
  id: 'formalization_nf',
  game_id: 'game_1',
  purpose: 'computational',
  abstraction_level: 'medium',
  assumptions: ['assumption_1'],
  readiness_cache: solverReadiness,
  notes: 'Working model.',
} as const

const normalFormModel = {
  ...baseFormalization,
  kind: 'normal_form',
  strategies: {
    player_1: ['Escalate', 'Hold'],
    player_2: ['Concede', 'Resist'],
  },
  payoff_cells: [
    {
      strategy_profile: { player_1: 'Escalate', player_2: 'Resist' },
      payoffs: { player_1: estimateValue, player_2: estimateValue },
    },
  ],
} as const

const extensiveFormModel = {
  ...baseFormalization,
  id: 'formalization_ef',
  kind: 'extensive_form',
  root_node_id: 'game_node_1',
  information_sets: [
    {
      id: 'iset_1',
      player_id: 'player_1',
      node_ids: ['game_node_1', 'game_node_2'],
      beliefs: { game_node_1: 0.5, game_node_2: 0.5 },
      belief_rationale: 'Symmetric uncertainty.',
    },
  ],
} as const

const repeatedGameModel = {
  ...baseFormalization,
  id: 'formalization_rep',
  kind: 'repeated',
  stage_formalization_id: 'formalization_nf',
  horizon: 'indefinite',
  discount_factors: {
    player_1: { type: 'exponential', delta: estimateValue },
    player_2: { type: 'quasi_hyperbolic', delta: estimateValue, beta: estimateValue },
  },
  equilibrium_selection: {
    criterion: 'grim_trigger',
  },
} as const

const bayesianGameModel = {
  ...baseFormalization,
  id: 'formalization_bay',
  kind: 'bayesian',
  player_types: {
    player_2: [playerType],
  },
  priors: [priorDistribution],
  signal_structure: signalStructure,
} as const

const coalitionModel = {
  ...baseFormalization,
  id: 'formalization_coal',
  kind: 'coalition',
  agenda_setters: ['player_1'],
  coalition_options: [coalitionOption],
  solution_concept: {
    kind: 'core',
    characteristic_function: {
      'player_1,player_2': estimateValue,
    },
    threat_points: {
      player_1: estimateValue,
      player_2: estimateValue,
    },
  },
} as const

const bargainingFormalization = {
  ...baseFormalization,
  id: 'formalization_bar',
  kind: 'bargaining',
  protocol: 'alternating_offers',
  parties: ['player_1', 'player_2'],
  outside_options: { player_1: estimateValue, player_2: estimateValue },
  discount_factors: { player_1: estimateValue, player_2: estimateValue },
  surplus: estimateValue,
  deadline: {
    rounds: estimateValue,
    pressure_model: 'fixed_cost',
  },
  first_mover: 'player_1',
  commitment_power: { player_1: estimateValue },
} as const

const evolutionaryFormalization = {
  ...baseFormalization,
  id: 'formalization_evo',
  kind: 'evolutionary',
  strategy_types: [
    { id: 'hawk', label: 'Hawk' },
    { id: 'dove', label: 'Dove' },
  ],
  fitness_matrix: {
    hawk: { hawk: estimateValue, dove: estimateValue },
    dove: { hawk: estimateValue, dove: estimateValue },
  },
  initial_distribution: { hawk: 0.4, dove: 0.6 },
  dynamics: 'replicator',
  population_size: { kind: 'infinite' },
  mutation_rate: estimateValue,
} as const

const validFormalizations = [
  normalFormModel,
  extensiveFormModel,
  repeatedGameModel,
  bayesianGameModel,
  coalitionModel,
  bargainingFormalization,
  evolutionaryFormalization,
] as const

const canonicalStore = {
  games: { [strategicGame.id]: strategicGame },
  formalizations: { [normalFormModel.id]: normalFormModel },
  players: { [player.id]: player },
  nodes: { [gameNode.id]: gameNode, [terminalNode.id]: terminalNode },
  edges: { [gameEdge.id]: gameEdge },
  sources: { [source.id]: source },
  observations: { [observation.id]: observation },
  claims: { [claim.id]: claim },
  inferences: { [inference.id]: inference },
  assumptions: { [assumption.id]: assumption },
  contradictions: { [contradiction.id]: contradiction },
  derivations: { [derivationEdge.id]: derivationEdge },
  latent_factors: { [latentFactor.id]: latentFactor },
  cross_game_links: { [crossGameLink.id]: crossGameLink },
  scenarios: { [scenario.id]: scenario },
  playbooks: { [playbook.id]: playbook },
}

describe('session 1.1 foundation contracts', () => {
  it('maps every entity type through STORE_KEY to CanonicalStore keys', () => {
    const store = emptyCanonicalStore()
    const entityTypeOptions = entityTypeSchema.options as readonly EntityType[]

    expect(entityTypeOptions).toHaveLength(16)
    expect(Object.keys(STORE_KEY)).toHaveLength(16)

    for (const entityType of entityTypeOptions) {
      const key = STORE_KEY[entityType]
      expect(key).toBeDefined()
      expect(key in store).toBe(true)
    }
  })

  it('creates fresh empty canonical stores', () => {
    const first = emptyCanonicalStore()
    const second = emptyCanonicalStore()

    expect(Object.keys(first)).toHaveLength(16)
    for (const value of Object.values(first)) {
      expect(value).toEqual({})
    }
    expect(first).not.toBe(second)
    expect(first.games).not.toBe(second.games)
  })

  it('creates and formats entity refs', () => {
    const ref = createEntityRef('claim', 'claim_1')

    expect(Object.isFrozen(ref)).toBe(true)
    expect(refKey(ref)).toBe('claim:claim_1')
  })

  it('accepts all formalization variants and rejects missing kind', () => {
    for (const fixture of validFormalizations) {
      expect(formalizationSchema.safeParse(fixture).success).toBe(true)
    }

    const malformed = { ...normalFormModel }
    delete (malformed as Partial<typeof malformed>).kind

    expect(formalizationSchema.safeParse(malformed).success).toBe(false)
  })

  it('rejects bare estimate-like objects without rationale and confidence', () => {
    expect(
      estimateValueSchema.safeParse({
        representation: 'cardinal_estimate',
        value: 4,
        source_claims: ['claim_1'],
      }).success,
    ).toBe(false)
  })

  it('validates stale_markers as arrays and preserves multiple markers on entities', () => {
    expect(staleMarkerSchema.array().safeParse(staleMarkers).success).toBe(true)

    const parsedGame = strategicGameSchema.parse(strategicGame)
    expect(parsedGame.stale_markers).toHaveLength(2)
    expect(Array.isArray(parsedGame.stale_markers)).toBe(true)
  })

  it('validates a populated canonical store fixture', () => {
    expect(canonicalStoreSchema.safeParse(canonicalStore).success).toBe(true)
  })

  it('requires target_player_id for targeted cross-game effect types', () => {
    const invalid = { ...crossGameLink }
    delete (invalid as Partial<typeof invalid>).target_player_id

    const result = crossGameLinkSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid information set belief totals and foreign node ids', () => {
    const invalid = {
      ...extensiveFormModel.information_sets[0],
      beliefs: {
        game_node_1: 0.7,
        game_node_3: 0.1,
      },
    }

    const result = informationSetSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid evolutionary distributions and incomplete fitness matrices', () => {
    const invalid = {
      ...evolutionaryFormalization,
      initial_distribution: { hawk: 0.9, dove: 0.2 },
      fitness_matrix: {
        hawk: { hawk: estimateValue },
      },
    }

    const result = evolutionaryFormalizationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates representative good fixtures and rejects malformed ones across schemas', () => {
    const cases = [
      {
        schema: entityTypeSchema,
        valid: 'claim',
        invalid: 'not_an_entity',
      },
      {
        schema: entityRefSchema,
        valid: { type: 'claim', id: 'claim_1' },
        invalid: { type: 'claim', id: '' },
      },
      {
        schema: conditionRefSchema,
        valid: { kind: 'custom', ref_id: 'ref_1', negated: false },
        invalid: { kind: 'wrong', ref_id: 'ref_1', negated: false },
      },
      {
        schema: estimateValueSchema,
        valid: estimateValue,
        invalid: { ...estimateValue, confidence: 1.5 },
      },
      {
        schema: forecastEstimateSchema,
        valid: forecastEstimate,
        invalid: { ...forecastEstimate, confidence: -0.1 },
      },
      {
        schema: chanceEstimateSchema,
        valid: chanceEstimate,
        invalid: { ...chanceEstimate, confidence: 2 },
      },
      {
        schema: objectiveRefSchema,
        valid: objectiveRef,
        invalid: { ...objectiveRef, label: '' },
      },
      {
        schema: constraintRefSchema,
        valid: constraintRef,
        invalid: { ...constraintRef, severity: 'medium' },
      },
      {
        schema: beliefModelSchema,
        valid: beliefModel,
        invalid: {
          ...beliefModel,
          beliefs: [{ type_label: 'hardliner', probability: 0.6, confidence: 1.1 }],
        },
      },
      {
        schema: normalFormCellSchema,
        valid: normalFormModel.payoff_cells[0],
        invalid: { ...normalFormModel.payoff_cells[0], payoffs: { player_1: 3 } },
      },
      {
        schema: playerTypeSchema,
        valid: playerType,
        invalid: { ...playerType, prior_probability: -0.1 },
      },
      {
        schema: priorDistributionSchema,
        valid: priorDistribution,
        invalid: { ...priorDistribution, player_id: '' },
      },
      {
        schema: signalStructureSchema,
        valid: signalStructure,
        invalid: { signals: [{ label: 'speech', type_label: 'hardliner', probability: 2 }] },
      },
      {
        schema: coalitionOptionSchema,
        valid: coalitionOption,
        invalid: { ...coalitionOption, members: [] },
      },
      {
        schema: policyRefSchema,
        valid: policyRef,
        invalid: { kind: 'heuristic', heuristic_id: '' },
      },
      {
        schema: solverReadinessSchema,
        valid: solverReadiness,
        invalid: { ...solverReadiness, supported_solvers: ['unsupported_solver'] },
      },
      {
        schema: strategicGameSchema,
        valid: strategicGame,
        invalid: { ...strategicGame, status: 'draft' },
      },
      {
        schema: playerSchema,
        valid: player,
        invalid: { ...player, type: 'company' },
      },
      {
        schema: gameNodeSchema,
        valid: gameNode,
        invalid: { ...gameNode, actor: { kind: 'player' } },
      },
      {
        schema: gameEdgeSchema,
        valid: gameEdge,
        invalid: { ...gameEdge, label: '' },
      },
      {
        schema: sourceSchema,
        valid: source,
        invalid: { ...source, kind: 'memo' },
      },
      {
        schema: observationSchema,
        valid: observation,
        invalid: { ...observation, text: '' },
      },
      {
        schema: claimSchema,
        valid: claim,
        invalid: { ...claim, confidence: -0.1 },
      },
      {
        schema: inferenceSchema,
        valid: inference,
        invalid: { ...inference, rationale: '' },
      },
      {
        schema: assumptionSchema,
        valid: assumption,
        invalid: { ...assumption, sensitivity: 'urgent' },
      },
      {
        schema: contradictionSchema,
        valid: contradiction,
        invalid: { ...contradiction, resolution_status: 'closed' },
      },
      {
        schema: derivationEdgeSchema,
        valid: derivationEdge,
        invalid: { ...derivationEdge, relation: 'causes' },
      },
      {
        schema: latentFactorSchema,
        valid: latentFactor,
        invalid: {
          ...latentFactor,
          states: [{ label: 'high', probability: 2, confidence: 0.6 }],
        },
      },
      {
        schema: crossGameLinkSchema,
        valid: crossGameLink,
        invalid: { ...crossGameLink, priority: 'urgent' },
      },
      {
        schema: scenarioSchema,
        valid: scenario,
        invalid: { ...scenario, probability_model: 'numeric' },
      },
      {
        schema: playbookSchema,
        valid: playbook,
        invalid: { ...playbook, role_assignments: { player_1: { kind: 'robot' } } },
      },
      {
        schema: normalFormModelSchema,
        valid: normalFormModel,
        invalid: { ...normalFormModel, kind: 'matrix' },
      },
      {
        schema: extensiveFormModelSchema,
        valid: extensiveFormModel,
        invalid: { ...extensiveFormModel, root_node_id: '' },
      },
      {
        schema: repeatedGameModelSchema,
        valid: repeatedGameModel,
        invalid: { ...repeatedGameModel, horizon: 'open_ended' },
      },
      {
        schema: bayesianGameModelSchema,
        valid: bayesianGameModel,
        invalid: { ...bayesianGameModel, player_types: { player_2: [{ label: '' }] } },
      },
      {
        schema: coalitionModelSchema,
        valid: coalitionModel,
        invalid: { ...coalitionModel, agenda_setters: [''] },
      },
      {
        schema: bargainingFormalizationSchema,
        valid: bargainingFormalization,
        invalid: { ...bargainingFormalization, protocol: 'auction' },
      },
      {
        schema: evolutionaryFormalizationSchema,
        valid: evolutionaryFormalization,
        invalid: { ...evolutionaryFormalization, dynamics: 'selection' },
      },
    ] as const

    for (const testCase of cases) {
      expect(testCase.schema.safeParse(testCase.valid).success).toBe(true)
      expect(testCase.schema.safeParse(testCase.invalid).success).toBe(false)
    }
  })
})
