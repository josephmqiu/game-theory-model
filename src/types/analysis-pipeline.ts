import type { Command } from '../engine/commands'
import type { EntityRef, SolverKind, SolverReadiness } from './canonical'
import type { EstimateValue } from './estimates'
import type {
  DiffReviewState,
  EntityPreview,
} from './conversation'
import type { RevalidationEvent, RevalidationTrigger } from './evidence'
import type { Formalization } from './formalizations'

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

export interface PromptVersion {
  id: string
  phase: number
  name: string
  content: string
  parent_id: string | null
  is_official: boolean
  created_at: string
  metadata: {
    author: 'system' | 'user'
    description: string
    tags: string[]
  }
}

export interface PromptRegistry {
  versions: Record<string, PromptVersion>
  active_versions: Record<number, string>
  official_versions: Record<number, string>
}

export interface PromptRunComparison {
  phase: number
  left_prompt_version_id: string
  right_prompt_version_id: string
  changed: boolean
  summary: string
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
    | 'cross_game_link'
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

export type Phase6Subsection = '6a' | '6b' | '6c' | '6d' | '6e' | '6f' | '6g' | '6h' | '6i'

export type Phase6FormalizationKind =
  | 'normal_form'
  | 'extensive_form'
  | 'repeated'
  | 'bayesian'
  | 'signaling'
  | 'bargaining'

export interface Phase6SubsectionStatus {
  subsection: Phase6Subsection
  status: 'complete' | 'partial' | 'not_applicable'
  summary: string
  warnings: string[]
}

export interface FormalizationRepresentationSummary {
  formalization_id: string
  game_id: string
  game_name: string
  kind: Phase6FormalizationKind
  purpose: Formalization['purpose']
  abstraction_level: Formalization['abstraction_level']
  reused_existing: boolean
  rationale: string
  assumption_ids: string[]
}

export interface FormalRepresentationResult {
  status: Phase6SubsectionStatus['status']
  summaries: FormalizationRepresentationSummary[]
  reused_formalization_ids: string[]
  new_game_hypotheses: Array<{
    label: string
    rationale: string
  }>
  assumption_proposal_ids: string[]
  warnings: string[]
}

export interface PayoffEstimationSummary {
  formalization_id: string
  ordinal_first: boolean
  updated_profiles: number
  updated_terminal_nodes: number
  cardinal_justifications: string[]
}

export interface PayoffEstimationResult {
  status: Phase6SubsectionStatus['status']
  updates: PayoffEstimationSummary[]
  warnings: string[]
}

export interface EquilibriumSummary {
  solver: SolverKind | 'readiness' | 'signaling_classification'
  status: 'success' | 'partial' | 'failed'
  summary: string
  equilibrium_count?: number
  warnings: string[]
}

export interface FormalizationAnalysisSummary {
  formalization_id: string
  game_id: string
  kind: Phase6FormalizationKind
  readiness: SolverReadiness
  solver_summaries: EquilibriumSummary[]
  classification: string | null
}

export interface BaselineEquilibriaResult {
  status: Phase6SubsectionStatus['status']
  analyses: FormalizationAnalysisSummary[]
  warnings: string[]
}

export interface EquilibriumSelectionEntry {
  formalization_id: string
  selected_equilibrium_id: string | null
  rationale: string
  alternatives: string[]
}

export interface EquilibriumSelectionResult {
  status: Phase6SubsectionStatus['status']
  selections: EquilibriumSelectionEntry[]
  warnings: string[]
}

export interface BargainingDynamicsResult {
  status: Phase6SubsectionStatus['status']
  applicable: boolean
  summary: string
  leverage_points: string[]
  warnings: string[]
}

export interface CommunicationClassificationSummary {
  id: string
  player_id: string
  classification: 'cheap_talk' | 'costly_signal' | 'audience_cost'
  summary: string
}

export interface CommunicationAnalysisResult {
  status: Phase6SubsectionStatus['status']
  classifications: CommunicationClassificationSummary[]
  warnings: string[]
}

export interface Phase6NormalFormWorkspacePreview {
  kind: 'normal_form'
  formalization_id: string
  game_id: string
  player_ids: string[]
  row_player_id: string | null
  col_player_id: string | null
  row_strategies: string[]
  col_strategies: string[]
  cells: Array<{
    row_strategy: string
    col_strategy: string
    payoffs: Record<string, EstimateValue>
  }>
}

export interface Phase6ExtensiveFormWorkspacePreview {
  kind: 'extensive_form'
  formalization_id: string
  game_id: string
  root_node_id: string | null
  nodes: Array<{
    id: string
    type: import('./canonical').GameNode['type']
    label: string
    actor_label: string | null
    terminal_payoffs?: Record<string, EstimateValue>
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    label: string
  }>
}

export type Phase6WorkspacePreview =
  | Phase6NormalFormWorkspacePreview
  | Phase6ExtensiveFormWorkspacePreview

export interface OptionValueResult {
  status: Phase6SubsectionStatus['status']
  summary: string
  player_options: Array<{
    player_id: string
    option: string
    value: 'material' | 'modest'
  }>
  warnings: string[]
}

export interface BehavioralOverlaySummary {
  label: string
  effect_on_prediction: 'none' | 'shifts_risk' | 'changes_prediction'
  summary: string
}

export interface BehavioralOverlayResult {
  status: Phase6SubsectionStatus['status']
  label: 'ADJACENT — NOT CORE GAME THEORY'
  methodology_flags: string[]
  overlays: BehavioralOverlaySummary[]
  warnings: string[]
}

export interface CrossGameEffectSummary {
  source_game_id: string
  target_game_id: string
  effect_type: import('./evidence').CrossGameLink['effect_type']
  summary: string
}

export interface CrossGameEffectsResult {
  status: Phase6SubsectionStatus['status']
  effects: CrossGameEffectSummary[]
  warnings: string[]
}

export interface Phase6RevalidationSignals {
  triggers_found: RevalidationTrigger[]
  affected_entities: EntityRef[]
  description: string
}

export interface Phase6ProposalGroup {
  subsection: Phase6Subsection
  content: string
  proposals: ModelProposal[]
}

export interface FormalizationResult {
  phase: 6
  status: PhaseResult
  subsections_run: Phase6Subsection[]
  subsection_statuses: Phase6SubsectionStatus[]
  formal_representations: FormalRepresentationResult
  payoff_estimation: PayoffEstimationResult
  baseline_equilibria: BaselineEquilibriaResult
  equilibrium_selection: EquilibriumSelectionResult
  bargaining_dynamics: BargainingDynamicsResult | null
  communication_analysis: CommunicationAnalysisResult
  option_value: OptionValueResult | null
  behavioral_overlays: BehavioralOverlayResult | null
  cross_game_effects: CrossGameEffectsResult | null
  proposals: ModelProposal[]
  proposal_groups: Phase6ProposalGroup[]
  workspace_previews: Record<string, Phase6WorkspacePreview>
  revalidation_signals: Phase6RevalidationSignals
}

export interface ProposedAssumptionFull {
  temp_id: string
  statement: string
  type: 'behavioral' | 'capability' | 'structural' | 'institutional' | 'rationality' | 'information'
  sensitivity: 'critical' | 'high' | 'medium' | 'low'
  what_if_wrong: string
  game_theoretic_vs_empirical: 'game_theoretic' | 'empirical'
  correlated_cluster_id: string | null
  evidence_quality: 'direct_evidence' | 'inference' | 'assumption_only'
  evidence_refs: EntityRef[]
  affected_conclusions: EntityRef[]
  confidence: EstimateValue
}

export interface CorrelatedCluster {
  id: string
  label: string
  description: string
  latent_factor: string
  assumption_ids: string[]
  affected_domains: string[]
}

export interface Phase7SensitivitySummary {
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  inference_only_critical: number
  largest_cluster_size: number
}

export interface AssumptionExtractionResult {
  phase: 7
  status: PhaseResult
  assumptions: ProposedAssumptionFull[]
  correlated_clusters: CorrelatedCluster[]
  sensitivity_summary: Phase7SensitivitySummary
  proposals: ModelProposal[]
}

export interface RevalidationCheck {
  triggers_found: RevalidationTrigger[]
  affected_phases: number[]
  affected_entities: EntityRef[]
  recommendation: 'revalidate' | 'monitor' | 'none'
  description: string
}

export interface RevalidationOutcome {
  event_id: string
  phases_rerun: number[]
  entities_marked_stale: EntityRef[]
  entities_updated: EntityRef[]
  new_pass_number: number
  converged: boolean
}

export interface PendingRevalidationApproval {
  event_id: string
  source_phase: number
  target_phases: number[]
  affected_entities: EntityRef[]
  previous_phase_statuses: Partial<Record<number, PipelinePhaseStatus>>
  created_at: string
}

export interface ActiveRerunCycle {
  event_id: string
  source_phase: number
  target_phases: number[]
  earliest_phase: number
  pass_number: number
  started_at: string
  status: 'queued' | 'running' | 'complete'
}

export interface PipelineRuntimeSnapshot {
  prompt_registry: PromptRegistry
  pending_revalidation_approvals: Record<string, PendingRevalidationApproval>
  active_rerun_cycle: ActiveRerunCycle | null
}

export interface RevalidationEngine {
  checkTriggers(phaseResult: unknown, phase: number): RevalidationCheck
  executeRevalidation(event: RevalidationEvent): Promise<RevalidationOutcome>
  getRevalidationLog(analysisId: string): RevalidationEvent[]
  getCurrentPass(): number
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

export interface Phase6RunInput {
  subsections?: Phase6Subsection[]
}

export interface Phase7RunInput {}

export type PhaseRunInput = Phase1RunInput | Phase2RunInput | Phase6RunInput | Phase7RunInput

export interface PipelinePhaseRunnerContext {
  analysisState: AnalysisState
  phaseExecution: PhaseExecution
  baseRevision: number
}

export interface PipelineOrchestrator {
  startAnalysis(description: string, options?: { manual?: boolean }): Promise<AnalysisState>
  runPhase(phase: number, input?: PhaseRunInput): Promise<PhaseResult>
  approveRevalidation(eventId: string): Promise<RevalidationOutcome | null>
  dismissRevalidation(eventId: string): void
  reconcileActiveRerunCycle(): void
  getPendingRevalidations(): RevalidationEvent[]
  getPromptRegistry(): PromptRegistry
  forkPromptVersion(
    phase: number,
    params?: { name?: string; content?: string; description?: string },
  ): PromptVersion
  pause(): void
  resume(): void
  cancelCurrentPhase(): void
  getState(): AnalysisState | null
  handleSteering(message: string): Promise<void>
}
