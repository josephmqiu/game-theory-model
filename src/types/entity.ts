import { z } from "zod/v4";
import type { MethodologyPhase, PhaseState } from "./methodology";

// ── Confidence & Source ──

export type EntityConfidence = "high" | "medium" | "low";
export type EntitySource = "ai" | "human" | "computed";

export const entityConfidenceSchema = z.enum(["high", "medium", "low"]);
export const entitySourceSchema = z.enum(["ai", "human", "computed"]);

// ── Entity Provenance ──

export interface EntityProvenance {
  source: "phase-derived" | "ai-edited" | "user-edited";
  runId?: string;
  phase?: string;
  timestamp: number;
  webSearchAvailable?: boolean;
  previousOrigin?: EntityProvenance;
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
  | "assumption";

// ── Phase 1: Situational Grounding ──

export type FactCategory =
  | "capability"
  | "economic"
  | "position"
  | "impact"
  | "action"
  | "rule";

export const factDataSchema = z.object({
  type: z.literal("fact"),
  date: z.string(),
  source: z.string(),
  content: z.string(),
  category: z.enum([
    "capability",
    "economic",
    "position",
    "impact",
    "action",
    "rule",
  ]),
});
export type FactData = z.infer<typeof factDataSchema>;

// ── Phase 2: Player Identification ──

export type PlayerType =
  | "primary"
  | "involuntary"
  | "background"
  | "internal"
  | "gatekeeper";

export const playerDataSchema = z.object({
  type: z.literal("player"),
  name: z.string().min(1),
  playerType: z.enum([
    "primary",
    "involuntary",
    "background",
    "internal",
    "gatekeeper",
  ]),
  knowledge: z.array(z.string()).default([]),
});
export type PlayerData = z.infer<typeof playerDataSchema>;

export type ObjectivePriority = "lexicographic" | "high" | "tradable";

export const objectiveDataSchema = z.object({
  type: z.literal("objective"),
  description: z.string().min(1),
  priority: z.enum(["lexicographic", "high", "tradable"]),
  stability: z.enum(["stable", "shifting", "unknown"]).default("unknown"),
});
export type ObjectiveData = z.infer<typeof objectiveDataSchema>;

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

export const gameDataSchema = z.object({
  type: z.literal("game"),
  name: z.string().min(1),
  gameType: z.enum([
    "chicken",
    "prisoners-dilemma",
    "coordination",
    "war-of-attrition",
    "bargaining",
    "signaling",
    "bayesian",
    "coalition",
    "domestic-political",
    "economic-hostage",
    "bertrand",
    "hotelling",
    "entry-deterrence",
    "network-effects",
  ]),
  timing: z.enum(["simultaneous", "sequential", "repeated"]),
  description: z.string().default(""),
});
export type GameData = z.infer<typeof gameDataSchema>;

export type StrategyFeasibility =
  | "actual"
  | "requires-new-capability"
  | "rhetoric-only"
  | "dominated";

export const strategyDataSchema = z.object({
  type: z.literal("strategy"),
  name: z.string().min(1),
  feasibility: z.enum([
    "actual",
    "requires-new-capability",
    "rhetoric-only",
    "dominated",
  ]),
  description: z.string().default(""),
});
export type StrategyData = z.infer<typeof strategyDataSchema>;

export const payoffDataSchema = z.object({
  type: z.literal("payoff"),
  rank: z.number().nullable(),
  value: z.number().nullable(),
  rationale: z.string().default(""),
});
export type PayoffData = z.infer<typeof payoffDataSchema>;

export const institutionalRuleDataSchema = z.object({
  type: z.literal("institutional-rule"),
  name: z.string().min(1),
  ruleType: z.enum([
    "international",
    "domestic",
    "alliance",
    "economic",
    "arms-control",
  ]),
  effectOnStrategies: z.string(),
});
export type InstitutionalRuleData = z.infer<typeof institutionalRuleDataSchema>;

export const escalationRungDataSchema = z.object({
  type: z.literal("escalation-rung"),
  action: z.string().min(1),
  reversibility: z.enum(["reversible", "partially-reversible", "irreversible"]),
  climbed: z.boolean(),
  order: z.number(),
});
export type EscalationRungData = z.infer<typeof escalationRungDataSchema>;

// ── Phase 4: Historical Repeated Game ──

export const interactionHistoryDataSchema = z.object({
  type: z.literal("interaction-history"),
  playerPair: z.tuple([z.string(), z.string()]),
  moves: z.array(
    z.object({
      actor: z.string(),
      action: z.enum([
        "cooperation",
        "defection",
        "punishment",
        "concession",
        "delay",
      ]),
      description: z.string(),
      date: z.string(),
      otherSideAction: z.string(),
      outcome: z.string(),
      beliefChange: z.string(),
    }),
  ),
  timespan: z.string(),
});
export type InteractionHistoryData = z.infer<
  typeof interactionHistoryDataSchema
>;

export const repeatedGamePatternDataSchema = z.object({
  type: z.literal("repeated-game-pattern"),
  patternType: z.enum([
    "tit-for-tat",
    "grim-trigger",
    "selective-forgiveness",
    "dual-track-deception",
    "adverse-selection",
    "defection-during-cooperation",
  ]),
  description: z.string(),
  evidence: z.string(),
  frequency: z.string(),
});
export type RepeatedGamePatternData = z.infer<
  typeof repeatedGamePatternDataSchema
>;

export const trustAssessmentDataSchema = z.object({
  type: z.literal("trust-assessment"),
  playerPair: z.tuple([z.string(), z.string()]),
  trustLevel: z.enum(["zero", "low", "moderate", "high"]),
  direction: z.string(),
  evidence: z.string(),
  implication: z.string(),
});
export type TrustAssessmentData = z.infer<typeof trustAssessmentDataSchema>;

export const dynamicInconsistencyDataSchema = z.object({
  type: z.literal("dynamic-inconsistency"),
  commitment: z.string(),
  institutionalForm: z.enum([
    "treaty-ratified",
    "legislation",
    "executive-order",
    "executive-discretion",
    "bureaucratic-lock-in",
    "informal-agreement",
  ]),
  durability: z.enum(["durable", "fragile", "transitional"]),
  transitionRisk: z.string(),
  timeHorizon: z.string(),
});
export type DynamicInconsistencyData = z.infer<
  typeof dynamicInconsistencyDataSchema
>;

export const signalingEffectDataSchema = z.object({
  type: z.literal("signaling-effect"),
  signal: z.string(),
  observers: z.array(z.string()),
  lesson: z.string(),
  reputationEffect: z.string(),
});
export type SignalingEffectData = z.infer<typeof signalingEffectDataSchema>;

// ── Phase 6: Full Formal Modeling ──

export const payoffEstimateSchema = z.object({
  player: z.string().min(1),
  ordinalRank: z.number(),
  cardinalValue: z.number().nullable(),
  rangeLow: z.number(),
  rangeHigh: z.number(),
  confidence: entityConfidenceSchema,
  rationale: z.string().min(1),
  dependencies: z.array(z.string()).min(1),
});
export type PayoffEstimate = z.infer<typeof payoffEstimateSchema>;

export const payoffMatrixDataSchema = z.object({
  type: z.literal("payoff-matrix"),
  gameName: z.string().min(1),
  players: z.tuple([z.string(), z.string()]),
  strategies: z.object({
    row: z.array(z.string()),
    column: z.array(z.string()),
  }),
  cells: z.array(
    z.object({
      row: z.string(),
      column: z.string(),
      payoffs: z.array(payoffEstimateSchema),
    }),
  ),
});
export type PayoffMatrixData = z.infer<typeof payoffMatrixDataSchema>;

export const gameTreeDataSchema = z.object({
  type: z.literal("game-tree"),
  gameName: z.string().min(1),
  nodes: z.array(
    z.object({
      nodeId: z.string(),
      player: z.string().nullable(),
      nodeType: z.enum(["decision", "chance", "terminal"]),
      informationSet: z.string().nullable(),
    }),
  ),
  branches: z.array(
    z.object({
      fromNodeId: z.string(),
      toNodeId: z.string(),
      action: z.string(),
      probability: z.number().nullable(),
    }),
  ),
  informationSets: z.array(
    z.object({
      setId: z.string(),
      player: z.string(),
      nodeIds: z.array(z.string()),
      description: z.string(),
    }),
  ),
  terminalPayoffs: z.array(
    z.object({
      nodeId: z.string(),
      payoffs: z.array(payoffEstimateSchema),
    }),
  ),
});
export type GameTreeData = z.infer<typeof gameTreeDataSchema>;

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

const selectionFactorSchema = z.object({
  factor: z.enum([
    "path-dependence",
    "focal-points",
    "commitment-devices",
    "institutional-rules",
    "salient-narratives",
    "relative-cost-of-swerving",
  ]),
  evidence: z.string().min(1),
  weight: z.enum(["high", "medium", "low"]),
});

export const equilibriumResultDataSchema = z.object({
  type: z.literal("equilibrium-result"),
  gameName: z.string().min(1),
  equilibriumType: z.enum([
    "dominant-strategy",
    "nash",
    "subgame-perfect",
    "bayesian-nash",
    "separating",
    "pooling",
    "semi-separating",
  ]),
  description: z.string(),
  strategies: z.array(
    z.object({
      player: z.string(),
      strategy: z.string(),
    }),
  ),
  selectionFactors: z.array(selectionFactorSchema).min(1),
});
export type EquilibriumResultData = z.infer<typeof equilibriumResultDataSchema>;

export const crossGameConstraintTableDataSchema = z.object({
  type: z.literal("cross-game-constraint-table"),
  strategies: z.array(z.string()),
  games: z.array(z.string()),
  cells: z.array(
    z.object({
      strategy: z.string(),
      game: z.string(),
      result: z.enum(["pass", "fail", "uncertain"]),
      reasoning: z.string(),
    }),
  ),
});
export type CrossGameConstraintTableData = z.infer<
  typeof crossGameConstraintTableDataSchema
>;

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

export const crossGameEffectDataSchema = z.object({
  type: z.literal("cross-game-effect"),
  sourceGame: z.string(),
  targetGame: z.string(),
  trigger: z.string(),
  effectType: z.enum([
    "payoff-shift",
    "belief-update",
    "strategy-unlock",
    "strategy-elimination",
    "player-entry",
    "player-exit",
    "commitment-change",
    "resource-transfer",
    "timing-change",
  ]),
  magnitude: z.string(),
  direction: z.string(),
  cascade: z.boolean(),
});
export type CrossGameEffectData = z.infer<typeof crossGameEffectDataSchema>;

export const signalClassificationDataSchema = z.object({
  type: z.literal("signal-classification"),
  action: z.string(),
  player: z.string(),
  classification: z.enum(["cheap-talk", "costly-signal", "audience-cost"]),
  cheapTalkConditions: z
    .object({
      interestsAligned: z.boolean(),
      reputationalCapital: z.boolean(),
      verifiable: z.boolean(),
      repeatedGameMakesLyingCostly: z.boolean(),
    })
    .nullable(),
  credibility: z.enum(["high", "medium", "low"]),
});
export type SignalClassificationData = z.infer<
  typeof signalClassificationDataSchema
>;

export const bargainingDynamicsDataSchema = z.object({
  type: z.literal("bargaining-dynamics"),
  negotiation: z.string(),
  outsideOptions: z.array(
    z.object({
      player: z.string(),
      option: z.string(),
      quality: z.enum(["strong", "moderate", "weak"]),
    }),
  ),
  patience: z.array(
    z.object({
      player: z.string(),
      discountFactor: z.string(),
      pressures: z.array(z.string()),
    }),
  ),
  deadlines: z.array(
    z.object({
      description: z.string(),
      date: z.string().nullable(),
      affectsPlayer: z.string(),
    }),
  ),
  commitmentProblems: z.array(z.string()),
  dynamicInconsistency: z.string().nullable(),
  issueLinkage: z.array(
    z.object({
      linkedGame: z.string(),
      description: z.string(),
    }),
  ),
});
export type BargainingDynamicsData = z.infer<
  typeof bargainingDynamicsDataSchema
>;

export type OptionValueFlexibilityType =
  | "escalation-flexibility"
  | "avoiding-irreversible-commitment"
  | "waiting-for-information"
  | "letting-constraints-tighten";

export const optionValueAssessmentDataSchema = z.object({
  type: z.literal("option-value-assessment"),
  player: z.string(),
  action: z.string(),
  flexibilityPreserved: z.array(
    z.object({
      type: z.enum([
        "escalation-flexibility",
        "avoiding-irreversible-commitment",
        "waiting-for-information",
        "letting-constraints-tighten",
      ]),
      description: z.string(),
    }),
  ),
  uncertaintyLevel: z.enum(["high", "medium", "low"]),
});
export type OptionValueAssessmentData = z.infer<
  typeof optionValueAssessmentDataSchema
>;

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

export const behavioralOverlayDataSchema = z.object({
  type: z.literal("behavioral-overlay"),
  classification: z.literal("adjacent"),
  overlayType: z.enum([
    "prospect-theory",
    "overconfidence",
    "sunk-cost",
    "groupthink",
    "anchoring",
    "honor-based-escalation",
    "reference-dependence",
    "scenario-planning",
    "red-teaming",
  ]),
  description: z.string(),
  affectedPlayers: z.array(z.string()),
  referencePoint: z.string().nullable(),
  predictionModification: z.string(),
});
export type BehavioralOverlayData = z.infer<typeof behavioralOverlayDataSchema>;

// ── Phase 7: Assumption Extraction ──

export const assumptionDataSchema = z.object({
  type: z.literal("assumption"),
  description: z.string(),
  sensitivity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum([
    "behavioral",
    "capability",
    "structural",
    "institutional",
    "rationality",
    "information",
  ]),
  classification: z.enum(["game-theoretic", "empirical"]),
  correlatedClusterId: z.string().nullable(),
  rationale: z.string().min(1),
  dependencies: z.array(z.string()),
});
export type AssumptionData = z.infer<typeof assumptionDataSchema>;

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
  | AssumptionData;

export const entityDataSchema = z.discriminatedUnion("type", [
  factDataSchema,
  playerDataSchema,
  objectiveDataSchema,
  gameDataSchema,
  strategyDataSchema,
  payoffDataSchema,
  institutionalRuleDataSchema,
  escalationRungDataSchema,
  interactionHistoryDataSchema,
  repeatedGamePatternDataSchema,
  trustAssessmentDataSchema,
  dynamicInconsistencyDataSchema,
  signalingEffectDataSchema,
  payoffMatrixDataSchema,
  gameTreeDataSchema,
  equilibriumResultDataSchema,
  crossGameConstraintTableDataSchema,
  crossGameEffectDataSchema,
  signalClassificationDataSchema,
  bargainingDynamicsDataSchema,
  optionValueAssessmentDataSchema,
  behavioralOverlayDataSchema,
  assumptionDataSchema,
]);

// ── Core Entity ──

export interface AnalysisEntity {
  id: string;
  type: EntityType;
  phase: MethodologyPhase;
  data: EntityData;
  confidence: EntityConfidence;
  /** @deprecated Use provenance.source instead */
  source: EntitySource;
  provenance?: EntityProvenance;
  rationale: string;
  revision: number;
  stale: boolean; // true when downstream of a human edit, pending revalidation
  group?: string; // analytical group label assigned by canvas-service grouping
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
 * - downstream: dependency edges — invalidation propagates along these
 * - evidence: evidentiary links — flag for review but don't auto-stale
 * - structural: symmetric or temporal — never traversed for invalidation
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
  metadata?: Record<string, unknown>;
  source?: EntitySource;
  provenance?: EntityProvenance;
}

// ── Full Analysis ──

export interface Analysis {
  id: string;
  name: string;
  topic: string;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
  phases: PhaseState[];
  centralThesis?: string;
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
