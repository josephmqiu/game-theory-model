import type { SolverKind, SolverReadiness } from './canonical'
import type { NormalFormModel } from './formalizations'

export interface SolverResultMeta {
  method_id: string
  method_label: string
  limitations: string[]
  assumptions_used: string[]
}

export interface SensitivitySummary {
  most_sensitive_payoff: {
    player_id: string
    strategy_profile: string[]
    sensitivity_magnitude: number
  } | null
  result_change_threshold: number
  assumption_sensitivity: Array<{
    assumption_id: string
    impact: 'result_changes' | 'result_stable'
    description: string
  }>
}

export interface SolverResult {
  id: string
  formalization_id: string
  solver: SolverKind
  computed_at: string
  readiness_snapshot: SolverReadiness
  status: 'success' | 'partial' | 'failed'
  warnings: string[]
  meta: SolverResultMeta
  sensitivity?: SensitivitySummary
  error?: string
}

export interface MixedStrategy {
  player_id: string
  distribution: Record<string, number>
}

export interface NashEquilibrium {
  id: string
  strategies: Record<string, MixedStrategy>
  payoffs: Record<string, number>
  type: 'pure' | 'mixed'
  stability: 'strict' | 'weak'
}

export interface NashResult extends SolverResult {
  solver: 'nash'
  equilibria: NashEquilibrium[]
  method: 'support_enumeration' | 'lemke_howson' | 'vertex_enumeration'
}

export interface DominatedStrategy {
  player_id: string
  strategy: string
  dominated_by: string | string[]
  dominance_type: 'strict' | 'weak'
  round: number
}

export interface DominanceRound {
  round: number
  eliminated: DominatedStrategy[]
}

type StoredNormalFormCell = NormalFormModel['payoff_cells'][number]

export interface DominanceResult extends SolverResult {
  solver: 'dominance'
  eliminated_strategies: DominatedStrategy[]
  reduced_game: {
    strategies: Record<string, string[]>
    remaining_cells: StoredNormalFormCell[]
  }
  rounds: DominanceRound[]
}

export interface UtilityEstimate {
  expected_value: number
  min_value?: number
  max_value?: number
  confidence: number
  assumptions_used: string[]
}

export interface PlayerUtility {
  player_id: string
  per_strategy: Record<string, UtilityEstimate>
  best_response: string
}

export interface ExpectedUtilityResult extends SolverResult {
  solver: 'expected_utility'
  player_utilities: Record<string, PlayerUtility>
}

export interface SubgameValue {
  node_id: string
  player_payoffs: Record<string, number>
  chosen_edge_id: string
  alternative_edges: Array<{
    edge_id: string
    player_payoffs: Record<string, number>
    payoff_difference: Record<string, number>
  }>
}

export interface BackwardInductionResult extends SolverResult {
  solver: 'backward_induction'
  solution_path: string[]
  subgame_values: Record<string, SubgameValue>
  optimal_strategies: Record<string, string>
}

export interface PosteriorBelief {
  player_id: string
  type_label: string
  prior: number
  posterior: number
  evidence_used: string[]
}

export interface BayesianStep {
  step: number
  observation: string
  prior: Record<string, number>
  likelihood: Record<string, number>
  posterior: Record<string, number>
}

export interface BayesianUpdateResult extends SolverResult {
  solver: 'bayesian_update'
  posterior_beliefs: PosteriorBelief[]
  update_chain: BayesianStep[]
}

export interface PayoffSensitivity {
  player_id: string
  node_id?: string
  strategy_profile?: string[]
  current_value: number
  threshold_value: number
  margin: number
  direction: 'increase' | 'decrease'
  result_if_crossed: string
}

export interface AssumptionSensitivity {
  assumption_id: string
  statement: string
  impact: 'result_changes' | 'result_stable'
  description: string
  affected_payoffs: string[]
}

export interface ThresholdResult {
  parameter: string
  current: number
  threshold: number
  margin: number
  consequence: string
}

export interface SensitivityAnalysis {
  formalization_id: string
  solver: SolverKind
  solver_result_id: string
  computed_at: string
  payoff_sensitivities: PayoffSensitivity[]
  assumption_sensitivities: AssumptionSensitivity[]
  threshold_analysis: ThresholdResult[]
  overall_robustness: 'robust' | 'sensitive' | 'fragile'
}

export type SolverResultUnion =
  | NashResult
  | DominanceResult
  | ExpectedUtilityResult
  | BackwardInductionResult
  | BayesianUpdateResult
