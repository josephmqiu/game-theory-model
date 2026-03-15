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

export const formalizationSchema = z.union([
  normalFormModelSchema,
  extensiveFormModelSchema,
  repeatedGameModelSchema,
  bayesianGameModelSchema,
  coalitionModelSchema,
  bargainingFormalizationSchema,
  evolutionaryFormalizationSchema,
])

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

export const persistedFormalizationSchema = z.union([
  persistedNormalFormModelSchema,
  persistedExtensiveFormModelSchema,
  persistedRepeatedGameModelSchema,
  persistedBayesianGameModelSchema,
  persistedCoalitionModelSchema,
  persistedBargainingFormalizationSchema,
  persistedEvolutionaryFormalizationSchema,
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
  schema_version: z.literal(1),
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
  metadata: analysisFileMetadataSchema,
})
