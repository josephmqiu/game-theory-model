import type { Command } from '../engine/commands'
import type { CanonicalStore, EntityRef, EntityType } from '../types'
import type {
  ClassificationResult,
  EvidenceCategory,
  EvidenceProposal,
  GroundingFinding,
  ModelProposal,
  PhaseExecution,
} from '../types/analysis-pipeline'
import type { EntityPreview } from '../types/conversation'
import type { EstimateValue } from '../types/estimates'

export function createEstimate(
  value: number,
  rationale: string,
  sourceClaims: string[] = [],
  confidence = 0.7,
): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value,
    confidence,
    rationale,
    source_claims: sourceClaims,
  }
}

export function createConfidenceEstimate(
  rationale: string,
  sourceClaims: string[] = [],
  confidence = 0.7,
): EstimateValue {
  return createEstimate(confidence, rationale, sourceClaims, confidence)
}

export function createEntityId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createEntityPreview(
  entity_type: EntityType,
  action: EntityPreview['action'],
  entity_id: string | null,
  preview: Record<string, unknown>,
): EntityPreview {
  return {
    entity_type,
    action,
    entity_id,
    preview,
    accepted: false,
  }
}

export function asEntityRef(type: EntityType, id: string): EntityRef {
  return { type, id }
}

function lower(value: string): string {
  return value.toLowerCase()
}

export function descriptionContains(description: string, ...needles: string[]): boolean {
  const haystack = lower(description)
  return needles.some((needle) => haystack.includes(lower(needle)))
}

export function classifySituation(description: string): ClassificationResult {
  const domain = descriptionContains(description, 'sanction', 'military', 'border', 'state', 'alliance')
    ? 'geopolitical'
    : descriptionContains(description, 'market', 'pricing', 'saas', 'product', 'incumbent', 'platform')
      ? 'business'
      : descriptionContains(description, 'court', 'legal', 'regulator', 'statute')
        ? 'legal'
        : descriptionContains(description, 'faculty', 'campus', 'research', 'academic')
          ? 'academic'
          : descriptionContains(description, 'team', 'board', 'department', 'leadership')
            ? 'organizational'
            : 'other'

  const classification = descriptionContains(description, 'history', 'historical', 'case')
    ? 'historical_case'
    : descriptionContains(description, 'negotiat', 'bargain', 'deal')
      ? 'negotiation'
      : descriptionContains(description, 'compet', 'entry', 'pricing', 'market')
        ? 'competition'
        : descriptionContains(description, 'dilemma', 'textbook')
          ? 'textbook_model'
          : descriptionContains(description, 'strike', 'launch', 'current', 'today', 'live')
            ? 'live_event'
            : 'custom'

  const actorCandidates = extractActorSketch(description)
  const suggested_emphasis = domain === 'geopolitical'
    ? ['stakeholder_positions', 'actions_vs_statements', 'rules_constraints']
    : domain === 'business'
      ? ['economic_financial', 'capabilities_resources', 'impact_affected_parties']
      : ['timeline', 'stakeholder_positions']

  return {
    domain,
    classification,
    initial_actors_sketch: actorCandidates,
    initial_tension_sketch: `Strategic tension centers on ${description.trim().replace(/\.$/, '')}.`,
    suggested_emphasis,
    game_theory_fit: actorCandidates.length >= 2 ? 'strong' : 'moderate',
    fit_limitations: actorCandidates.length >= 2 ? [] : ['Actor set is underspecified and may need manual refinement.'],
  }
}

export function extractActorSketch(description: string): string[] {
  const parts = description
    .split(/(?:\bvs\b|versus|between|and|,|;|\/)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 3)
    .slice(0, 4)

  const normalized = parts
    .map((part) => part.replace(/^(the|a|an)\s+/i, '').trim())
    .filter(Boolean)

  if (normalized.length >= 2) {
    return normalized.slice(0, 4)
  }

  if (descriptionContains(description, 'incumbent')) {
    return ['Incumbent', 'Entrant']
  }

  if (descriptionContains(description, 'state')) {
    return ['State A', 'State B']
  }

  return ['Primary Actor', 'Counterparty']
}

const categoryTemplates: Record<EvidenceCategory, (description: string) => Omit<GroundingFinding, 'category' | 'confidence'>> = {
  capabilities_resources: (description) => ({
    summary: `Capabilities and resource posture affecting ${description}.`,
    specific_data_points: ['Force and staffing posture snapshot', 'Budget or resource availability indicator'],
    source_candidates: [
      {
        url: null,
        title: 'Capability baseline memo',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'medium',
        snapshot_text: `Capability baseline extracted for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'critical',
  }),
  economic_financial: (description) => ({
    summary: `Economic and financial stakes framing the incentives around ${description}.`,
    specific_data_points: ['Exposure or cost estimate band', 'Relevant price, revenue, or sanctions lever'],
    source_candidates: [
      {
        url: null,
        title: 'Economic pressure note',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'medium',
        snapshot_text: `Economic pressure indicators mapped for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'important',
  }),
  stakeholder_positions: (description) => ({
    summary: `Stated positions and implicit objectives among the main stakeholders in ${description}.`,
    specific_data_points: ['Public red lines', 'Negotiating ask or stated objective'],
    source_candidates: [
      {
        url: null,
        title: 'Stakeholder position digest',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'medium',
        snapshot_text: `Stakeholder position digest assembled for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'critical',
  }),
  impact_affected_parties: (description) => ({
    summary: `Who bears the downstream impact if ${description} escalates or stabilizes.`,
    specific_data_points: ['Affected constituency', 'Immediate operational impact'],
    source_candidates: [
      {
        url: null,
        title: 'Affected parties note',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'low',
        snapshot_text: `Affected-party scan for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'important',
  }),
  timeline: (description) => ({
    summary: `Timeline anchors and sequencing constraints tied to ${description}.`,
    specific_data_points: ['Recent trigger event date', 'Upcoming deadline or decision window'],
    source_candidates: [
      {
        url: null,
        title: 'Timeline anchor sheet',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'medium',
        snapshot_text: `Timeline anchors estimated for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'important',
  }),
  actions_vs_statements: (description) => ({
    summary: `Observable actions versus declared statements around ${description}.`,
    specific_data_points: ['Concrete move already taken', 'Declared intent not yet backed by action'],
    source_candidates: [
      {
        url: null,
        title: 'Action-statement gap note',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'high',
        snapshot_text: `Action-statement gap estimated for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'critical',
  }),
  rules_constraints: (description) => ({
    summary: `Institutional and legal constraints shaping ${description}.`,
    specific_data_points: ['Formal rule or treaty constraint', 'Domestic or regulatory limit'],
    source_candidates: [
      {
        url: null,
        title: 'Rules and constraints summary',
        author: 'Local heuristic runner',
        publication_date: null,
        quality_rating: 'medium',
        snapshot_text: `Rules and constraints mapped for ${description}.`,
        retrieval_method: 'ai_knowledge',
      },
    ],
    relevance: 'important',
  }),
}

export function buildGroundingFinding(category: EvidenceCategory, description: string): GroundingFinding {
  const template = categoryTemplates[category](description)
  return {
    category,
    ...template,
    confidence: createConfidenceEstimate(`Heuristic grounding confidence for ${category}.`, [], 0.68),
  }
}

export function buildEvidenceProposal(params: {
  category: EvidenceCategory
  finding: GroundingFinding
  phase: number
  phaseExecution: PhaseExecution
  baseRevision: number
}): EvidenceProposal {
  const sourceId = createEntityId('source')
  const observationId = createEntityId('observation')
  const claimId = createEntityId('claim')
  const inferenceId = createEntityId('inference')
  const derivationObservationClaimId = createEntityId('derivation')
  const derivationClaimInferenceId = createEntityId('derivation')

  const sourceTitle = params.finding.source_candidates[0]?.title ?? `${params.category} source`
  const observationText = params.finding.summary
  const claimStatement = `${params.finding.summary} materially shapes the strategic picture.`
  const inferenceStatement = `Analysts should factor ${params.category.replace(/_/g, ' ')} into downstream modeling.`

  const commands: Command[] = [
    {
      kind: 'add_source',
      id: sourceId,
      payload: {
        kind: 'manual',
        title: sourceTitle,
        captured_at: new Date().toISOString(),
        quality_rating: 'medium',
        notes: params.finding.source_candidates[0]?.snapshot_text,
      },
    },
    {
      kind: 'add_observation',
      id: observationId,
      payload: {
        source_id: sourceId,
        text: observationText,
        captured_at: new Date().toISOString(),
      },
    },
    {
      kind: 'add_claim',
      id: claimId,
      payload: {
        statement: claimStatement,
        based_on: [observationId],
        confidence: params.finding.confidence.confidence,
      },
    },
    {
      kind: 'add_inference',
      id: inferenceId,
      payload: {
        statement: inferenceStatement,
        derived_from: [claimId],
        confidence: params.finding.confidence.confidence,
        rationale: params.finding.summary,
      },
    },
    {
      kind: 'add_derivation',
      id: derivationObservationClaimId,
      payload: {
        from_ref: observationId,
        to_ref: claimId,
        relation: 'supports',
      },
    },
    {
      kind: 'add_derivation',
      id: derivationClaimInferenceId,
      payload: {
        from_ref: claimId,
        to_ref: inferenceId,
        relation: 'infers',
      },
    },
  ]

  const entity_previews = [
    createEntityPreview('source', 'add', sourceId, { title: sourceTitle, kind: 'manual' }),
    createEntityPreview('observation', 'add', observationId, { text: observationText, source_id: sourceId }),
    createEntityPreview('claim', 'add', claimId, { statement: claimStatement, based_on: [observationId] }),
    createEntityPreview('inference', 'add', inferenceId, { statement: inferenceStatement, derived_from: [claimId] }),
    createEntityPreview('derivation', 'add', derivationObservationClaimId, { from_ref: observationId, to_ref: claimId, relation: 'supports' }),
    createEntityPreview('derivation', 'add', derivationClaimInferenceId, { from_ref: claimId, to_ref: inferenceId, relation: 'infers' }),
  ]

  return {
    id: createEntityId('proposal'),
    description: `Add ${params.category.replace(/_/g, ' ')} evidence chain`,
    phase: params.phase,
    phase_execution_id: params.phaseExecution.id,
    base_revision: params.baseRevision,
    status: 'pending',
    commands,
    entity_previews,
    conflicts: [],
  }
}

export function buildModelProposal(params: {
  description: string
  phase: number
  proposal_type: ModelProposal['proposal_type']
  phaseExecution: PhaseExecution
  baseRevision: number
  commands: Command[]
  entity_previews: EntityPreview[]
}): ModelProposal {
  return {
    id: createEntityId('proposal'),
    description: params.description,
    proposal_type: params.proposal_type,
    phase: params.phase,
    phase_execution_id: params.phaseExecution.id,
    base_revision: params.baseRevision,
    status: 'pending',
    commands: params.commands,
    entity_previews: params.entity_previews,
    conflicts: [],
  }
}

export function listEntityRefs(canonical: CanonicalStore, type: EntityType): EntityRef[] {
  const record = canonical[({
    game: 'games',
    formalization: 'formalizations',
    player: 'players',
    game_node: 'nodes',
    game_edge: 'edges',
    source: 'sources',
    observation: 'observations',
    claim: 'claims',
    inference: 'inferences',
    assumption: 'assumptions',
    contradiction: 'contradictions',
    derivation: 'derivations',
    latent_factor: 'latent_factors',
    cross_game_link: 'cross_game_links',
    scenario: 'scenarios',
    playbook: 'playbooks',
    escalation_ladder: 'escalation_ladders',
    trust_assessment: 'trust_assessments',
    eliminated_outcome: 'eliminated_outcomes',
    signal_classification: 'signal_classifications',
    repeated_game_pattern: 'repeated_game_patterns',
    revalidation_event: 'revalidation_events',
    dynamic_inconsistency_risk: 'dynamic_inconsistency_risks',
    cross_game_constraint_table: 'cross_game_constraint_tables',
    central_thesis: 'central_theses',
    tail_risk: 'tail_risks',
  } as const)[type]] as Record<string, unknown>

  return Object.keys(record).map((id) => ({ type, id }))
}
