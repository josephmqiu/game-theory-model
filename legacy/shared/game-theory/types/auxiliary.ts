export const constraintSeverities = ['soft', 'hard'] as const

export const conditionKinds = [
  'outcome_reached',
  'assumption_holds',
  'scenario_active',
  'player_state',
  'custom',
] as const

export const policyKinds = ['human', 'ai', 'equilibrium', 'heuristic', 'scripted'] as const

export const formalizationPurposes = ['explanatory', 'computational', 'playout'] as const

export const abstractionLevels = ['minimal', 'moderate', 'detailed'] as const

export type NormalFormCell = import('zod').infer<typeof import('./schemas').normalFormCellSchema>
export type InformationSet = import('zod').infer<typeof import('./schemas').informationSetSchema>
export type PlayerType = import('zod').infer<typeof import('./schemas').playerTypeSchema>
export type PriorDistribution = import('zod').infer<typeof import('./schemas').priorDistributionSchema>
export type SignalStructure = import('zod').infer<typeof import('./schemas').signalStructureSchema>
export type ObjectiveRef = import('zod').infer<typeof import('./schemas').objectiveRefSchema>
export type ConstraintRef = import('zod').infer<typeof import('./schemas').constraintRefSchema>
export type BeliefModel = import('zod').infer<typeof import('./schemas').beliefModelSchema>
export type StrategyTemplate = import('zod').infer<typeof import('./schemas').strategyTemplateSchema>
export type CoalitionOption = import('zod').infer<typeof import('./schemas').coalitionOptionSchema>
export type ConditionRef = import('zod').infer<typeof import('./schemas').conditionRefSchema>
export type PolicyRef = import('zod').infer<typeof import('./schemas').policyRefSchema>
