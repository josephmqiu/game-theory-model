export const sourceKinds = ['web', 'pdf', 'article', 'report', 'transcript', 'manual'] as const

export const sourceQualityRatings = ['low', 'medium', 'high'] as const

export const assumptionTypes = [
  'structural',
  'behavioral',
  'payoff',
  'timing',
  'belief',
  'simplification',
] as const

export const assumptionSensitivities = ['low', 'medium', 'high', 'critical'] as const

export const contradictionResolutionStatuses = [
  'open',
  'partially_resolved',
  'resolved',
  'deferred',
] as const

export const derivationRelations = [
  'supports',
  'contradicts',
  'infers',
  'operationalizes',
  'parameterizes',
  'invalidates',
  'updates',
] as const

export const crossGameLinkEffectTypes = [
  'payoff_shift',
  'belief_update',
  'strategy_unlock',
  'strategy_remove',
  'timing_change',
  'player_entry',
  'player_exit',
  'resource_transfer',
  'commitment_change',
] as const

export const crossGameLinkTargetPlayerRequiredEffects = new Set<string>([
  'payoff_shift',
  'belief_update',
  'strategy_unlock',
  'strategy_remove',
  'resource_transfer',
])

export const crossGameLinkModeOverrides = [
  'sum',
  'max',
  'min',
  'override',
  'bayesian_update',
  'union',
  'intersection',
] as const

export const crossGameLinkPriorities = ['critical', 'high', 'normal', 'low'] as const

export const scenarioProbabilityModels = [
  'independent',
  'dependency_aware',
  'ordinal_only',
] as const

export type Source = import('zod').infer<typeof import('./schemas').sourceSchema>
export type Observation = import('zod').infer<typeof import('./schemas').observationSchema>
export type Claim = import('zod').infer<typeof import('./schemas').claimSchema>
export type Inference = import('zod').infer<typeof import('./schemas').inferenceSchema>
export type Assumption = import('zod').infer<typeof import('./schemas').assumptionSchema>
export type Contradiction = import('zod').infer<typeof import('./schemas').contradictionSchema>
export type DerivationEdge = import('zod').infer<typeof import('./schemas').derivationEdgeSchema>
export type LatentFactor = import('zod').infer<typeof import('./schemas').latentFactorSchema>
export type CrossGameLink = import('zod').infer<typeof import('./schemas').crossGameLinkSchema>
export type Scenario = import('zod').infer<typeof import('./schemas').scenarioSchema>
export type Playbook = import('zod').infer<typeof import('./schemas').playbookSchema>
