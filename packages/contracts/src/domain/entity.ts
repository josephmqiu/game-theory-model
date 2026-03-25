/**
 * Canonical entity types for the game-theory analysis domain.
 *
 * These are the source-of-truth type definitions. Both apps/web and apps/server
 * re-export from here rather than maintaining independent copies.
 *
 * Zod schemas for runtime validation live in the consuming apps (server-side),
 * not here. This file is pure TypeScript types only.
 */
import type { MethodologyPhase, PhaseState } from "./methodology";

// ── Confidence & Source ──

export type EntityConfidence = "high" | "medium" | "low";
export type EntitySource = "ai" | "human" | "computed";

// ── Entity Provenance ──

export interface EntityProvenance {
  source: "phase-derived" | "ai-edited" | "user-edited";
  runId?: string | undefined;
  phase?: string | undefined;
  timestamp: number;
  webSearchAvailable?: boolean | undefined;
  previousOrigin?: EntityProvenance | undefined;
}

// ── Entity Type Enum ──

export type EntityType =
  | "fact"
  | "player"
  | "objective"
  | "game"
  | "strategy"
  | "payoff"
  | "institutional-rule"
  | "escalation-rung"
  | "interaction-history"
  | "repeated-game-pattern"
  | "trust-assessment"
  | "dynamic-inconsistency"
  | "signaling-effect"
  | "payoff-matrix"
  | "game-tree"
  | "equilibrium-result"
  | "cross-game-constraint-table"
  | "cross-game-effect"
  | "signal-classification"
  | "bargaining-dynamics"
  | "option-value-assessment"
  | "behavioral-overlay"
  | "assumption"
  | "eliminated-outcome"
  | "scenario"
  | "central-thesis"
  | "meta-check";

// ── Phase 1: Situational Grounding ──

export type FactCategory =
  | "capability"
  | "economic"
  | "position"
  | "impact"
  | "action"
  | "rule";

export interface FactData {
  type: "fact";
  date: string;
  source: string;
  content: string;
  category: FactCategory;
}

// ── Phase 2: Player Identification ──

export type PlayerType =
  | "primary"
  | "involuntary"
  | "background"
  | "internal"
  | "gatekeeper";

export interface PlayerData {
  type: "player";
  name: string;
  playerType: PlayerType;
  knowledge: string[];
}

export type ObjectivePriority = "lexicographic" | "high" | "tradable";

export interface ObjectiveData {
  type: "objective";
  description: string;
  priority: ObjectivePriority;
  stability: "stable" | "shifting" | "unknown";
}

// ── Phase 3: Baseline Model ──

export type GameType =
  | "chicken"
  | "prisoners-dilemma"
  | "coordination"
  | "war-of-attrition"
  | "bargaining"
  | "signaling"
  | "bayesian"
  | "coalition"
  | "domestic-political"
  | "economic-hostage"
  | "bertrand"
  | "hotelling"
  | "entry-deterrence"
  | "network-effects";

export type GameTiming = "simultaneous" | "sequential" | "repeated";

export interface GameData {
  type: "game";
  name: string;
  gameType: GameType;
  timing: GameTiming;
  description: string;
}

export type StrategyFeasibility =
  | "actual"
  | "requires-new-capability"
  | "rhetoric-only"
  | "dominated";

export interface StrategyData {
  type: "strategy";
  name: string;
  feasibility: StrategyFeasibility;
  description: string;
}

export interface PayoffData {
  type: "payoff";
  rank: number | null;
  value: number | null;
  rationale: string;
}

export interface InstitutionalRuleData {
  type: "institutional-rule";
  name: string;
  ruleType:
    | "international"
    | "domestic"
    | "alliance"
    | "economic"
    | "arms-control";
  effectOnStrategies: string;
}

export interface EscalationRungData {
  type: "escalation-rung";
  action: string;
  reversibility: "reversible" | "partially-reversible" | "irreversible";
  climbed: boolean;
  order: number;
}

// ── Phase 4: Historical Repeated Game ──

export interface InteractionHistoryData {
  type: "interaction-history";
  playerPair: [string, string];
  moves: Array<{
    actor: string;
    action: "cooperation" | "defection" | "punishment" | "concession" | "delay";
    description: string;
    date: string;
    otherSideAction: string;
    outcome: string;
    beliefChange: string;
  }>;
  timespan: string;
}

export interface RepeatedGamePatternData {
  type: "repeated-game-pattern";
  patternType:
    | "tit-for-tat"
    | "grim-trigger"
    | "selective-forgiveness"
    | "dual-track-deception"
    | "adverse-selection"
    | "defection-during-cooperation";
  description: string;
  evidence: string;
  frequency: string;
}

export interface TrustAssessmentData {
  type: "trust-assessment";
  playerPair: [string, string];
  trustLevel: "zero" | "low" | "moderate" | "high";
  direction: string;
  evidence: string;
  implication: string;
}

export interface DynamicInconsistencyData {
  type: "dynamic-inconsistency";
  commitment: string;
  institutionalForm:
    | "treaty-ratified"
    | "legislation"
    | "executive-order"
    | "executive-discretion"
    | "bureaucratic-lock-in"
    | "informal-agreement";
  durability: "durable" | "fragile" | "transitional";
  transitionRisk: string;
  timeHorizon: string;
}

export interface SignalingEffectData {
  type: "signaling-effect";
  signal: string;
  observers: string[];
  lesson: string;
  reputationEffect: string;
}

// ── Phase 6: Full Formal Modeling ──

export interface PayoffEstimate {
  player: string;
  ordinalRank: number;
  cardinalValue: number | null;
  rangeLow: number;
  rangeHigh: number;
  confidence: EntityConfidence;
  rationale: string;
  dependencies: string[];
}

export interface PayoffMatrixData {
  type: "payoff-matrix";
  gameName: string;
  players: [string, string];
  strategies: {
    row: string[];
    column: string[];
  };
  cells: Array<{
    row: string;
    column: string;
    payoffs: PayoffEstimate[];
  }>;
}

export interface GameTreeData {
  type: "game-tree";
  gameName: string;
  nodes: Array<{
    nodeId: string;
    player: string | null;
    nodeType: "decision" | "chance" | "terminal";
    informationSet: string | null;
  }>;
  branches: Array<{
    fromNodeId: string;
    toNodeId: string;
    action: string;
    probability: number | null;
  }>;
  informationSets: Array<{
    setId: string;
    player: string;
    nodeIds: string[];
    description: string;
  }>;
  terminalPayoffs: Array<{
    nodeId: string;
    payoffs: PayoffEstimate[];
  }>;
}

export type EquilibriumType =
  | "dominant-strategy"
  | "nash"
  | "subgame-perfect"
  | "bayesian-nash"
  | "separating"
  | "pooling"
  | "semi-separating";

export type SelectionFactor =
  | "path-dependence"
  | "focal-points"
  | "commitment-devices"
  | "institutional-rules"
  | "salient-narratives"
  | "relative-cost-of-swerving";

export interface EquilibriumResultData {
  type: "equilibrium-result";
  gameName: string;
  equilibriumType: EquilibriumType;
  description: string;
  strategies: Array<{
    player: string;
    strategy: string;
  }>;
  selectionFactors: Array<{
    factor: SelectionFactor;
    evidence: string;
    weight: "high" | "medium" | "low";
  }>;
}

export interface CrossGameConstraintTableData {
  type: "cross-game-constraint-table";
  strategies: string[];
  games: string[];
  cells: Array<{
    strategy: string;
    game: string;
    result: "pass" | "fail" | "uncertain";
    reasoning: string;
  }>;
}

export type CrossGameEffectType =
  | "payoff-shift"
  | "belief-update"
  | "strategy-unlock"
  | "strategy-elimination"
  | "player-entry"
  | "player-exit"
  | "commitment-change"
  | "resource-transfer"
  | "timing-change";

export interface CrossGameEffectData {
  type: "cross-game-effect";
  sourceGame: string;
  targetGame: string;
  trigger: string;
  effectType: CrossGameEffectType;
  magnitude: string;
  direction: string;
  cascade: boolean;
}

export interface SignalClassificationData {
  type: "signal-classification";
  action: string;
  player: string;
  classification: "cheap-talk" | "costly-signal" | "audience-cost";
  cheapTalkConditions: {
    interestsAligned: boolean;
    reputationalCapital: boolean;
    verifiable: boolean;
    repeatedGameMakesLyingCostly: boolean;
  } | null;
  credibility: "high" | "medium" | "low";
}

export interface BargainingDynamicsData {
  type: "bargaining-dynamics";
  negotiation: string;
  outsideOptions: Array<{
    player: string;
    option: string;
    quality: "strong" | "moderate" | "weak";
  }>;
  patience: Array<{
    player: string;
    discountFactor: string;
    pressures: string[];
  }>;
  deadlines: Array<{
    description: string;
    date: string | null;
    affectsPlayer: string;
  }>;
  commitmentProblems: string[];
  dynamicInconsistency: string | null;
  issueLinkage: Array<{
    linkedGame: string;
    description: string;
  }>;
}

export type OptionValueFlexibilityType =
  | "escalation-flexibility"
  | "avoiding-irreversible-commitment"
  | "waiting-for-information"
  | "letting-constraints-tighten";

export interface OptionValueAssessmentData {
  type: "option-value-assessment";
  player: string;
  action: string;
  flexibilityPreserved: Array<{
    type: OptionValueFlexibilityType;
    description: string;
  }>;
  uncertaintyLevel: "high" | "medium" | "low";
}

export type BehavioralOverlayType =
  | "prospect-theory"
  | "overconfidence"
  | "sunk-cost"
  | "groupthink"
  | "anchoring"
  | "honor-based-escalation"
  | "reference-dependence"
  | "scenario-planning"
  | "red-teaming";

export interface BehavioralOverlayData {
  type: "behavioral-overlay";
  classification: "adjacent";
  overlayType: BehavioralOverlayType;
  description: string;
  affectedPlayers: string[];
  referencePoint: string | null;
  predictionModification: string;
}

// ── Phase 7: Assumption Extraction ──

export interface AssumptionData {
  type: "assumption";
  description: string;
  sensitivity: "critical" | "high" | "medium" | "low";
  category:
    | "behavioral"
    | "capability"
    | "structural"
    | "institutional"
    | "rationality"
    | "information";
  classification: "game-theoretic" | "empirical";
  correlatedClusterId: string | null;
  rationale: string;
  dependencies: string[];
}

// ── Phase 8: Elimination ──

export interface EliminatedOutcomeData {
  type: "eliminated-outcome";
  description: string;
  traced_reasoning: string;
  source_phase: MethodologyPhase;
  source_entity_ids: string[];
}

// ── Phase 9: Scenario Generation ──

export interface ScenarioData {
  type: "scenario";
  subtype: "baseline" | "tail-risk";
  narrative: string;
  probability: {
    point: number;
    rangeLow: number;
    rangeHigh: number;
  };
  key_assumptions: string[];
  invalidation_conditions: string;
  model_basis: string[];
  cross_game_interactions: string;
  prediction_basis: "equilibrium" | "discretionary" | "behavioral-overlay";
  // Tail-risk fields (nullable -- required only when subtype is "tail-risk")
  trigger: string | null;
  why_unlikely: string | null;
  consequences: string | null;
  drift_trajectory: string | null;
}

export interface CentralThesisData {
  type: "central-thesis";
  thesis: string;
  falsification_conditions: string;
  supporting_scenarios: string[];
}

// ── Phase 10: Meta-Check ──

export interface MetaCheckQuestion {
  question_number: number;
  answer: string;
  disruption_trigger_identified: boolean;
}

export interface MetaCheckData {
  type: "meta-check";
  questions: MetaCheckQuestion[];
}

// ── Entity Data Union ──

export type EntityData =
  | FactData
  | PlayerData
  | ObjectiveData
  | GameData
  | StrategyData
  | PayoffData
  | InstitutionalRuleData
  | EscalationRungData
  | InteractionHistoryData
  | RepeatedGamePatternData
  | TrustAssessmentData
  | DynamicInconsistencyData
  | SignalingEffectData
  | PayoffMatrixData
  | GameTreeData
  | EquilibriumResultData
  | CrossGameConstraintTableData
  | CrossGameEffectData
  | SignalClassificationData
  | BargainingDynamicsData
  | OptionValueAssessmentData
  | BehavioralOverlayData
  | AssumptionData
  | EliminatedOutcomeData
  | ScenarioData
  | CentralThesisData
  | MetaCheckData;

// ── Core Entity ──

export interface AnalysisEntity {
  id: string;
  type: EntityType;
  phase: MethodologyPhase;
  data: EntityData;
  confidence: EntityConfidence;
  /** @deprecated Use provenance.source instead */
  source: EntitySource;
  provenance?: EntityProvenance | undefined;
  rationale: string;
  revision: number;
  stale: boolean; // true when downstream of a human edit, pending revalidation
  group?: string | undefined; // analytical group label assigned by canvas-service grouping
}

// ── Relationships ──

export type RelationshipType =
  | "plays-in"
  | "has-objective"
  | "conflicts-with"
  | "has-strategy"
  | "supports"
  | "contradicts"
  | "produces"
  | "depends-on"
  | "invalidated-by"
  | "constrains"
  | "escalates-to"
  | "links"
  | "precedes"
  | "informed-by"
  | "derived-from";

/** Relationship traversal categories for invalidation (Issue #4 from eng review):
 * - downstream: dependency edges -- invalidation propagates along these
 * - evidence: evidentiary links -- flag for review but don't auto-stale
 * - structural: symmetric or temporal -- never traversed for invalidation
 */
export const RELATIONSHIP_CATEGORY: Record<
  RelationshipType,
  "downstream" | "evidence" | "structural"
> = {
  "plays-in": "downstream",
  "has-objective": "downstream",
  "has-strategy": "downstream",
  produces: "downstream",
  "depends-on": "downstream",
  "derived-from": "downstream",
  supports: "evidence",
  contradicts: "evidence",
  "informed-by": "evidence",
  constrains: "structural",
  "escalates-to": "structural",
  links: "structural",
  precedes: "structural",
  "conflicts-with": "structural",
  "invalidated-by": "evidence",
};

export interface AnalysisRelationship {
  id: string;
  type: RelationshipType;
  fromEntityId: string;
  toEntityId: string;
  metadata?: Record<string, unknown> | undefined;
  source?: EntitySource | undefined;
  provenance?: EntityProvenance | undefined;
}

// ── Full Analysis ──

export interface Analysis {
  id: string;
  name: string;
  topic: string;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
  phases: PhaseState[];
  centralThesis?: string | undefined;
}

// ── File Format ──

export type LayoutState = Record<
  string,
  { x: number; y: number; pinned: boolean }
>;

export interface AnalysisFileV3 {
  type: "game-theory-analysis";
  version: 3;
  analysis: Analysis;
  layout: LayoutState;
}

/** File reference for persistence (shared across v1 and v2 formats). */
export interface AnalysisFileReference {
  fileName: string | null;
  filePath: string | null;
  fileHandle: FileSystemFileHandle | null;
}

/** Result type for phase worker parsing */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
