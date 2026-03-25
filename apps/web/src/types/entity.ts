/**
 * Entity types and zod schemas for the game-theory analysis domain.
 *
 * Types are re-exported from @t3tools/contracts (canonical source).
 * Zod schemas remain here for client-side runtime validation.
 */
import { z } from "zod/v4";

// ── Re-export all canonical types from contracts ──

export type {
  EntityConfidence,
  EntitySource,
  EntityProvenance,
  EntityType,
  FactCategory,
  FactData,
  PlayerType,
  PlayerData,
  ObjectivePriority,
  ObjectiveData,
  GameType,
  GameTiming,
  GameData,
  StrategyFeasibility,
  StrategyData,
  PayoffData,
  InstitutionalRuleData,
  EscalationRungData,
  InteractionHistoryData,
  RepeatedGamePatternData,
  TrustAssessmentData,
  DynamicInconsistencyData,
  SignalingEffectData,
  PayoffEstimate,
  PayoffMatrixData,
  GameTreeData,
  EquilibriumType,
  SelectionFactor,
  EquilibriumResultData,
  CrossGameConstraintTableData,
  CrossGameEffectType,
  CrossGameEffectData,
  SignalClassificationData,
  BargainingDynamicsData,
  OptionValueFlexibilityType,
  OptionValueAssessmentData,
  BehavioralOverlayType,
  BehavioralOverlayData,
  AssumptionData,
  EliminatedOutcomeData,
  ScenarioData,
  CentralThesisData,
  MetaCheckData,
  EntityData,
  AnalysisEntity,
  RelationshipType,
  AnalysisRelationship,
  Analysis,
  LayoutState,
  AnalysisFileV3,
  AnalysisFileReference,
  ParseResult,
} from "@t3tools/contracts";

export { RELATIONSHIP_CATEGORY } from "@t3tools/contracts";

// ── Zod schemas (runtime validation, kept local) ──

export const entityConfidenceSchema = z.enum(["high", "medium", "low"]);
export const entitySourceSchema = z.enum(["ai", "human", "computed"]);

// ── Phase 1: Situational Grounding ──

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

// ── Phase 2: Player Identification ──

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

export const objectiveDataSchema = z.object({
  type: z.literal("objective"),
  description: z.string().min(1),
  priority: z.enum(["lexicographic", "high", "tradable"]),
  stability: z.enum(["stable", "shifting", "unknown"]).default("unknown"),
});

// ── Phase 3: Baseline Model ──

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

export const payoffDataSchema = z.object({
  type: z.literal("payoff"),
  rank: z.number().nullable(),
  value: z.number().nullable(),
  rationale: z.string().default(""),
});

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

export const escalationRungDataSchema = z.object({
  type: z.literal("escalation-rung"),
  action: z.string().min(1),
  reversibility: z.enum(["reversible", "partially-reversible", "irreversible"]),
  climbed: z.boolean(),
  order: z.number(),
});

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

export const trustAssessmentDataSchema = z.object({
  type: z.literal("trust-assessment"),
  playerPair: z.tuple([z.string(), z.string()]),
  trustLevel: z.enum(["zero", "low", "moderate", "high"]),
  direction: z.string(),
  evidence: z.string(),
  implication: z.string(),
});

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

export const signalingEffectDataSchema = z.object({
  type: z.literal("signaling-effect"),
  signal: z.string(),
  observers: z.array(z.string()),
  lesson: z.string(),
  reputationEffect: z.string(),
});

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

// ── Phase 8: Elimination ──

const methodologyPhaseEnum = z.enum([
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "revalidation",
  "formal-modeling",
  "assumptions",
  "elimination",
  "scenarios",
  "meta-check",
]);

export const eliminatedOutcomeDataSchema = z.object({
  type: z.literal("eliminated-outcome"),
  description: z.string().min(1),
  traced_reasoning: z.string().min(1),
  source_phase: methodologyPhaseEnum,
  source_entity_ids: z.array(z.string().min(1)).min(1),
});

// ── Phase 9: Scenario Generation ──

export const scenarioDataSchema = z.object({
  type: z.literal("scenario"),
  subtype: z.enum(["baseline", "tail-risk"]),
  narrative: z.string().min(1),
  probability: z.object({
    point: z.number(),
    rangeLow: z.number(),
    rangeHigh: z.number(),
  }),
  key_assumptions: z.array(z.string()),
  invalidation_conditions: z.string().min(1),
  model_basis: z.array(z.string()),
  cross_game_interactions: z.string(),
  prediction_basis: z.enum([
    "equilibrium",
    "discretionary",
    "behavioral-overlay",
  ]),
  // Tail-risk fields (nullable — required only when subtype is "tail-risk")
  trigger: z.string().nullable(),
  why_unlikely: z.string().nullable(),
  consequences: z.string().nullable(),
  drift_trajectory: z.string().nullable(),
});

export const centralThesisDataSchema = z.object({
  type: z.literal("central-thesis"),
  thesis: z.string().min(1),
  falsification_conditions: z.string().min(1),
  supporting_scenarios: z.array(z.string().min(1)).min(1),
});

// ── Phase 10: Meta-Check ──

export const metaCheckQuestionSchema = z.object({
  question_number: z.number().int().min(1).max(10),
  answer: z.string().min(1),
  disruption_trigger_identified: z.boolean(),
});

export const metaCheckDataSchema = z.object({
  type: z.literal("meta-check"),
  questions: z.array(metaCheckQuestionSchema).length(10),
});

// ── Entity Data Schema (discriminated union) ──

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
  eliminatedOutcomeDataSchema,
  scenarioDataSchema,
  centralThesisDataSchema,
  metaCheckDataSchema,
]);
