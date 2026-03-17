export const sourceKinds = ['web', 'pdf', 'article', 'report', 'transcript', 'manual'] as const

export const sourceQualityRatings = ['low', 'medium', 'high'] as const

export const assumptionTypes = [
  'behavioral',
  'capability',
  'structural',
  'institutional',
  'rationality',
  'information',
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
export type EscalationLadder = import('zod').infer<typeof import('./schemas').escalationLadderSchema>
export type EscalationRung = import('zod').infer<typeof import('./schemas').escalationRungSchema>
export type TrustAssessment = import('zod').infer<typeof import('./schemas').trustAssessmentSchema>
export type EliminatedOutcome = import('zod').infer<typeof import('./schemas').eliminatedOutcomeSchema>
export type SignalClassification = import('zod').infer<typeof import('./schemas').signalClassificationSchema>
export type RepeatedGamePattern = import('zod').infer<typeof import('./schemas').repeatedGamePatternSchema>
export type RevalidationEvent = import('zod').infer<typeof import('./schemas').revalidationEventSchema>
export type RevalidationTrigger = import('zod').infer<typeof import('./schemas').revalidationTriggerSchema>
export type DynamicInconsistencyRisk = import('zod').infer<typeof import('./schemas').dynamicInconsistencyRiskSchema>
export type CrossGameConstraintTable = import('zod').infer<typeof import('./schemas').crossGameConstraintTableSchema>
export type CentralThesis = import('zod').infer<typeof import('./schemas').centralThesisSchema>
export type TailRisk = import('zod').infer<typeof import('./schemas').tailRiskSchema>
