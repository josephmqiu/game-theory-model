import type { EstimateValue } from '../../types/estimates'

export function createEmptyEstimate(): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value: 0,
    confidence: 0.5,
    rationale: 'Initial analyst estimate.',
    source_claims: [],
  }
}
