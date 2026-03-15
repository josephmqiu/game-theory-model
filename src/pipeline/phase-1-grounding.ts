import type { CanonicalStore } from '../types'
import type {
  ClassificationResult,
  GroundingResult,
  PhaseExecution,
  PhaseResult,
} from '../types/analysis-pipeline'
import {
  buildEvidenceProposal,
  buildGroundingFinding,
  classifySituation,
  createConfidenceEstimate,
} from './helpers'

export interface Phase1Input {
  situation_description: string
  focus_areas?: string[]
}

export interface PhaseRunnerContext {
  canonical: CanonicalStore
  baseRevision: number
  phaseExecution: PhaseExecution
}

export interface Phase1RunnerOutput {
  classification: ClassificationResult
  result: GroundingResult
}

const groundingCategories = [
  'capabilities_resources',
  'economic_financial',
  'stakeholder_positions',
  'impact_affected_parties',
  'timeline',
  'actions_vs_statements',
  'rules_constraints',
] as const

export function runPhase1Grounding(
  input: Phase1Input,
  context: PhaseRunnerContext,
): Phase1RunnerOutput {
  const classification = classifySituation(input.situation_description)
  const phaseStatus: PhaseResult = {
    status: 'complete',
    phase: 1,
    execution_id: context.phaseExecution.id,
    retriable: true,
  }

  const evidence_by_category = Object.fromEntries(
    groundingCategories.map((category) => [
      category,
      [buildGroundingFinding(category, input.situation_description)],
    ]),
  ) as GroundingResult['evidence_by_category']

  const proposals = groundingCategories.map((category) =>
    buildEvidenceProposal({
      category,
      finding: evidence_by_category[category][0]!,
      phase: 1,
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
    }),
  )

  return {
    classification,
    result: {
      phase: 1,
      status: phaseStatus,
      evidence_by_category,
      coverage_assessment: {
        well_covered: groundingCategories.map((category) => category.replace(/_/g, ' ')),
        gaps: input.focus_areas
          ? input.focus_areas.filter(
              (focusArea) => !groundingCategories.some((category) => category.includes(focusArea)),
            )
          : [],
        overall_confidence: createConfidenceEstimate(
          'Coverage reflects heuristic grounding across all seven Phase 1 categories.',
          [],
          classification.game_theory_fit === 'strong' ? 0.78 : 0.64,
        ),
      },
      proposals,
    },
  }
}
