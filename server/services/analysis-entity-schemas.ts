// analysis-entity-schemas.ts — Zod schemas, phase-entity mappings, and validation
// helpers for analysis entities. Extracted from analysis-service.ts so that
// analysis-tools.ts can validate without circular dependencies.

import { z } from "zod/v4";
import type { MethodologyPhase } from "../../shared/types/methodology";
import { V3_PHASES } from "../../shared/types/methodology";
import type { RelationshipType } from "../../shared/types/entity";
import {
  entityConfidenceSchema,
  factDataSchema,
  playerDataSchema,
  objectiveDataSchema,
  gameDataSchema,
  strategyDataSchema,
  interactionHistoryDataSchema,
  repeatedGamePatternDataSchema,
  trustAssessmentDataSchema,
  dynamicInconsistencyDataSchema,
  signalingEffectDataSchema,
  assumptionDataSchema,
  payoffMatrixDataSchema,
  gameTreeDataSchema,
  equilibriumResultDataSchema,
  crossGameConstraintTableDataSchema,
  crossGameEffectDataSchema,
  signalClassificationDataSchema,
  bargainingDynamicsDataSchema,
  optionValueAssessmentDataSchema,
  behavioralOverlayDataSchema,
  eliminatedOutcomeDataSchema,
  scenarioDataSchema,
  centralThesisDataSchema,
  metaCheckDataSchema,
} from "../../src/types/entity";

// ── Supported phase types ──

export type SupportedPhase = Extract<
  MethodologyPhase,
  | "situational-grounding"
  | "player-identification"
  | "baseline-model"
  | "historical-game"
  | "formal-modeling"
  | "assumptions"
  | "elimination"
  | "scenarios"
  | "meta-check"
>;

const SUPPORTED_PHASES: SupportedPhase[] = V3_PHASES.filter(
  (p): p is SupportedPhase =>
    p === "situational-grounding" ||
    p === "player-identification" ||
    p === "baseline-model" ||
    p === "historical-game" ||
    p === "formal-modeling" ||
    p === "assumptions" ||
    p === "elimination" ||
    p === "scenarios" ||
    p === "meta-check",
);

export function isSupportedPhase(
  phase: MethodologyPhase,
): phase is SupportedPhase {
  return (SUPPORTED_PHASES as string[]).includes(phase);
}

// ── Zod entity schemas ──

const baseEntityFields = {
  id: z.string().min(1).nullable(),
  ref: z.string().min(1),
  confidence: entityConfidenceSchema,
  rationale: z.string(),
};

export const factEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("fact"),
  phase: z.literal("situational-grounding"),
  data: factDataSchema,
});

export const playerEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("player"),
  phase: z.literal("player-identification"),
  data: playerDataSchema,
});

export const objectiveEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("objective"),
  phase: z.literal("player-identification"),
  data: objectiveDataSchema,
});

export const gameEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("game"),
  phase: z.literal("baseline-model"),
  data: gameDataSchema,
});

export const strategyEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("strategy"),
  phase: z.literal("baseline-model"),
  data: strategyDataSchema,
});

export const interactionHistoryEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("interaction-history"),
  phase: z.literal("historical-game"),
  data: interactionHistoryDataSchema,
});

export const repeatedGamePatternEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("repeated-game-pattern"),
  phase: z.literal("historical-game"),
  data: repeatedGamePatternDataSchema,
});

export const trustAssessmentEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("trust-assessment"),
  phase: z.literal("historical-game"),
  data: trustAssessmentDataSchema,
});

export const dynamicInconsistencyEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("dynamic-inconsistency"),
  phase: z.literal("historical-game"),
  data: dynamicInconsistencyDataSchema,
});

export const signalingEffectEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("signaling-effect"),
  phase: z.literal("historical-game"),
  data: signalingEffectDataSchema,
});

export const assumptionEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("assumption"),
  phase: z.literal("assumptions"),
  data: assumptionDataSchema,
});

export const eliminatedOutcomeEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("eliminated-outcome"),
  phase: z.literal("elimination"),
  data: eliminatedOutcomeDataSchema,
});

export const scenarioEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("scenario"),
  phase: z.literal("scenarios"),
  data: scenarioDataSchema,
});

export const centralThesisEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("central-thesis"),
  phase: z.literal("scenarios"),
  data: centralThesisDataSchema,
});

export const metaCheckEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("meta-check"),
  phase: z.literal("meta-check"),
  data: metaCheckDataSchema,
});

export const payoffMatrixEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("payoff-matrix"),
  phase: z.literal("formal-modeling"),
  data: payoffMatrixDataSchema,
});

export const gameTreeEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("game-tree"),
  phase: z.literal("formal-modeling"),
  data: gameTreeDataSchema,
});

export const equilibriumResultEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("equilibrium-result"),
  phase: z.literal("formal-modeling"),
  data: equilibriumResultDataSchema,
});

export const crossGameConstraintTableEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("cross-game-constraint-table"),
  phase: z.literal("formal-modeling"),
  data: crossGameConstraintTableDataSchema,
});

export const crossGameEffectEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("cross-game-effect"),
  phase: z.literal("formal-modeling"),
  data: crossGameEffectDataSchema,
});

export const signalClassificationEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("signal-classification"),
  phase: z.literal("formal-modeling"),
  data: signalClassificationDataSchema,
});

export const bargainingDynamicsEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("bargaining-dynamics"),
  phase: z.literal("formal-modeling"),
  data: bargainingDynamicsDataSchema,
});

export const optionValueAssessmentEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("option-value-assessment"),
  phase: z.literal("formal-modeling"),
  data: optionValueAssessmentDataSchema,
});

export const behavioralOverlayEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("behavioral-overlay"),
  phase: z.literal("formal-modeling"),
  data: behavioralOverlayDataSchema,
});

// ── Relationship schema ──

export const relationshipTypeSchema = z.enum([
  "plays-in",
  "has-objective",
  "conflicts-with",
  "has-strategy",
  "supports",
  "contradicts",
  "produces",
  "depends-on",
  "invalidated-by",
  "constrains",
  "escalates-to",
  "links",
  "precedes",
  "informed-by",
  "derived-from",
]);

export const relationshipSchema = z.object({
  id: z.string().min(1),
  type: relationshipTypeSchema,
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Phase-entity mappings ──

/** Entity Zod schemas accepted per phase */
export const PHASE_ENTITY_SCHEMAS: Record<SupportedPhase, z.ZodType[]> = {
  "situational-grounding": [factEntitySchema],
  "player-identification": [playerEntitySchema, objectiveEntitySchema],
  "baseline-model": [gameEntitySchema, strategyEntitySchema],
  "historical-game": [
    interactionHistoryEntitySchema,
    repeatedGamePatternEntitySchema,
    trustAssessmentEntitySchema,
    dynamicInconsistencyEntitySchema,
    signalingEffectEntitySchema,
  ],
  "formal-modeling": [
    payoffMatrixEntitySchema,
    gameTreeEntitySchema,
    equilibriumResultEntitySchema,
    crossGameConstraintTableEntitySchema,
    crossGameEffectEntitySchema,
    signalClassificationEntitySchema,
    bargainingDynamicsEntitySchema,
    optionValueAssessmentEntitySchema,
    behavioralOverlayEntitySchema,
  ],
  assumptions: [assumptionEntitySchema],
  elimination: [eliminatedOutcomeEntitySchema],
  scenarios: [scenarioEntitySchema, centralThesisEntitySchema],
  "meta-check": [metaCheckEntitySchema],
};

/** Allowed entity type strings per phase */
export const PHASE_ENTITY_TYPES: Record<SupportedPhase, string[]> = {
  "situational-grounding": ["fact"],
  "player-identification": ["player", "objective"],
  "baseline-model": ["game", "strategy"],
  "historical-game": [
    "interaction-history",
    "repeated-game-pattern",
    "trust-assessment",
    "dynamic-inconsistency",
    "signaling-effect",
  ],
  "formal-modeling": [
    "payoff-matrix",
    "game-tree",
    "equilibrium-result",
    "cross-game-constraint-table",
    "cross-game-effect",
    "signal-classification",
    "bargaining-dynamics",
    "option-value-assessment",
    "behavioral-overlay",
  ],
  assumptions: ["assumption"],
  elimination: ["eliminated-outcome"],
  scenarios: ["scenario", "central-thesis"],
  "meta-check": ["meta-check"],
};

// ── Output types ──

export type PhaseOutputEntity =
  | z.infer<typeof factEntitySchema>
  | z.infer<typeof playerEntitySchema>
  | z.infer<typeof objectiveEntitySchema>
  | z.infer<typeof gameEntitySchema>
  | z.infer<typeof strategyEntitySchema>
  | z.infer<typeof interactionHistoryEntitySchema>
  | z.infer<typeof repeatedGamePatternEntitySchema>
  | z.infer<typeof trustAssessmentEntitySchema>
  | z.infer<typeof dynamicInconsistencyEntitySchema>
  | z.infer<typeof signalingEffectEntitySchema>
  | z.infer<typeof assumptionEntitySchema>
  | z.infer<typeof payoffMatrixEntitySchema>
  | z.infer<typeof gameTreeEntitySchema>
  | z.infer<typeof equilibriumResultEntitySchema>
  | z.infer<typeof crossGameConstraintTableEntitySchema>
  | z.infer<typeof crossGameEffectEntitySchema>
  | z.infer<typeof signalClassificationEntitySchema>
  | z.infer<typeof bargainingDynamicsEntitySchema>
  | z.infer<typeof optionValueAssessmentEntitySchema>
  | z.infer<typeof behavioralOverlayEntitySchema>
  | z.infer<typeof eliminatedOutcomeEntitySchema>
  | z.infer<typeof scenarioEntitySchema>
  | z.infer<typeof centralThesisEntitySchema>
  | z.infer<typeof metaCheckEntitySchema>;

export interface PhaseOutputRelationship {
  id: string;
  type: RelationshipType;
  fromEntityId: string;
  toEntityId: string;
  metadata?: Record<string, unknown>;
}

// ── Validation helpers ──

/**
 * Try each schema in order; return the first successful parse.
 * On total failure, return the first schema's error for diagnostics.
 */
export function validateEntity(
  value: unknown,
  schemas: z.ZodType[],
):
  | { success: true; data: PhaseOutputEntity }
  | { success: false; error: z.ZodError } {
  if (schemas.length === 0) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "custom",
          message: "No schemas available for validation",
          path: [],
        },
      ]),
    };
  }
  for (const schema of schemas) {
    const result = schema.safeParse(value);
    if (result.success) {
      return { success: true, data: result.data as PhaseOutputEntity };
    }
  }
  const fallback = schemas[0].safeParse(value);
  return { success: false, error: fallback.error! };
}

/**
 * Phase-specific invariant checks run at phase completion.
 * Extensible per-phase structural requirements.
 */
export function validatePhaseInvariants(
  phase: SupportedPhase,
  entities: Array<{ type: string; data: Record<string, unknown> }>,
): { success: true } | { success: false; error: string } {
  if (phase === "player-identification") {
    const players = entities.filter((e) => e.type === "player");
    if (players.length === 0) {
      return {
        success: false,
        error:
          "Player identification phase requires at least one player entity",
      };
    }
  }

  if (phase === "meta-check") {
    const metaChecks = entities.filter((e) => e.type === "meta-check");
    if (metaChecks.length !== 1) {
      return {
        success: false,
        error: `Meta-check phase requires exactly one meta-check entity, found ${metaChecks.length}`,
      };
    }
  }

  if (phase === "scenarios") {
    const scenarios = entities.filter((e) => e.type === "scenario");
    if (scenarios.length > 0) {
      const sum = scenarios.reduce((acc, e) => {
        const data = e.data as { probability: { point: number } };
        return acc + (data.probability?.point ?? 0);
      }, 0);
      if (sum < 95 || sum > 105) {
        return {
          success: false,
          error: `Scenario probabilities sum to ${sum.toFixed(1)}%, expected 95-105%`,
        };
      }
    }
  }
  return { success: true };
}
