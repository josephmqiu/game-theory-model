import type { Command } from '../engine/commands'
import type { EntityRef } from './canonical'
import type { EstimateValue } from './estimates'
import type {
  DiffReviewState,
  EntityPreview,
} from './conversation'
import type { RevalidationTrigger } from './evidence'

export type PipelinePhaseStatus = 'pending' | 'running' | 'review_needed' | 'complete' | 'needs_rerun' | 'skipped'
export type PipelineStatus = 'not_started' | 'running' | 'paused' | 'complete' | 'failed'
export type PipelineUiStatus = 'idle' | 'running' | 'complete' | 'stale' | 'blocked'

export interface ClassificationResult {
  domain: 'geopolitical' | 'business' | 'legal' | 'organizational' | 'academic' | 'other'
  classification: 'live_event' | 'historical_case' | 'negotiation' | 'competition' | 'textbook_model' | 'custom'
  initial_actors_sketch: string[]
  initial_tension_sketch: string
  suggested_emphasis: string[]
  game_theory_fit: 'strong' | 'moderate' | 'weak'
  fit_limitations: string[]
}

export interface AnalysisState {
  id: string
  event_description: string
  domain: string
  current_phase: number | null
  phase_states: Record<number, PhaseState>
  pass_number: number
  status: PipelineStatus
  started_at: string | null
  completed_at: string | null
  classification: ClassificationResult | null
}

export interface PhaseState {
  phase: number
  status: PipelinePhaseStatus
  pass_number: number
  started_at: string | null
  completed_at: string | null
  phase_execution_id: string | null
}

export interface PhaseExecution {
  id: string
  phase: number
  pass_number: number
  provider_id: string
  model_id: string
  prompt_version_id: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  status: 'running' | 'complete' | 'failed' | 'cancelled'
  error: string | null
}

export interface PhaseResult {
  status: 'complete' | 'partial' | 'failed'
  phase: number
  execution_id: string
  gaps?: string[]
  error?: string
  retriable: boolean
}

export interface EvidenceProposal {
  id: string
  description: string
  phase: number
  phase_execution_id: string
  base_revision: number
  status: 'pending' | 'accepted' | 'rejected' | 'partially_accepted' | 'conflict'
  commands: Command[]
  entity_previews: EntityPreview[]
  conflicts: Array<{
    kind: 'revision_mismatch' | 'integrity' | 'validation'
    message: string
  }>
}

export interface ModelProposal extends EvidenceProposal {
  proposal_type:
    | 'evidence'
    | 'player'
    | 'game'
    | 'formalization'
    | 'assumption'
    | 'escalation'
    | 'trust'
    | 'pattern'
    | 'elimination'
    | 'scenario'
    | 'thesis'
    | 'signal'
    | 'constraint_table'
    | 'dynamic_risk'
  framing_id?: string
}

export interface SourceCandidate {
  url: string | null
  title: string
  author: string | null
  publication_date: string | null
  quality_rating: 'high' | 'medium' | 'low' | 'unknown'
  snapshot_text: string
  retrieval_method: 'web_search' | 'provided_document' | 'ai_knowledge' | 'user_input'
}

export type EvidenceCategory =
  | 'capabilities_resources'
  | 'economic_financial'
  | 'stakeholder_positions'
  | 'impact_affected_parties'
  | 'timeline'
  | 'actions_vs_statements'
  | 'rules_constraints'

export interface GroundingFinding {
  category: EvidenceCategory
  summary: string
  specific_data_points: string[]
  source_candidates: SourceCandidate[]
  confidence: EstimateValue
  relevance: 'critical' | 'important' | 'contextual'
}

export interface GroundingResult {
  phase: 1
  status: PhaseResult
  evidence_by_category: Record<EvidenceCategory, GroundingFinding[]>
  coverage_assessment: {
    well_covered: string[]
    gaps: string[]
    overall_confidence: EstimateValue
  }
  proposals: EvidenceProposal[]
}

export interface ProposedObjective {
  description: string
  type: 'survival' | 'expansion' | 'reputation' | 'economic' | 'ideological' | 'other'
  internal_conflicts: string[]
}

export interface ProposedPlayer {
  temp_id: string
  name: string
  type: 'state' | 'organization' | 'individual' | 'coalition' | 'market' | 'public'
  role: 'primary' | 'involuntary' | 'background' | 'internal' | 'gatekeeper'
  parent_player_id?: string
  objectives: ProposedObjective[]
  priority_ordering: { objective_index: number; priority: 'absolute' | 'tradable' }[]
  stability_indicator: 'stable' | 'shifting' | 'unknown'
  non_standard_utility: string | null
  information_state: {
    knows: string[]
    doesnt_know: string[]
    beliefs: string[]
  }
  constraints: string[]
  evidence_refs: EntityRef[]
  confidence: EstimateValue
  rationale: string
}

export interface InformationAsymmetryMap {
  entries: {
    player_a: string
    player_b: string
    a_knows_about_b: string[]
    b_knows_about_a: string[]
    critical_gaps: string[]
  }[]
}

export interface PlayerIdentificationResult {
  phase: 2
  status: PhaseResult
  proposed_players: ProposedPlayer[]
  information_asymmetry_map: InformationAsymmetryMap
  proposals: ModelProposal[]
}

export interface InstitutionalConstraint {
  category:
    | 'international_institution'
    | 'domestic_legal'
    | 'alliance_obligation'
    | 'economic_institution'
    | 'arms_control_framework'
    | 'regulatory'
    | 'other'
  description: string
  constraining_effect: string
  evidence_refs: EntityRef[]
}

export interface ProposedBaselineGame {
  temp_id: string
  name: string
  canonical_type:
    | 'chicken_brinkmanship'
    | 'prisoners_dilemma'
    | 'coordination'
    | 'war_of_attrition'
    | 'bargaining'
    | 'signaling'
    | 'bayesian_incomplete_info'
    | 'coalition_alliance'
    | 'domestic_political'
    | 'economic_chokepoint'
    | 'bertrand_competition'
    | 'hotelling_differentiation'
    | 'entry_deterrence'
    | 'network_effects_platform'
  players: string[]
  description: string
  move_order: 'simultaneous' | 'sequential'
  time_structure: {
    event_time: string
    model_time: string
    simulation_time: string
  }
  deterrence_vs_compellence: 'deterrence' | 'compellence' | 'both' | 'neither' | null
  institutional_constraints: InstitutionalConstraint[]
  adjacent_game_test: 'changes_answer' | 'does_not_change_answer' | 'uncertain'
  evidence_refs: EntityRef[]
  confidence: EstimateValue
  rationale: string
}

export interface ProposedEscalationLadder {
  game_id: string
  rungs: {
    label: string
    description: string
    reversible: boolean
    climbed: boolean
    player_attribution: string | null
    evidence_refs: EntityRef[]
    strategic_implications: string
  }[]
  escalation_dominance: string | null
  stability_instability_paradox: boolean
}

export interface ProposedStrategyTable {
  players: string[]
  strategies: {
    player_id: string
    strategies: {
      label: string
      feasibility: 'feasible' | 'rhetoric_only' | 'dominated' | 'uncertain'
      requirements: string[]
      evidence_refs: EntityRef[]
    }[]
  }[]
  outcome_cells: {
    strategy_profile: { player_id: string; strategy_label: string }[]
    outcome_description: string
    ordinal_rank_per_player: { player_id: string; rank: string }[]
  }[] | null
}

export interface ProposedCrossGameConstraintTable {
  strategies: {
    player_id: string
    strategy_label: string
  }[]
  games: EntityRef[]
  cells: {
    strategy_index: number
    game_ref: EntityRef
    status: 'succeeds' | 'fails' | 'uncertain'
    notes: string
  }[]
  trapped_players: EntityRef[]
}

export interface BaselineModelResult {
  phase: 3
  status: PhaseResult
  proposed_games: ProposedBaselineGame[]
  escalation_ladder: ProposedEscalationLadder | null
  strategy_table: ProposedStrategyTable
  cross_game_constraint_table: ProposedCrossGameConstraintTable | null
  model_gaps: string[]
  proposals: ModelProposal[]
}

export interface RepeatedGameMapEntry {
  date: string
  description: string
  move_type: 'cooperation' | 'defection' | 'punishment' | 'concession' | 'delay'
  player_id: string
  other_side_state: string
  outcome: string
  changed_beliefs_or_rules: boolean
  evidence_refs: EntityRef[]
}

export interface ProposedRepeatedGamePattern {
  game_id: string
  pattern_type:
    | 'defection_during_cooperation'
    | 'tit_for_tat'
    | 'grim_trigger'
    | 'selective_forgiveness'
    | 'dual_track_deception'
    | 'adverse_selection'
  description: string
  instances: Array<{
    date: string
    description: string
    evidence_refs: EntityRef[]
  }>
  impact_on_trust: string
  impact_on_model: string
}

export interface ProposedTrustAssessment {
  assessor_player_id: string
  target_player_id: string
  level: 'zero' | 'low' | 'moderate' | 'high'
  posterior_belief: EstimateValue
  evidence_refs: EntityRef[]
  interaction_history_summary: string
  driving_patterns: EntityRef[]
  implications: string
}

export interface ProposedDynamicInconsistencyRisk {
  player_id: string
  commitment_description: string
  risk_type:
    | 'leadership_transition'
    | 'electoral_cycle'
    | 'executive_vs_legislative'
    | 'bureaucratic_reversal'
    | 'other'
  durability: 'fragile' | 'moderate' | 'durable'
  evidence_refs: EntityRef[]
  affected_games: EntityRef[]
  mitigation: string | null
}

export interface BaselineRecheck {
  game_still_correct: boolean
  revealed_repeated_not_oneshot: boolean
  hidden_player_found: boolean
  hidden_commitment_problem: boolean
  hidden_type_uncertainty: boolean
  cooperative_equilibria_eliminated: boolean
  objective_function_changed: boolean
  deterrence_compellence_reframed: boolean
  revalidation_needed: boolean
  revalidation_triggers: RevalidationTrigger[]
}

export interface HistoricalGameResult {
  phase: 4
  status: PhaseResult
  repeated_game_map: RepeatedGameMapEntry[]
  patterns_found: ProposedRepeatedGamePattern[]
  trust_assessment: ProposedTrustAssessment[]
  dynamic_inconsistency_risks: ProposedDynamicInconsistencyRisk[]
  global_signaling_effects: string[]
  baseline_recheck: BaselineRecheck
  proposals: ModelProposal[]
}

export interface SteeringMessage {
  id: string
  content: string
  timestamp: string
}

export interface PipelinePersistenceSnapshot {
  analysis_state: AnalysisState | null
  phase_executions: Record<string, PhaseExecution>
  phase_results: Record<number, unknown>
  steering_messages: SteeringMessage[]
  proposal_review: DiffReviewState
}

export interface Phase1RunInput {
  focus_areas?: string[]
}

export interface Phase2RunInput {
  additional_context?: string
}

export type PhaseRunInput = Phase1RunInput | Phase2RunInput

export interface PipelinePhaseRunnerContext {
  analysisState: AnalysisState
  phaseExecution: PhaseExecution
  baseRevision: number
}

export interface PipelineOrchestrator {
  startAnalysis(description: string, options?: { manual?: boolean }): Promise<AnalysisState>
  runPhase(phase: number, input?: PhaseRunInput): Promise<PhaseResult>
  pause(): void
  resume(): void
  cancelCurrentPhase(): void
  getState(): AnalysisState | null
  handleSteering(message: string): Promise<void>
}
