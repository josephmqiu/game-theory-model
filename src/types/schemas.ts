import { z } from 'zod'

import {
  abstractionLevels,
  conditionKinds,
  constraintSeverities,
  formalizationPurposes,
  policyKinds,
} from './auxiliary'
import {
  actorKinds,
  entityTypes,
  gameNodeKinds,
  gameStatuses,
  playerKinds,
  semanticGameLabels,
  solverKinds,
  solverReadinessStates,
} from './canonical'
import {
  assumptionSensitivities,
  assumptionTypes,
  contradictionResolutionStatuses,
  crossGameLinkEffectTypes,
  crossGameLinkModeOverrides,
  crossGameLinkPriorities,
  crossGameLinkTargetPlayerRequiredEffects,
  derivationRelations,
  scenarioProbabilityModels,
  sourceKinds,
  sourceQualityRatings,
} from './evidence'
import { estimateRepresentations, forecastModes } from './estimates'
import {
  bargainingPressureModels,
  bargainingProtocols,
  coalitionSolutionConceptKinds,
  discountModelTypes,
  evolutionaryDynamics,
  formalizationKinds,
  repeatedEquilibriumCriteria,
  repeatedGameHorizons,
} from './formalizations'

const confidenceSchema = z.number().min(0).max(1)
const probabilitySchema = confidenceSchema

export const entityTypeSchema = z.enum(entityTypes)
export const semanticGameLabelSchema = z.enum(semanticGameLabels)
export const solverKindSchema = z.enum(solverKinds)
export const solverReadinessStateSchema = z.enum(solverReadinessStates)
export const gameStatusSchema = z.enum(gameStatuses)
export const actorKindSchema = z.enum(actorKinds)
export const playerKindSchema = z.enum(playerKinds)
export const gameNodeKindSchema = z.enum(gameNodeKinds)

export const entityRefSchema = z.object({
  type: entityTypeSchema,
  id: z.string().min(1),
})

export const staleMarkerSchema = z.object({
  reason: z.string().min(1),
  stale_since: z.string().min(1),
  caused_by: entityRefSchema,
})

export const baseEntitySchema = z.object({
  id: z.string().min(1),
  stale_markers: z.array(staleMarkerSchema).readonly().optional(),
})

export const conditionRefSchema = z.object({
  kind: z.enum(conditionKinds),
  ref_id: z.string().min(1),
  negated: z.boolean(),
})

export const estimateValueSchema = z.object({
  representation: z.enum(estimateRepresentations),
  value: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  ordinal_rank: z.number().int().optional(),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
  source_claims: z.array(z.string().min(1)),
  supporting_inferences: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
  latent_factors: z.array(z.string().min(1)).optional(),
})

export const forecastEstimateSchema = z.object({
  mode: z.enum(forecastModes),
  value: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  conditions: z.array(conditionRefSchema).optional(),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
  source_claims: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)),
  latent_factors: z.array(z.string().min(1)).optional(),
})

export const chanceEstimateSchema = z.object({
  value: z.number(),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
  source_claims: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
})

export const objectiveRefSchema = z.object({
  label: z.string().min(1),
  weight: estimateValueSchema,
  description: z.string().min(1).optional(),
})

export const constraintRefSchema = z.object({
  label: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(constraintSeverities),
  description: z.string().min(1).optional(),
})

export const beliefEntrySchema = z.object({
  type_label: z.string().min(1),
  probability: probabilitySchema,
  confidence: confidenceSchema,
})

export const beliefModelSchema = z.object({
  about_player_id: z.string().min(1),
  beliefs: z.array(beliefEntrySchema),
})

export const strategyTemplateSchema = z.object({
  label: z.string().min(1),
  conditions: z.array(z.string().min(1)).optional(),
  actions: z.array(z.string().min(1)),
  notes: z.string().min(1).optional(),
})

export const normalFormCellSchema = z.object({
  strategy_profile: z.record(z.string(), z.string().min(1)),
  payoffs: z.record(z.string(), estimateValueSchema),
})

export const informationSetSchema = z
  .object({
    id: z.string().min(1),
    player_id: z.string().min(1),
    node_ids: z.array(z.string().min(1)).min(1),
    beliefs: z.record(z.string(), z.number()).optional(),
    belief_rationale: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.beliefs) {
      return
    }

    let sum = 0
    for (const [nodeId, probability] of Object.entries(value.beliefs)) {
      if (!value.node_ids.includes(nodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['beliefs', nodeId],
          message: 'Belief keys must be members of node_ids.',
        })
      }
      sum += probability
    }

    if (Math.abs(sum - 1) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['beliefs'],
        message: 'Belief weights must sum to 1.0 ± 0.001.',
      })
    }
  })

export const playerTypeSchema = z.object({
  label: z.string().min(1),
  prior_probability: probabilitySchema,
  description: z.string().min(1).optional(),
})

export const priorDistributionSchema = z.object({
  player_id: z.string().min(1),
  types: z.array(playerTypeSchema),
  source_claims: z.array(z.string().min(1)).optional(),
})

export const signalSchema = z.object({
  label: z.string().min(1),
  type_label: z.string().min(1),
  probability: probabilitySchema,
})

export const signalStructureSchema = z.object({
  signals: z.array(signalSchema),
})

export const coalitionOptionSchema = z.object({
  members: z.array(z.string().min(1)).min(1),
  payoff_allocation: z.record(z.string(), estimateValueSchema),
  stable: z.boolean().optional(),
})

export const policyRefSchema = z.object({
  kind: z.enum(policyKinds),
  provider_id: z.string().min(1).optional(),
  model_id: z.string().min(1).optional(),
  prompt_version: z.string().min(1).optional(),
  heuristic_id: z.string().min(1).optional(),
})

export const solverReadinessSchema = z.object({
  overall: solverReadinessStateSchema,
  completeness_score: confidenceSchema,
  confidence_floor: confidenceSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  supported_solvers: z.array(solverKindSchema),
})

export const institutionalConstraintSchema = z.object({
  category: z.enum(['international_institution', 'domestic_legal', 'alliance_obligation', 'economic_institution', 'arms_control_framework', 'regulatory', 'other']),
  description: z.string(),
  constraining_effect: z.string(),
  evidence_refs: z.array(entityRefSchema),
})

export const strategicGameSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  description: z.string().min(1),
  semantic_labels: z.array(semanticGameLabelSchema),
  players: z.array(z.string().min(1)),
  status: gameStatusSchema,
  formalizations: z.array(z.string().min(1)),
  coupling_links: z.array(z.string().min(1)),
  key_assumptions: z.array(z.string().min(1)),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  canonical_game_type: z.enum(['chicken_brinkmanship', 'prisoners_dilemma', 'coordination', 'war_of_attrition', 'bargaining', 'signaling', 'bayesian_incomplete_info', 'coalition_alliance', 'domestic_political', 'economic_chokepoint', 'bertrand_competition', 'hotelling_differentiation', 'entry_deterrence', 'network_effects_platform']).optional(),
  move_order: z.enum(['simultaneous', 'sequential']).optional(),
  time_structure: z.object({ event_time: z.string(), model_time: z.string(), simulation_time: z.string() }).optional(),
  deterrence_vs_compellence: z.enum(['deterrence', 'compellence', 'both', 'neither']).nullable().optional(),
  institutional_constraints: z.array(institutionalConstraintSchema).optional(),
  model_gaps: z.array(z.string()).optional(),
  adjacent_game_test: z.enum(['changes_answer', 'does_not_change_answer', 'uncertain']).optional(),
})

export const actorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('player'),
    player_id: z.string().min(1),
  }),
  z.object({
    kind: z.literal('nature'),
  }),
  z.object({
    kind: z.literal('environment'),
  }),
  z.object({
    kind: z.literal('coalition_proxy'),
    coalition_id: z.string().min(1),
  }),
])

export const playerSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  type: playerKindSchema,
  objectives: z.array(objectiveRefSchema),
  constraints: z.array(constraintRefSchema),
  beliefs: beliefModelSchema.optional(),
  strategy_library: z.array(strategyTemplateSchema).optional(),
  risk_profile: estimateValueSchema.optional(),
  reservation_utility: estimateValueSchema.optional(),
  audience_costs: estimateValueSchema.optional(),
  metadata: z
    .object({
      description: z.string().min(1).optional(),
      aliases: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  role: z.enum(['primary', 'involuntary', 'background', 'internal', 'gatekeeper']).optional(),
  priority_ordering: z.array(z.object({ objective_index: z.number().int().min(0), priority: z.enum(['absolute', 'tradable']) })).optional(),
  stability_indicator: z.enum(['stable', 'shifting', 'unknown']).optional(),
  non_standard_utility: z.string().nullable().optional(),
  information_state: z.object({ knows: z.array(z.string()), doesnt_know: z.array(z.string()), beliefs: z.array(z.string()) }).optional(),
})

export const gameNodeSchema = baseEntitySchema.extend({
  formalization_id: z.string().min(1),
  actor: actorSchema,
  type: gameNodeKindSchema,
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  information_set_id: z.string().min(1).optional(),
  available_actions: z.array(z.string().min(1)).optional(),
  claims: z.array(z.string().min(1)).optional(),
  inferences: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
  terminal_payoffs: z.record(z.string(), estimateValueSchema).optional(),
  model_time_index: z.number().int().optional(),
})

export const gameEdgeSchema = baseEntitySchema.extend({
  formalization_id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1),
  action_id: z.string().min(1).optional(),
  choice_forecast: forecastEstimateSchema.optional(),
  chance_estimate: chanceEstimateSchema.optional(),
  payoff_delta: z.record(z.string(), estimateValueSchema).optional(),
  triggers_cross_game_links: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
})

export const sourceSchema = baseEntitySchema.extend({
  kind: z.enum(sourceKinds),
  url: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
  published_at: z.string().min(1).optional(),
  captured_at: z.string().min(1),
  snapshot_ref: z.string().min(1).optional(),
  quality_rating: z.enum(sourceQualityRatings).optional(),
  notes: z.string().min(1).optional(),
})

export const observationSchema = baseEntitySchema.extend({
  source_id: z.string().min(1),
  text: z.string().min(1),
  quote_span: z.string().min(1).optional(),
  captured_at: z.string().min(1),
})

export const claimSchema = baseEntitySchema.extend({
  statement: z.string().min(1),
  based_on: z.array(z.string().min(1)),
  confidence: confidenceSchema,
  freshness: z.string().min(1).optional(),
  contested_by: z.array(z.string().min(1)).optional(),
})

export const inferenceSchema = baseEntitySchema.extend({
  statement: z.string().min(1),
  derived_from: z.array(z.string().min(1)),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
})

export const assumptionSchema = baseEntitySchema.extend({
  statement: z.string().min(1),
  type: z.enum(assumptionTypes),
  supported_by: z.array(z.string().min(1)).optional(),
  contradicted_by: z.array(z.string().min(1)).optional(),
  sensitivity: z.enum(assumptionSensitivities),
  confidence: confidenceSchema,
  game_theoretic_vs_empirical: z.enum(['game_theoretic', 'empirical']).optional(),
  correlated_cluster_id: z.string().nullable().optional(),
})

export const contradictionSchema = baseEntitySchema.extend({
  left_ref: z.string().min(1),
  right_ref: z.string().min(1),
  description: z.string().min(1),
  resolution_status: z.enum(contradictionResolutionStatuses),
  notes: z.string().min(1).optional(),
})

export const derivationEdgeSchema = baseEntitySchema.extend({
  from_ref: z.string().min(1),
  to_ref: z.string().min(1),
  relation: z.enum(derivationRelations),
})

export const latentFactorStateSchema = z.object({
  label: z.string().min(1),
  probability: probabilitySchema,
  confidence: confidenceSchema,
})

export const latentFactorSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  states: z.array(latentFactorStateSchema),
  affects: z.array(z.string().min(1)),
  source_claims: z.array(z.string().min(1)).optional(),
  assumptions: z.array(z.string().min(1)).optional(),
})

export const crossGameLinkSchema = baseEntitySchema
  .extend({
    source_game_id: z.string().min(1),
    target_game_id: z.string().min(1),
    trigger_ref: z.string().min(1),
    effect_type: z.enum(crossGameLinkEffectTypes),
    target_ref: z.string().min(1),
    target_player_id: z.string().min(1).optional(),
    magnitude: estimateValueSchema.optional(),
    conditions: z.array(conditionRefSchema).optional(),
    rationale: z.string().min(1),
    source_claims: z.array(z.string().min(1)).optional(),
    assumptions: z.array(z.string().min(1)).optional(),
    mode_override: z.enum(crossGameLinkModeOverrides).optional(),
    priority: z.enum(crossGameLinkPriorities).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      crossGameLinkTargetPlayerRequiredEffects.has(value.effect_type) &&
      !value.target_player_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_player_id'],
        message: 'target_player_id is required for this effect_type.',
      })
    }
  })

export const scenarioSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  formalization_id: z.string().min(1),
  path: z.array(z.string().min(1)),
  probability_model: z.enum(scenarioProbabilityModels),
  estimated_probability: forecastEstimateSchema.optional(),
  key_assumptions: z.array(z.string().min(1)),
  key_latent_factors: z.array(z.string().min(1)).optional(),
  invalidators: z.array(z.string().min(1)),
  narrative: z.string().min(1),
  forecast_basis: z.enum(['equilibrium', 'discretionary', 'mixed']).optional(),
  invalidation_conditions: z.array(z.string()).optional(),
  model_basis: z.array(entityRefSchema).optional(),
  central_thesis_ref: entityRefSchema.nullable().optional(),
  cross_game_interactions: z.array(entityRefSchema).optional(),
})

export const playbookSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  formalization_id: z.string().min(1),
  derived_from_scenario: z.string().min(1).optional(),
  role_assignments: z.record(z.string(), policyRefSchema),
  notes: z.string().min(1).optional(),
})

export const baseFormalizationSchema = baseEntitySchema.extend({
  game_id: z.string().min(1),
  kind: z.enum(formalizationKinds),
  purpose: z.enum(formalizationPurposes),
  abstraction_level: z.enum(abstractionLevels),
  assumptions: z.array(z.string().min(1)),
  readiness_cache: solverReadinessSchema.optional(),
  notes: z.string().min(1).optional(),
})

export const discountModelSchema = z
  .object({
    type: z.enum(discountModelTypes),
    delta: estimateValueSchema,
    beta: estimateValueSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'quasi_hyperbolic' && !value.beta) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['beta'],
        message: 'beta is required for quasi_hyperbolic discount models.',
      })
    }
  })

export const normalFormModelSchema = baseFormalizationSchema.extend({
  kind: z.literal('normal_form'),
  strategies: z.record(z.string(), z.array(z.string().min(1))),
  payoff_cells: z.array(normalFormCellSchema),
})

export const extensiveFormModelSchema = baseFormalizationSchema.extend({
  kind: z.literal('extensive_form'),
  root_node_id: z.string().min(1),
  information_sets: z.array(informationSetSchema),
})

export const repeatedGameModelSchema = baseFormalizationSchema.extend({
  kind: z.literal('repeated'),
  stage_formalization_id: z.string().min(1),
  horizon: z.enum(repeatedGameHorizons),
  discount_factors: z.record(z.string(), discountModelSchema),
  equilibrium_selection: z
    .object({
      criterion: z.enum(repeatedEquilibriumCriteria),
      custom_description: z.string().min(1).optional(),
    })
    .optional(),
})

export const bayesianGameModelSchema = baseFormalizationSchema.extend({
  kind: z.literal('bayesian'),
  player_types: z.record(z.string(), z.array(playerTypeSchema)),
  priors: z.array(priorDistributionSchema),
  signal_structure: signalStructureSchema.optional(),
})

export const coalitionModelSchema = baseFormalizationSchema.extend({
  kind: z.literal('coalition'),
  agenda_setters: z.array(z.string().min(1)).optional(),
  coalition_options: z.array(coalitionOptionSchema),
  solution_concept: z
    .object({
      kind: z.enum(coalitionSolutionConceptKinds),
      characteristic_function: z.record(z.string(), estimateValueSchema).optional(),
      threat_points: z.record(z.string(), estimateValueSchema).optional(),
      custom_description: z.string().min(1).optional(),
    })
    .optional(),
})

export const bargainingFormalizationSchema = baseFormalizationSchema.extend({
  kind: z.literal('bargaining'),
  protocol: z.enum(bargainingProtocols),
  parties: z.array(z.string().min(1)).min(1),
  outside_options: z.record(z.string(), estimateValueSchema),
  discount_factors: z.record(z.string(), estimateValueSchema),
  surplus: estimateValueSchema,
  deadline: z
    .object({
      rounds: estimateValueSchema.optional(),
      pressure_model: z.enum(bargainingPressureModels).optional(),
      breakdown_probability: estimateValueSchema.optional(),
    })
    .optional(),
  first_mover: z.string().min(1).optional(),
  commitment_power: z.record(z.string(), estimateValueSchema).optional(),
})

export const strategyTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
})

export const populationSizeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('infinite') }),
  z.object({
    kind: z.literal('finite'),
    size: estimateValueSchema,
  }),
])

const evolutionaryFormalizationBaseSchema = baseFormalizationSchema.extend({
    kind: z.literal('evolutionary'),
    strategy_types: z.array(strategyTypeSchema).readonly(),
    fitness_matrix: z.record(z.string(), z.record(z.string(), estimateValueSchema)),
    initial_distribution: z.record(z.string(), z.number()),
    dynamics: z.enum(evolutionaryDynamics),
    population_size: populationSizeSchema,
    mutation_rate: estimateValueSchema.optional(),
  })

export const evolutionaryFormalizationSchema = evolutionaryFormalizationBaseSchema.superRefine(
  (value: z.infer<typeof evolutionaryFormalizationBaseSchema>, ctx) => {
    const strategyIds = value.strategy_types.map((strategy) => strategy.id)
    const distributionKeys = Object.keys(value.initial_distribution)
    const total = Object.values(value.initial_distribution).reduce(
      (sum, current) => sum + current,
      0,
    )

    if (Math.abs(total - 1) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['initial_distribution'],
        message: 'Initial distribution values must sum to 1.0 ± 0.001.',
      })
    }

    for (const key of distributionKeys) {
      if (!strategyIds.includes(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initial_distribution', key],
          message: 'Initial distribution keys must match strategy_types ids.',
        })
      }
    }

    for (const key of strategyIds) {
      if (!(key in value.initial_distribution)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initial_distribution', key],
          message: 'Initial distribution must include every strategy type id.',
        })
      }
    }

    const rowKeys = Object.keys(value.fitness_matrix)
    for (const rowKey of rowKeys) {
      if (!strategyIds.includes(rowKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fitness_matrix', rowKey],
          message: 'Fitness matrix rows must match strategy_types ids.',
        })
      }

      const columnKeys = Object.keys(value.fitness_matrix[rowKey] ?? {})
      for (const strategyId of strategyIds) {
        if (!(strategyId in (value.fitness_matrix[rowKey] ?? {}))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fitness_matrix', rowKey, strategyId],
            message: 'Fitness matrix must be complete for every row/column pair.',
          })
        }
      }

      for (const columnKey of columnKeys) {
        if (!strategyIds.includes(columnKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fitness_matrix', rowKey, columnKey],
            message: 'Fitness matrix columns must match strategy_types ids.',
          })
        }
      }
    }

    for (const strategyId of strategyIds) {
      if (!(strategyId in value.fitness_matrix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fitness_matrix', strategyId],
          message: 'Fitness matrix must include every strategy type id as a row.',
        })
      }
    }
  },
)

export const signalingFormalizationSchema = baseFormalizationSchema.extend({
  kind: z.literal('signaling'),
  sender_types: z.array(z.object({
    type_id: z.string().min(1),
    label: z.string().min(1),
    prior_probability: estimateValueSchema,
  })),
  messages: z.array(z.object({
    message_id: z.string().min(1),
    label: z.string().min(1),
    cost_by_type: z.record(z.string(), estimateValueSchema),
  })),
  receiver_actions: z.array(z.object({
    action_id: z.string().min(1),
    label: z.string().min(1),
  })),
  belief_updating: z.array(z.object({
    message_id: z.string().min(1),
    posterior_by_type: z.record(z.string(), estimateValueSchema),
  })).optional(),
  equilibrium_concept: z.enum(['separating', 'pooling', 'semi_separating']).nullable().optional(),
})

export const formalizationSchema = z.union([
  normalFormModelSchema,
  extensiveFormModelSchema,
  repeatedGameModelSchema,
  bayesianGameModelSchema,
  coalitionModelSchema,
  bargainingFormalizationSchema,
  evolutionaryFormalizationSchema,
  signalingFormalizationSchema,
])

export const escalationRungSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  player_attribution: entityRefSchema.nullable(),
  evidence_refs: z.array(entityRefSchema),
  reversible: z.boolean(),
  climbed: z.boolean(),
  strategic_implications: z.string(),
})

export const escalationLadderSchema = baseEntitySchema.extend({
  game_id: z.string().min(1),
  rungs: z.array(escalationRungSchema),
  current_rung_index: z.number().int().min(0).nullable(),
  escalation_dominance: entityRefSchema.nullable(),
  stability_instability_paradox: z.boolean(),
  notes: z.string().optional(),
})

export const trustAssessmentSchema = baseEntitySchema.extend({
  assessor_player_id: z.string().min(1),
  target_player_id: z.string().min(1),
  level: z.enum(['zero', 'low', 'moderate', 'high']),
  posterior_belief: estimateValueSchema,
  evidence_refs: z.array(entityRefSchema),
  interaction_history_summary: z.string(),
  driving_patterns: z.array(entityRefSchema),
  implications: z.string(),
})

export const eliminatedOutcomeSchema = baseEntitySchema.extend({
  outcome_description: z.string().min(1),
  elimination_reasoning: z.string().min(1),
  citing_phases: z.array(z.object({
    phase: z.number().int().min(1).max(10),
    finding: z.string().min(1),
  })),
  evidence_refs: z.array(entityRefSchema),
  surprise_factor: z.enum(['high', 'medium', 'low']),
  related_scenarios: z.array(entityRefSchema),
})

export const signalClassificationSchema = baseEntitySchema.extend({
  player_id: z.string().min(1),
  signal_description: z.string().min(1),
  classification: z.enum(['cheap_talk', 'costly_signal', 'audience_cost']),
  cost_description: z.string().nullable(),
  informativeness: z.enum(['high', 'medium', 'low', 'none']),
  informativeness_conditions: z.array(z.string()),
  evidence_refs: z.array(entityRefSchema),
  game_refs: z.array(entityRefSchema),
})

export const repeatedGamePatternSchema = baseEntitySchema.extend({
  game_id: z.string().min(1),
  pattern_type: z.enum([
    'defection_during_cooperation', 'tit_for_tat', 'grim_trigger',
    'selective_forgiveness', 'dual_track_deception', 'adverse_selection',
  ]),
  description: z.string(),
  instances: z.array(z.object({
    date: z.string(),
    description: z.string(),
    evidence_refs: z.array(entityRefSchema),
  })),
  impact_on_trust: z.string(),
  impact_on_model: z.string(),
})

export const revalidationTriggerSchema = z.enum([
  'new_player_discovered', 'objective_function_changed', 'new_game_identified',
  'game_reframed', 'repeated_dominates_oneshot', 'new_cross_game_link',
  'escalation_ladder_revision', 'institutional_constraint_changed',
  'critical_empirical_assumption_invalidated', 'model_cannot_explain_fact',
  'behavioral_overlay_changes_prediction',
])

export const revalidationEventSchema = baseEntitySchema.extend({
  trigger_condition: revalidationTriggerSchema,
  triggered_at: z.string(),
  source_phase: z.number().int().min(1).max(10),
  target_phases: z.array(z.number().int().min(1).max(10)),
  description: z.string(),
  entity_refs: z.array(entityRefSchema),
  resolution: z.enum(['pending', 'rerun_complete', 'dismissed']),
  pass_number: z.number().int().min(1),
})

export const dynamicInconsistencyRiskSchema = baseEntitySchema.extend({
  player_id: z.string().min(1),
  commitment_description: z.string(),
  risk_type: z.enum([
    'leadership_transition', 'electoral_cycle', 'executive_vs_legislative',
    'bureaucratic_reversal', 'other',
  ]),
  durability: z.enum(['fragile', 'moderate', 'durable']),
  evidence_refs: z.array(entityRefSchema),
  affected_games: z.array(entityRefSchema),
  mitigation: z.string().nullable(),
})

export const crossGameConstraintCellSchema = z.object({
  strategy_index: z.number().int().min(0),
  game_ref: entityRefSchema,
  status: z.enum(['succeeds', 'fails', 'uncertain']),
  notes: z.string(),
})

export const crossGameConstraintTableSchema = baseEntitySchema.extend({
  strategies: z.array(z.object({
    player_id: z.string().min(1),
    strategy_label: z.string().min(1),
  })),
  games: z.array(entityRefSchema),
  cells: z.array(crossGameConstraintCellSchema),
  trapped_players: z.array(entityRefSchema),
})

export const centralThesisSchema = baseEntitySchema.extend({
  statement: z.string().min(1),
  falsification_condition: z.string().min(1),
  evidence_refs: z.array(entityRefSchema),
  assumption_refs: z.array(entityRefSchema),
  scenario_refs: z.array(entityRefSchema),
  forecast_basis: z.enum(['equilibrium', 'discretionary', 'mixed']),
})

export const tailRiskSchema = baseEntitySchema.extend({
  event_description: z.string().min(1),
  probability: forecastEstimateSchema,
  trigger: z.string().min(1),
  why_unlikely: z.string(),
  consequences: z.string(),
  drift_toward: z.boolean(),
  drift_evidence: z.string().nullable(),
  related_scenarios: z.array(entityRefSchema),
  evidence_refs: z.array(entityRefSchema),
})

export const canonicalStoreSchema = z.object({
  games: z.record(z.string(), strategicGameSchema),
  formalizations: z.record(z.string(), formalizationSchema),
  players: z.record(z.string(), playerSchema),
  nodes: z.record(z.string(), gameNodeSchema),
  edges: z.record(z.string(), gameEdgeSchema),
  sources: z.record(z.string(), sourceSchema),
  observations: z.record(z.string(), observationSchema),
  claims: z.record(z.string(), claimSchema),
  inferences: z.record(z.string(), inferenceSchema),
  assumptions: z.record(z.string(), assumptionSchema),
  contradictions: z.record(z.string(), contradictionSchema),
  derivations: z.record(z.string(), derivationEdgeSchema),
  latent_factors: z.record(z.string(), latentFactorSchema),
  cross_game_links: z.record(z.string(), crossGameLinkSchema),
  scenarios: z.record(z.string(), scenarioSchema),
  playbooks: z.record(z.string(), playbookSchema),
  escalation_ladders: z.record(z.string(), escalationLadderSchema),
  trust_assessments: z.record(z.string(), trustAssessmentSchema),
  eliminated_outcomes: z.record(z.string(), eliminatedOutcomeSchema),
  signal_classifications: z.record(z.string(), signalClassificationSchema),
  repeated_game_patterns: z.record(z.string(), repeatedGamePatternSchema),
  revalidation_events: z.record(z.string(), revalidationEventSchema),
  dynamic_inconsistency_risks: z.record(z.string(), dynamicInconsistencyRiskSchema),
  cross_game_constraint_tables: z.record(z.string(), crossGameConstraintTableSchema),
  central_theses: z.record(z.string(), centralThesisSchema),
  tail_risks: z.record(z.string(), tailRiskSchema),
})

const persistedBaseFormalizationSchema = baseFormalizationSchema.omit({
  readiness_cache: true,
})

const persistedNormalFormModelSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('normal_form'),
  strategies: z.record(z.string(), z.array(z.string().min(1))),
  payoff_cells: z.array(normalFormCellSchema),
})

const persistedExtensiveFormModelSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('extensive_form'),
  root_node_id: z.string().min(1),
  information_sets: z.array(informationSetSchema),
})

const persistedRepeatedGameModelSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('repeated'),
  stage_formalization_id: z.string().min(1),
  horizon: z.enum(repeatedGameHorizons),
  discount_factors: z.record(z.string(), discountModelSchema),
  equilibrium_selection: z
    .object({
      criterion: z.enum(repeatedEquilibriumCriteria),
      custom_description: z.string().min(1).optional(),
    })
    .optional(),
})

const persistedBayesianGameModelSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('bayesian'),
  player_types: z.record(z.string(), z.array(playerTypeSchema)),
  priors: z.array(priorDistributionSchema),
  signal_structure: signalStructureSchema.optional(),
})

const persistedCoalitionModelSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('coalition'),
  agenda_setters: z.array(z.string().min(1)).optional(),
  coalition_options: z.array(coalitionOptionSchema),
  solution_concept: z
    .object({
      kind: z.enum(coalitionSolutionConceptKinds),
      characteristic_function: z.record(z.string(), estimateValueSchema).optional(),
      threat_points: z.record(z.string(), estimateValueSchema).optional(),
      custom_description: z.string().min(1).optional(),
    })
    .optional(),
})

const persistedBargainingFormalizationSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('bargaining'),
  protocol: z.enum(bargainingProtocols),
  parties: z.array(z.string().min(1)).min(1),
  outside_options: z.record(z.string(), estimateValueSchema),
  discount_factors: z.record(z.string(), estimateValueSchema),
  surplus: estimateValueSchema,
  deadline: z
    .object({
      rounds: estimateValueSchema.optional(),
      pressure_model: z.enum(bargainingPressureModels).optional(),
      breakdown_probability: estimateValueSchema.optional(),
    })
    .optional(),
  first_mover: z.string().min(1).optional(),
  commitment_power: z.record(z.string(), estimateValueSchema).optional(),
})

const persistedEvolutionaryFormalizationBaseSchema = persistedBaseFormalizationSchema.extend({
  kind: z.literal('evolutionary'),
  strategy_types: z.array(strategyTypeSchema).readonly(),
  fitness_matrix: z.record(z.string(), z.record(z.string(), estimateValueSchema)),
  initial_distribution: z.record(z.string(), z.number()),
  dynamics: z.enum(evolutionaryDynamics),
  population_size: populationSizeSchema,
  mutation_rate: estimateValueSchema.optional(),
})

const persistedEvolutionaryFormalizationSchema =
  persistedEvolutionaryFormalizationBaseSchema.superRefine(
    (value: z.infer<typeof persistedEvolutionaryFormalizationBaseSchema>, ctx) => {
      const strategyIds = value.strategy_types.map((strategy) => strategy.id)
      const distributionKeys = Object.keys(value.initial_distribution)
      const total = Object.values(value.initial_distribution).reduce(
        (sum, current) => sum + current,
        0,
      )

      if (Math.abs(total - 1) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initial_distribution'],
          message: 'Initial distribution values must sum to 1.0 ± 0.001.',
        })
      }

      for (const key of distributionKeys) {
        if (!strategyIds.includes(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['initial_distribution', key],
            message: 'Initial distribution keys must match strategy_types ids.',
          })
        }
      }

      for (const key of strategyIds) {
        if (!(key in value.initial_distribution)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['initial_distribution', key],
            message: 'Initial distribution must include every strategy type id.',
          })
        }
      }

      const rowKeys = Object.keys(value.fitness_matrix)
      for (const rowKey of rowKeys) {
        if (!strategyIds.includes(rowKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fitness_matrix', rowKey],
            message: 'Fitness matrix rows must match strategy_types ids.',
          })
        }

        const columnKeys = Object.keys(value.fitness_matrix[rowKey] ?? {})
        for (const strategyId of strategyIds) {
          if (!(strategyId in (value.fitness_matrix[rowKey] ?? {}))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fitness_matrix', rowKey, strategyId],
              message: 'Fitness matrix must be complete for every row/column pair.',
            })
          }
        }

        for (const columnKey of columnKeys) {
          if (!strategyIds.includes(columnKey)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['fitness_matrix', rowKey, columnKey],
              message: 'Fitness matrix columns must match strategy_types ids.',
            })
          }
        }
      }

      for (const strategyId of strategyIds) {
        if (!(strategyId in value.fitness_matrix)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fitness_matrix', strategyId],
            message: 'Fitness matrix must include every strategy type id as a row.',
          })
        }
      }
    },
  )

export const persistedSignalingFormalizationSchema = signalingFormalizationSchema.omit({ readiness_cache: true })

export const persistedFormalizationSchema = z.union([
  persistedNormalFormModelSchema,
  persistedExtensiveFormModelSchema,
  persistedRepeatedGameModelSchema,
  persistedBayesianGameModelSchema,
  persistedCoalitionModelSchema,
  persistedBargainingFormalizationSchema,
  persistedEvolutionaryFormalizationSchema,
  persistedSignalingFormalizationSchema,
])

export const analysisFileMetadataSchema = z.object({
  tags: z.array(z.string()),
  primary_event_dates: z
    .object({
      start: z.string().min(1).optional(),
      end: z.string().min(1).optional(),
    })
    .optional(),
})

export const analysisFileSchema = z.object({
  schema_version: z.literal(2),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  games: z.array(strategicGameSchema),
  formalizations: z.array(persistedFormalizationSchema),
  players: z.array(playerSchema),
  nodes: z.array(gameNodeSchema),
  edges: z.array(gameEdgeSchema),
  sources: z.array(sourceSchema),
  observations: z.array(observationSchema),
  claims: z.array(claimSchema),
  inferences: z.array(inferenceSchema),
  assumptions: z.array(assumptionSchema),
  contradictions: z.array(contradictionSchema),
  derivations: z.array(derivationEdgeSchema),
  latent_factors: z.array(latentFactorSchema),
  cross_game_links: z.array(crossGameLinkSchema),
  scenarios: z.array(scenarioSchema),
  playbooks: z.array(playbookSchema),
  escalation_ladders: z.array(escalationLadderSchema).default([]),
  trust_assessments: z.array(trustAssessmentSchema).default([]),
  eliminated_outcomes: z.array(eliminatedOutcomeSchema).default([]),
  signal_classifications: z.array(signalClassificationSchema).default([]),
  repeated_game_patterns: z.array(repeatedGamePatternSchema).default([]),
  revalidation_events: z.array(revalidationEventSchema).default([]),
  dynamic_inconsistency_risks: z.array(dynamicInconsistencyRiskSchema).default([]),
  cross_game_constraint_tables: z.array(crossGameConstraintTableSchema).default([]),
  central_theses: z.array(centralThesisSchema).default([]),
  tail_risks: z.array(tailRiskSchema).default([]),
  metadata: analysisFileMetadataSchema,
})
