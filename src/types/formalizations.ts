export const formalizationKinds = [
  'normal_form',
  'extensive_form',
  'repeated',
  'bayesian',
  'coalition',
  'bargaining',
  'evolutionary',
  'signaling',
] as const

export const discountModelTypes = ['exponential', 'quasi_hyperbolic'] as const

export const repeatedGameHorizons = ['finite', 'indefinite'] as const

export const repeatedEquilibriumCriteria = [
  'grim_trigger',
  'tit_for_tat',
  'pavlov',
  'renegotiation_proof',
  'custom',
] as const

export const coalitionSolutionConceptKinds = [
  'core',
  'shapley_value',
  'nucleolus',
  'nash_bargaining',
  'kalai_smorodinsky',
  'custom',
] as const

export const bargainingProtocols = [
  'alternating_offers',
  'nash_demand',
  'ultimatum',
  'custom',
] as const

export const bargainingPressureModels = [
  'fixed_cost',
  'shrinking_pie',
  'risk_of_breakdown',
] as const

export const evolutionaryDynamics = [
  'replicator',
  'best_response',
  'imitation',
  'custom',
] as const

export type BaseFormalization = import('zod').infer<typeof import('./schemas').baseFormalizationSchema>
export type DiscountModel = import('zod').infer<typeof import('./schemas').discountModelSchema>
export type NormalFormModel = import('zod').infer<typeof import('./schemas').normalFormModelSchema>
export type ExtensiveFormModel = import('zod').infer<typeof import('./schemas').extensiveFormModelSchema>
export type RepeatedGameModel = import('zod').infer<typeof import('./schemas').repeatedGameModelSchema>
export type BayesianGameModel = import('zod').infer<typeof import('./schemas').bayesianGameModelSchema>
export type CoalitionModel = import('zod').infer<typeof import('./schemas').coalitionModelSchema>
export type BargainingFormalization = import('zod').infer<typeof import('./schemas').bargainingFormalizationSchema>
export type EvolutionaryFormalization = import('zod').infer<typeof import('./schemas').evolutionaryFormalizationSchema>
export type Formalization = import('zod').infer<typeof import('./schemas').formalizationSchema>
