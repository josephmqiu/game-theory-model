import { z } from "zod/v4";
import type { MethodologyPhase, PhaseState } from "./methodology";

// ── Confidence & Source ──

export type EntityConfidence = "high" | "medium" | "low";
export type EntitySource = "ai" | "human" | "computed";

export const entityConfidenceSchema = z.enum(["high", "medium", "low"]);
export const entitySourceSchema = z.enum(["ai", "human", "computed"]);

// ── Entity Type Enum ──

export type EntityType =
  | "fact"
  | "player"
  | "objective"
  | "game"
  | "strategy"
  | "payoff"
  | "institutional-rule"
  | "escalation-rung";

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

// ── Entity Data Union ──

export type EntityData =
  | FactData
  | PlayerData
  | ObjectiveData
  | GameData
  | StrategyData
  | PayoffData
  | InstitutionalRuleData
  | EscalationRungData;

export const entityDataSchema = z.discriminatedUnion("type", [
  factDataSchema,
  playerDataSchema,
  objectiveDataSchema,
  gameDataSchema,
  strategyDataSchema,
  payoffDataSchema,
  institutionalRuleDataSchema,
  escalationRungDataSchema,
]);

// ── Core Entity ──

export interface AnalysisEntity {
  id: string;
  type: EntityType;
  phase: MethodologyPhase;
  data: EntityData;
  position: { x: number; y: number };
  confidence: EntityConfidence;
  source: EntitySource;
  rationale: string;
  revision: number;
  stale: boolean; // true when downstream of a human edit, pending revalidation
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

export interface AnalysisFileV2 {
  type: "game-theory-analysis";
  version: 2;
  analysis: Analysis;
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
