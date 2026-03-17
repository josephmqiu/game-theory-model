export const estimateRepresentations = [
  'ordinal_rank',
  'interval_estimate',
  'cardinal_estimate',
] as const

export const forecastModes = ['point', 'range', 'conditional'] as const

export type EstimateValue = import('zod').infer<typeof import('./schemas').estimateValueSchema>
export type ForecastEstimate = import('zod').infer<typeof import('./schemas').forecastEstimateSchema>
export type ChanceEstimate = import('zod').infer<typeof import('./schemas').chanceEstimateSchema>
