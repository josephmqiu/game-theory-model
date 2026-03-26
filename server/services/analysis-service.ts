// analysis-service.ts — per-phase execution engine.
// Absorbs prompt building and response parsing (phase-worker.ts).
// Calls the active adapter's runAnalysisPhase() for structured output,
// with fallback to text parsing for backward compatibility.
//
// Does NOT own retries, sequencing, or run lifecycle — that's the orchestrator's job.

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
import { createRunLogger } from "../utils/ai-logger";
import type { RunLogger } from "../utils/ai-logger";
import type { AnalysisActivityCallback } from "./ai/analysis-activity";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import type { PromptPackToolPolicy } from "../../shared/types/prompt-pack";
import type { RuntimeAdapter } from "./ai/adapter-contract";
import { loadRuntimeAdapter } from "./ai/adapter-loader";
import { buildPhasePromptBundle } from "./analysis-prompt-provenance";
import { getProviderSessionBinding } from "./workspace";

async function loadAnalysisAdapter(provider?: string): Promise<RuntimeAdapter> {
  return loadRuntimeAdapter({
    provider,
    testStubLabel: "test-adapter-session",
    supportsChatTurns: false,
    forwardActivity: true,
  });
}

// ── Public types ──

export interface PhaseResult {
  success: boolean;
  entities: PhaseOutputEntity[];
  relationships: PhaseOutputRelationship[];
  error?: string;
}

interface PhaseRuntimeContext {
  webSearch: boolean;
  effortLevel: AnalysisEffortLevel;
}

export interface PhaseContext {
  workspaceId?: string;
  threadId?: string;
  phaseBrief?: string;
  revisionRetryInstruction?: string;
  revisionSystemPrompt?: string;
  provider?: string;
  model?: string;
  runtime?: PhaseRuntimeContext;
  runId?: string;
  phaseTurnId?: string;
  signal?: AbortSignal;
  logger?: RunLogger;
  onActivity?: AnalysisActivityCallback;
  /** Pre-built prompts from the orchestrator. Skips redundant buildPhasePromptBundle call. */
  promptBundle?: {
    system: string;
    user: string;
    toolPolicy?: PromptPackToolPolicy;
  };
}

// ── Supported phase types ──

type SupportedPhase = Extract<
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

function isSupportedPhase(phase: MethodologyPhase): phase is SupportedPhase {
  return (SUPPORTED_PHASES as string[]).includes(phase);
}

// ── Zod schemas (ported from phase-worker.ts) ──

const baseEntityFields = {
  id: z.string().min(1).nullable(),
  ref: z.string().min(1),
  confidence: entityConfidenceSchema,
  rationale: z.string(),
};

const factEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("fact"),
  phase: z.literal("situational-grounding"),
  data: factDataSchema,
});

const playerEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("player"),
  phase: z.literal("player-identification"),
  data: playerDataSchema,
});

const objectiveEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("objective"),
  phase: z.literal("player-identification"),
  data: objectiveDataSchema,
});

const gameEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("game"),
  phase: z.literal("baseline-model"),
  data: gameDataSchema,
});

const strategyEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("strategy"),
  phase: z.literal("baseline-model"),
  data: strategyDataSchema,
});

const interactionHistoryEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("interaction-history"),
  phase: z.literal("historical-game"),
  data: interactionHistoryDataSchema,
});

const repeatedGamePatternEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("repeated-game-pattern"),
  phase: z.literal("historical-game"),
  data: repeatedGamePatternDataSchema,
});

const trustAssessmentEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("trust-assessment"),
  phase: z.literal("historical-game"),
  data: trustAssessmentDataSchema,
});

const dynamicInconsistencyEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("dynamic-inconsistency"),
  phase: z.literal("historical-game"),
  data: dynamicInconsistencyDataSchema,
});

const signalingEffectEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("signaling-effect"),
  phase: z.literal("historical-game"),
  data: signalingEffectDataSchema,
});

const assumptionEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("assumption"),
  phase: z.literal("assumptions"),
  data: assumptionDataSchema,
});

const eliminatedOutcomeEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("eliminated-outcome"),
  phase: z.literal("elimination"),
  data: eliminatedOutcomeDataSchema,
});

const scenarioEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("scenario"),
  phase: z.literal("scenarios"),
  data: scenarioDataSchema,
});

const centralThesisEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("central-thesis"),
  phase: z.literal("scenarios"),
  data: centralThesisDataSchema,
});

const metaCheckEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("meta-check"),
  phase: z.literal("meta-check"),
  data: metaCheckDataSchema,
});

const payoffMatrixEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("payoff-matrix"),
  phase: z.literal("formal-modeling"),
  data: payoffMatrixDataSchema,
});

const gameTreeEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("game-tree"),
  phase: z.literal("formal-modeling"),
  data: gameTreeDataSchema,
});

const equilibriumResultEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("equilibrium-result"),
  phase: z.literal("formal-modeling"),
  data: equilibriumResultDataSchema,
});

const crossGameConstraintTableEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("cross-game-constraint-table"),
  phase: z.literal("formal-modeling"),
  data: crossGameConstraintTableDataSchema,
});

const crossGameEffectEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("cross-game-effect"),
  phase: z.literal("formal-modeling"),
  data: crossGameEffectDataSchema,
});

const signalClassificationEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("signal-classification"),
  phase: z.literal("formal-modeling"),
  data: signalClassificationDataSchema,
});

const bargainingDynamicsEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("bargaining-dynamics"),
  phase: z.literal("formal-modeling"),
  data: bargainingDynamicsDataSchema,
});

const optionValueAssessmentEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("option-value-assessment"),
  phase: z.literal("formal-modeling"),
  data: optionValueAssessmentDataSchema,
});

const behavioralOverlayEntitySchema = z.object({
  ...baseEntityFields,
  type: z.literal("behavioral-overlay"),
  phase: z.literal("formal-modeling"),
  data: behavioralOverlayDataSchema,
});

const relationshipTypeSchema = z.enum([
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

const relationshipSchema = z.object({
  id: z.string().min(1),
  type: relationshipTypeSchema,
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Entity schemas accepted per phase */
const PHASE_ENTITY_SCHEMAS: Record<SupportedPhase, z.ZodType[]> = {
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

// ── JSON extraction (ported from phase-worker.ts) ──

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;
const TRAILING_COMMA_PATTERN = /,\s*([}\]])/g;

function trimJsonLike(text: string): string {
  const fenced = text.match(JSON_FENCE_PATTERN);
  const candidate = fenced?.[1] ?? text;
  return candidate.trim().replace(TRAILING_COMMA_PATTERN, "$1");
}

// ── Validation helpers ──

function validateEntity(
  value: unknown,
  schemas: z.ZodType[],
):
  | { success: true; data: PhaseOutputEntity }
  | { success: false; error: z.ZodError } {
  for (const schema of schemas) {
    const result = schema.safeParse(value);
    if (result.success) {
      return { success: true, data: result.data as PhaseOutputEntity };
    }
  }
  // Return the first schema's error for diagnostics
  const fallback = schemas[0].safeParse(value);
  return { success: false, error: fallback.error! };
}

/**
 * Validate and extract entities + relationships from a parsed JSON object.
 * Shared between structured output and text-parsing fallback paths.
 */
function validatePhaseOutput(
  parsed: unknown,
  phase: SupportedPhase,
): PhaseResult {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Response is not a JSON object",
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.entities)) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: 'Missing "entities" array',
    };
  }

  if (!Array.isArray(obj.relationships)) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: 'Missing "relationships" array',
    };
  }

  const entitySchemas = PHASE_ENTITY_SCHEMAS[phase];

  // Validate entities
  const entities: PhaseOutputEntity[] = [];
  for (const [i, raw] of (obj.entities as unknown[]).entries()) {
    const result = validateEntity(raw, entitySchemas);
    if (!result.success) {
      const msg = result.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ");
      return {
        success: false,
        entities: [],
        relationships: [],
        error: `Entity ${i}: ${msg}`,
      };
    }
    entities.push(result.data);
  }

  // Validate relationships
  const relationships: PhaseOutputRelationship[] = [];
  for (const [i, raw] of (obj.relationships as unknown[]).entries()) {
    const result = relationshipSchema.safeParse(raw);
    if (!result.success) {
      const msg = result.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("; ");
      return {
        success: false,
        entities: [],
        relationships: [],
        error: `Relationship ${i}: ${msg}`,
      };
    }
    relationships.push(result.data);
  }

  // Phase-specific validation: scenario probability sum
  if (phase === "scenarios") {
    const scenarios = entities.filter((e) => e.type === "scenario");
    if (scenarios.length > 0) {
      const sum = scenarios.reduce((acc, e) => {
        const data = e.data as { probability: { point: number } };
        return acc + data.probability.point;
      }, 0);
      if (sum < 95 || sum > 105) {
        return {
          success: false,
          entities: [],
          relationships: [],
          error: `Scenario probabilities sum to ${sum.toFixed(1)}%, expected 95-105%`,
        };
      }
    }
  }

  return { success: true, entities, relationships };
}

// ── Text-based fallback parsing (ported from phase-worker.ts) ──

function parseTextResponse(raw: string, phase: SupportedPhase): PhaseResult {
  const trimmed = trimJsonLike(raw);
  if (!trimmed) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Empty response",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Invalid JSON in response",
    };
  }

  return validatePhaseOutput(parsed, phase);
}

// ── JSON Schema for structured output ──

const BASE_ENTITY_SCHEMA = {
  id: { type: ["string", "null"] },
  ref: { type: "string" },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  rationale: { type: "string" },
} as const;

const FACT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["fact"] },
    phase: { type: "string", enum: ["situational-grounding"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["fact"] },
        date: { type: "string" },
        source: { type: "string" },
        content: { type: "string" },
        category: {
          type: "string",
          enum: [
            "capability",
            "economic",
            "position",
            "impact",
            "action",
            "rule",
          ],
        },
      },
      required: ["type", "date", "source", "content", "category"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const PLAYER_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["player"] },
    phase: { type: "string", enum: ["player-identification"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["player"] },
        name: { type: "string" },
        playerType: {
          type: "string",
          enum: [
            "primary",
            "involuntary",
            "background",
            "internal",
            "gatekeeper",
          ],
        },
        knowledge: { type: "array", items: { type: "string" } },
      },
      required: ["type", "name", "playerType"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const OBJECTIVE_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["objective"] },
    phase: { type: "string", enum: ["player-identification"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["objective"] },
        description: { type: "string" },
        priority: {
          type: "string",
          enum: ["lexicographic", "high", "tradable"],
        },
        stability: {
          type: "string",
          enum: ["stable", "shifting", "unknown"],
        },
      },
      required: ["type", "description", "priority"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const GAME_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["game"] },
    phase: { type: "string", enum: ["baseline-model"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["game"] },
        name: { type: "string" },
        gameType: {
          type: "string",
          enum: [
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
          ],
        },
        timing: {
          type: "string",
          enum: ["simultaneous", "sequential", "repeated"],
        },
        description: { type: "string" },
      },
      required: ["type", "name", "gameType", "timing"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const STRATEGY_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["strategy"] },
    phase: { type: "string", enum: ["baseline-model"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["strategy"] },
        name: { type: "string" },
        feasibility: {
          type: "string",
          enum: [
            "actual",
            "requires-new-capability",
            "rhetoric-only",
            "dominated",
          ],
        },
        description: { type: "string" },
      },
      required: ["type", "name", "feasibility"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const INTERACTION_HISTORY_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["interaction-history"] },
    phase: { type: "string", enum: ["historical-game"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["interaction-history"] },
        playerPair: { type: "array", items: { type: "string" } },
        moves: {
          type: "array",
          items: {
            type: "object",
            properties: {
              actor: { type: "string" },
              action: {
                type: "string",
                enum: [
                  "cooperation",
                  "defection",
                  "punishment",
                  "concession",
                  "delay",
                ],
              },
              description: { type: "string" },
              date: { type: "string" },
              otherSideAction: { type: "string" },
              outcome: { type: "string" },
              beliefChange: { type: "string" },
            },
            required: [
              "actor",
              "action",
              "description",
              "date",
              "otherSideAction",
              "outcome",
              "beliefChange",
            ],
          },
        },
        timespan: { type: "string" },
      },
      required: ["type", "playerPair", "moves", "timespan"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const REPEATED_GAME_PATTERN_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["repeated-game-pattern"] },
    phase: { type: "string", enum: ["historical-game"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["repeated-game-pattern"] },
        patternType: {
          type: "string",
          enum: [
            "tit-for-tat",
            "grim-trigger",
            "selective-forgiveness",
            "dual-track-deception",
            "adverse-selection",
            "defection-during-cooperation",
          ],
        },
        description: { type: "string" },
        evidence: { type: "string" },
        frequency: { type: "string" },
      },
      required: ["type", "patternType", "description", "evidence", "frequency"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const TRUST_ASSESSMENT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["trust-assessment"] },
    phase: { type: "string", enum: ["historical-game"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["trust-assessment"] },
        playerPair: { type: "array", items: { type: "string" } },
        trustLevel: {
          type: "string",
          enum: ["zero", "low", "moderate", "high"],
        },
        direction: { type: "string" },
        evidence: { type: "string" },
        implication: { type: "string" },
      },
      required: [
        "type",
        "playerPair",
        "trustLevel",
        "direction",
        "evidence",
        "implication",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const DYNAMIC_INCONSISTENCY_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["dynamic-inconsistency"] },
    phase: { type: "string", enum: ["historical-game"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["dynamic-inconsistency"] },
        commitment: { type: "string" },
        institutionalForm: {
          type: "string",
          enum: [
            "treaty-ratified",
            "legislation",
            "executive-order",
            "executive-discretion",
            "bureaucratic-lock-in",
            "informal-agreement",
          ],
        },
        durability: {
          type: "string",
          enum: ["durable", "fragile", "transitional"],
        },
        transitionRisk: { type: "string" },
        timeHorizon: { type: "string" },
      },
      required: [
        "type",
        "commitment",
        "institutionalForm",
        "durability",
        "transitionRisk",
        "timeHorizon",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const SIGNALING_EFFECT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["signaling-effect"] },
    phase: { type: "string", enum: ["historical-game"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["signaling-effect"] },
        signal: { type: "string" },
        observers: { type: "array", items: { type: "string" } },
        lesson: { type: "string" },
        reputationEffect: { type: "string" },
      },
      required: ["type", "signal", "observers", "lesson", "reputationEffect"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const ASSUMPTION_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["assumption"] },
    phase: { type: "string", enum: ["assumptions"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["assumption"] },
        description: { type: "string" },
        sensitivity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
        },
        category: {
          type: "string",
          enum: [
            "behavioral",
            "capability",
            "structural",
            "institutional",
            "rationality",
            "information",
          ],
        },
        classification: {
          type: "string",
          enum: ["game-theoretic", "empirical"],
        },
        correlatedClusterId: { type: ["string", "null"] },
        rationale: { type: "string" },
        dependencies: { type: "array", items: { type: "string" } },
      },
      required: [
        "type",
        "description",
        "sensitivity",
        "category",
        "classification",
        "correlatedClusterId",
        "rationale",
        "dependencies",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const PAYOFF_ESTIMATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    player: { type: "string" },
    ordinalRank: { type: "number" },
    cardinalValue: { type: ["number", "null"] },
    rangeLow: { type: "number" },
    rangeHigh: { type: "number" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rationale: { type: "string" },
    dependencies: { type: "array", items: { type: "string" } },
  },
  required: [
    "player",
    "ordinalRank",
    "cardinalValue",
    "rangeLow",
    "rangeHigh",
    "confidence",
    "rationale",
    "dependencies",
  ],
};

const PAYOFF_MATRIX_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["payoff-matrix"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["payoff-matrix"] },
        gameName: { type: "string" },
        players: { type: "array", items: { type: "string" } },
        strategies: {
          type: "object",
          properties: {
            row: { type: "array", items: { type: "string" } },
            column: { type: "array", items: { type: "string" } },
          },
          required: ["row", "column"],
        },
        cells: {
          type: "array",
          items: {
            type: "object",
            properties: {
              row: { type: "string" },
              column: { type: "string" },
              payoffs: {
                type: "array",
                items: PAYOFF_ESTIMATE_JSON_SCHEMA,
              },
            },
            required: ["row", "column", "payoffs"],
          },
        },
      },
      required: ["type", "gameName", "players", "strategies", "cells"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const GAME_TREE_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["game-tree"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["game-tree"] },
        gameName: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              player: { type: ["string", "null"] },
              nodeType: {
                type: "string",
                enum: ["decision", "chance", "terminal"],
              },
              informationSet: { type: ["string", "null"] },
            },
            required: ["nodeId", "player", "nodeType", "informationSet"],
          },
        },
        branches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromNodeId: { type: "string" },
              toNodeId: { type: "string" },
              action: { type: "string" },
              probability: { type: ["number", "null"] },
            },
            required: ["fromNodeId", "toNodeId", "action", "probability"],
          },
        },
        informationSets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              setId: { type: "string" },
              player: { type: "string" },
              nodeIds: { type: "array", items: { type: "string" } },
              description: { type: "string" },
            },
            required: ["setId", "player", "nodeIds", "description"],
          },
        },
        terminalPayoffs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              payoffs: {
                type: "array",
                items: PAYOFF_ESTIMATE_JSON_SCHEMA,
              },
            },
            required: ["nodeId", "payoffs"],
          },
        },
      },
      required: [
        "type",
        "gameName",
        "nodes",
        "branches",
        "informationSets",
        "terminalPayoffs",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const EQUILIBRIUM_RESULT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["equilibrium-result"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["equilibrium-result"] },
        gameName: { type: "string" },
        equilibriumType: {
          type: "string",
          enum: [
            "dominant-strategy",
            "nash",
            "subgame-perfect",
            "bayesian-nash",
            "separating",
            "pooling",
            "semi-separating",
          ],
        },
        description: { type: "string" },
        strategies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              player: { type: "string" },
              strategy: { type: "string" },
            },
            required: ["player", "strategy"],
          },
        },
        selectionFactors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              factor: {
                type: "string",
                enum: [
                  "path-dependence",
                  "focal-points",
                  "commitment-devices",
                  "institutional-rules",
                  "salient-narratives",
                  "relative-cost-of-swerving",
                ],
              },
              evidence: { type: "string" },
              weight: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["factor", "evidence", "weight"],
          },
        },
      },
      required: [
        "type",
        "gameName",
        "equilibriumType",
        "description",
        "strategies",
        "selectionFactors",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const CROSS_GAME_CONSTRAINT_TABLE_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["cross-game-constraint-table"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["cross-game-constraint-table"] },
        strategies: { type: "array", items: { type: "string" } },
        games: { type: "array", items: { type: "string" } },
        cells: {
          type: "array",
          items: {
            type: "object",
            properties: {
              strategy: { type: "string" },
              game: { type: "string" },
              result: {
                type: "string",
                enum: ["pass", "fail", "uncertain"],
              },
              reasoning: { type: "string" },
            },
            required: ["strategy", "game", "result", "reasoning"],
          },
        },
      },
      required: ["type", "strategies", "games", "cells"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const CROSS_GAME_EFFECT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["cross-game-effect"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["cross-game-effect"] },
        sourceGame: { type: "string" },
        targetGame: { type: "string" },
        trigger: { type: "string" },
        effectType: {
          type: "string",
          enum: [
            "payoff-shift",
            "belief-update",
            "strategy-unlock",
            "strategy-elimination",
            "player-entry",
            "player-exit",
            "commitment-change",
            "resource-transfer",
            "timing-change",
          ],
        },
        magnitude: { type: "string" },
        direction: { type: "string" },
        cascade: { type: "boolean" },
      },
      required: [
        "type",
        "sourceGame",
        "targetGame",
        "trigger",
        "effectType",
        "magnitude",
        "direction",
        "cascade",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const SIGNAL_CLASSIFICATION_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["signal-classification"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["signal-classification"] },
        action: { type: "string" },
        player: { type: "string" },
        classification: {
          type: "string",
          enum: ["cheap-talk", "costly-signal", "audience-cost"],
        },
        cheapTalkConditions: {
          anyOf: [
            {
              type: "object",
              properties: {
                interestsAligned: { type: "boolean" },
                reputationalCapital: { type: "boolean" },
                verifiable: { type: "boolean" },
                repeatedGameMakesLyingCostly: { type: "boolean" },
              },
              required: [
                "interestsAligned",
                "reputationalCapital",
                "verifiable",
                "repeatedGameMakesLyingCostly",
              ],
            },
            { type: "null" },
          ],
        },
        credibility: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: [
        "type",
        "action",
        "player",
        "classification",
        "cheapTalkConditions",
        "credibility",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const BARGAINING_DYNAMICS_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["bargaining-dynamics"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bargaining-dynamics"] },
        negotiation: { type: "string" },
        outsideOptions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              player: { type: "string" },
              option: { type: "string" },
              quality: {
                type: "string",
                enum: ["strong", "moderate", "weak"],
              },
            },
            required: ["player", "option", "quality"],
          },
        },
        patience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              player: { type: "string" },
              discountFactor: { type: "string" },
              pressures: { type: "array", items: { type: "string" } },
            },
            required: ["player", "discountFactor", "pressures"],
          },
        },
        deadlines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              date: { type: ["string", "null"] },
              affectsPlayer: { type: "string" },
            },
            required: ["description", "date", "affectsPlayer"],
          },
        },
        commitmentProblems: { type: "array", items: { type: "string" } },
        dynamicInconsistency: { type: ["string", "null"] },
        issueLinkage: {
          type: "array",
          items: {
            type: "object",
            properties: {
              linkedGame: { type: "string" },
              description: { type: "string" },
            },
            required: ["linkedGame", "description"],
          },
        },
      },
      required: [
        "type",
        "negotiation",
        "outsideOptions",
        "patience",
        "deadlines",
        "commitmentProblems",
        "dynamicInconsistency",
        "issueLinkage",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const OPTION_VALUE_ASSESSMENT_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["option-value-assessment"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["option-value-assessment"] },
        player: { type: "string" },
        action: { type: "string" },
        flexibilityPreserved: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "escalation-flexibility",
                  "avoiding-irreversible-commitment",
                  "waiting-for-information",
                  "letting-constraints-tighten",
                ],
              },
              description: { type: "string" },
            },
            required: ["type", "description"],
          },
        },
        uncertaintyLevel: {
          type: "string",
          enum: ["high", "medium", "low"],
        },
      },
      required: [
        "type",
        "player",
        "action",
        "flexibilityPreserved",
        "uncertaintyLevel",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const BEHAVIORAL_OVERLAY_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["behavioral-overlay"] },
    phase: { type: "string", enum: ["formal-modeling"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["behavioral-overlay"] },
        classification: { type: "string", enum: ["adjacent"] },
        overlayType: {
          type: "string",
          enum: [
            "prospect-theory",
            "overconfidence",
            "sunk-cost",
            "groupthink",
            "anchoring",
            "honor-based-escalation",
            "reference-dependence",
            "scenario-planning",
            "red-teaming",
          ],
        },
        description: { type: "string" },
        affectedPlayers: { type: "array", items: { type: "string" } },
        referencePoint: { type: ["string", "null"] },
        predictionModification: { type: "string" },
      },
      required: [
        "type",
        "classification",
        "overlayType",
        "description",
        "affectedPlayers",
        "referencePoint",
        "predictionModification",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const ELIMINATED_OUTCOME_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["eliminated-outcome"] },
    phase: { type: "string", enum: ["elimination"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["eliminated-outcome"] },
        description: { type: "string" },
        traced_reasoning: { type: "string" },
        source_phase: {
          type: "string",
          enum: [
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
          ],
        },
        source_entity_ids: { type: "array", items: { type: "string" } },
      },
      required: [
        "type",
        "description",
        "traced_reasoning",
        "source_phase",
        "source_entity_ids",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const SCENARIO_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["scenario"] },
    phase: { type: "string", enum: ["scenarios"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["scenario"] },
        subtype: { type: "string", enum: ["baseline", "tail-risk"] },
        narrative: { type: "string" },
        probability: {
          type: "object",
          properties: {
            point: { type: "number" },
            rangeLow: { type: "number" },
            rangeHigh: { type: "number" },
          },
          required: ["point", "rangeLow", "rangeHigh"],
        },
        key_assumptions: { type: "array", items: { type: "string" } },
        invalidation_conditions: { type: "string" },
        model_basis: { type: "array", items: { type: "string" } },
        cross_game_interactions: { type: "string" },
        prediction_basis: {
          type: "string",
          enum: ["equilibrium", "discretionary", "behavioral-overlay"],
        },
        trigger: { type: ["string", "null"] },
        why_unlikely: { type: ["string", "null"] },
        consequences: { type: ["string", "null"] },
        drift_trajectory: { type: ["string", "null"] },
      },
      required: [
        "type",
        "subtype",
        "narrative",
        "probability",
        "key_assumptions",
        "invalidation_conditions",
        "model_basis",
        "cross_game_interactions",
        "prediction_basis",
        "trigger",
        "why_unlikely",
        "consequences",
        "drift_trajectory",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const CENTRAL_THESIS_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["central-thesis"] },
    phase: { type: "string", enum: ["scenarios"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["central-thesis"] },
        thesis: { type: "string" },
        falsification_conditions: { type: "string" },
        supporting_scenarios: { type: "array", items: { type: "string" } },
      },
      required: [
        "type",
        "thesis",
        "falsification_conditions",
        "supporting_scenarios",
      ],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const META_CHECK_ENTITY_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_ENTITY_SCHEMA,
    type: { type: "string", enum: ["meta-check"] },
    phase: { type: "string", enum: ["meta-check"] },
    data: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["meta-check"] },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_number: { type: "number" },
              answer: { type: "string" },
              disruption_trigger_identified: { type: "boolean" },
            },
            required: [
              "question_number",
              "answer",
              "disruption_trigger_identified",
            ],
          },
        },
      },
      required: ["type", "questions"],
    },
  },
  required: ["id", "ref", "type", "phase", "data", "confidence", "rationale"],
};

const RELATIONSHIP_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: {
      type: "string",
      enum: [
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
      ],
    },
    fromEntityId: { type: "string" },
    toEntityId: { type: "string" },
    metadata: { type: "object" },
  },
  required: ["id", "type", "fromEntityId", "toEntityId"],
};

/** Entity schemas per phase for structured output */
const PHASE_ENTITY_JSON_SCHEMAS: Record<
  SupportedPhase,
  Record<string, unknown>[]
> = {
  "situational-grounding": [FACT_ENTITY_SCHEMA],
  "player-identification": [PLAYER_ENTITY_SCHEMA, OBJECTIVE_ENTITY_SCHEMA],
  "baseline-model": [GAME_ENTITY_SCHEMA, STRATEGY_ENTITY_SCHEMA],
  "historical-game": [
    INTERACTION_HISTORY_ENTITY_SCHEMA,
    REPEATED_GAME_PATTERN_ENTITY_SCHEMA,
    TRUST_ASSESSMENT_ENTITY_SCHEMA,
    DYNAMIC_INCONSISTENCY_ENTITY_SCHEMA,
    SIGNALING_EFFECT_ENTITY_SCHEMA,
  ],
  "formal-modeling": [
    PAYOFF_MATRIX_ENTITY_SCHEMA,
    GAME_TREE_ENTITY_SCHEMA,
    EQUILIBRIUM_RESULT_ENTITY_SCHEMA,
    CROSS_GAME_CONSTRAINT_TABLE_ENTITY_SCHEMA,
    CROSS_GAME_EFFECT_ENTITY_SCHEMA,
    SIGNAL_CLASSIFICATION_ENTITY_SCHEMA,
    BARGAINING_DYNAMICS_ENTITY_SCHEMA,
    OPTION_VALUE_ASSESSMENT_ENTITY_SCHEMA,
    BEHAVIORAL_OVERLAY_ENTITY_SCHEMA,
  ],
  assumptions: [ASSUMPTION_ENTITY_SCHEMA],
  elimination: [ELIMINATED_OUTCOME_ENTITY_SCHEMA],
  scenarios: [SCENARIO_ENTITY_SCHEMA, CENTRAL_THESIS_ENTITY_SCHEMA],
  "meta-check": [META_CHECK_ENTITY_SCHEMA],
};

/**
 * Recursively ensure every object with `properties` has `additionalProperties: false`.
 * Required by OpenAI structured output; harmless for Anthropic.
 * Also normalises `type: ["string", "null"]` → `anyOf` branches because
 * OpenAI structured output expects union types in combinator form.
 * Bare `{ type: "object" }` without `properties` gets `properties: {}`.
 */
function enforceStrictSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...schema };

  // Normalise array-form type (e.g. ["string", "null"] → anyOf with null)
  // so the schema stays within the supported structured-output subset.
  if (Array.isArray(out.type)) {
    const types = out.type as string[];
    if (types.length === 1) {
      out.type = types[0];
    } else {
      const { type: _, ...rest } = out;
      return enforceStrictSchema({
        ...rest,
        anyOf: types.map((t) => ({ type: t })),
      });
    }
  }

  if (out.type === "object") {
    if (!out.properties) {
      out.properties = {};
    }
    out.additionalProperties = false;

    // Recurse into properties
    const props = out.properties as Record<string, Record<string, unknown>>;
    const processed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(props)) {
      processed[key] =
        val && typeof val === "object" && !Array.isArray(val)
          ? enforceStrictSchema(val)
          : val;
    }
    out.properties = processed;

    // Ensure required lists all properties (OpenAI requirement)
    out.required = Object.keys(processed);
  }

  if (out.type === "array" && out.items) {
    out.items = enforceStrictSchema(out.items as Record<string, unknown>);
  }

  // Recurse into combinators used by the structured-output schema.
  for (const key of ["oneOf", "anyOf"] as const) {
    if (Array.isArray(out[key])) {
      out[key] = (out[key] as Record<string, unknown>[]).map((s) =>
        enforceStrictSchema(s),
      );
    }
  }

  return out;
}

/**
 * Build a JSON Schema representation of the phase output for structured output mode.
 * Uses real entity schemas per phase so providers can enforce structure natively.
 */
function buildOutputSchema(phase: SupportedPhase): Record<string, unknown> {
  const entitySchemas = PHASE_ENTITY_JSON_SCHEMAS[phase];
  const entityItems =
    entitySchemas.length === 1 ? entitySchemas[0] : { anyOf: entitySchemas };

  const raw = {
    type: "object",
    properties: {
      entities: {
        type: "array",
        description: `Array of ${phase} entities`,
        items: entityItems,
      },
      relationships: {
        type: "array",
        description: "Array of entity relationships",
        items: RELATIONSHIP_SCHEMA,
      },
    },
    required: ["entities", "relationships"],
  };

  return enforceStrictSchema(raw);
}

// ── Main entry point ──

/**
 * Run a single analysis phase.
 *
 * 1. Builds system + user prompts
 * 2. Calls the active adapter's runAnalysisPhase() for structured output
 * 3. Validates the response with Zod schemas
 * 4. Falls back to text parsing if structured output returns raw text
 * 5. Returns PhaseResult (never throws — errors are in the result)
 *
 * Does NOT retry on failure — returns failure to the caller (orchestrator).
 */
export async function runPhase(
  phase: MethodologyPhase,
  topic: string,
  context?: PhaseContext,
): Promise<PhaseResult> {
  if (!isSupportedPhase(phase)) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: `Unsupported phase: ${phase}`,
    };
  }

  // Check abort signal before starting work
  if (context?.signal?.aborted) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Aborted",
    };
  }

  // Use caller's logger if provided, otherwise create a per-call logger
  const logger =
    context?.logger ??
    createRunLogger(
      `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );

  const { system, user } =
    context?.promptBundle ??
    buildPhasePromptBundle({
      phase,
      topic,
      phaseBrief: context?.phaseBrief,
      revisionRetryInstruction: context?.revisionRetryInstruction,
      revisionSystemPrompt: context?.revisionSystemPrompt,
      effortLevel: context?.runtime?.effortLevel ?? "medium",
    });
  const model = context?.model ?? "claude-sonnet-4-20250514";
  const provider = context?.provider ?? "anthropic";
  const schema = buildOutputSchema(phase);
  const logContext = context?.phaseTurnId
    ? { phaseTurnId: context.phaseTurnId }
    : {};
  const emitActivity = (message: string, toolName?: string) => {
    context?.onActivity?.({
      kind:
        toolName === "WebSearch" ? "web-search" : toolName ? "tool" : "note",
      message,
      ...(toolName ? { toolName } : {}),
    });
  };
  let emittedResearchMilestone = false;

  logger.log("analysis-service", "phase-start", {
    phase,
    provider,
    model,
    ...logContext,
  });
  emitActivity("Preparing phase analysis");

  // Check abort signal before adapter call
  if (context?.signal?.aborted) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Aborted",
    };
  }

  logger.log("analysis-service", "adapter-call", {
    phase,
    provider,
    ...logContext,
  });

  let adapterResult: unknown;
  try {
    const adapter = await loadAnalysisAdapter(context?.provider);
    const session = adapter.createSession(
      {
        workspaceId: context?.workspaceId,
        threadId: context?.threadId ?? context?.runId ?? `phase-${phase}`,
        ...(context?.runId ? { runId: context.runId } : {}),
        ...(context?.phaseTurnId ? { phaseTurnId: context.phaseTurnId } : {}),
        purpose: "analysis",
      },
      context?.threadId
        ? getProviderSessionBinding(context.threadId, "analysis")
        : null,
    );
    try {
      adapterResult = await session.runStructuredTurn({
        prompt: user,
        systemPrompt: system,
        model,
        schema,
        signal: context?.signal,
        runId: context?.runId,
        webSearch:
          context?.promptBundle?.toolPolicy?.webSearch ??
          context?.runtime?.webSearch,
        allowedToolNames:
          context?.promptBundle?.toolPolicy?.enabledAnalysisTools,
        onActivity: (activity) => {
          if (
            !emittedResearchMilestone &&
            (activity.kind === "tool" || activity.kind === "web-search")
          ) {
            emittedResearchMilestone = true;
            emitActivity("Researching evidence");
          }
          context?.onActivity?.(activity);
        },
      });
    } finally {
      await session.dispose();
    }
  } catch (err) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: `Adapter error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // If the adapter returned a string (raw text), fall back to text parsing
  if (typeof adapterResult === "string") {
    emitActivity("Synthesizing phase output");
    logger.warn("analysis-service", "text-fallback", {
      phase,
      responseLength: adapterResult.length,
      ...logContext,
    });
    emitActivity("Validating structured output");
    const textResult = parseTextResponse(adapterResult, phase);
    if (textResult.success) {
      logger.log("analysis-service", "validation-success", {
        phase,
        entities: textResult.entities.length,
        relationships: textResult.relationships.length,
        ...logContext,
      });
    } else {
      logger.warn("analysis-service", "validation-failed", {
        phase,
        error: textResult.error,
        ...logContext,
      });
      logger.capture("analysis-service", "raw-response", {
        phase,
        raw: adapterResult,
        ...logContext,
      });
    }
    return textResult;
  }

  // Structured output — validate with Zod
  emitActivity("Synthesizing phase output");
  logger.log("analysis-service", "structured-output", {
    phase,
    entitiesCount:
      typeof adapterResult === "object" &&
      adapterResult !== null &&
      "entities" in adapterResult &&
      Array.isArray((adapterResult as Record<string, unknown>).entities)
        ? (adapterResult as Record<string, unknown[]>).entities.length
        : 0,
    relationshipsCount:
      typeof adapterResult === "object" &&
      adapterResult !== null &&
      "relationships" in adapterResult &&
      Array.isArray((adapterResult as Record<string, unknown>).relationships)
        ? (adapterResult as Record<string, unknown[]>).relationships.length
        : 0,
    ...logContext,
  });

  emitActivity("Validating structured output");
  const validated = validatePhaseOutput(adapterResult, phase);
  if (validated.success) {
    logger.log("analysis-service", "validation-success", {
      phase,
      entities: validated.entities.length,
      relationships: validated.relationships.length,
      ...logContext,
    });
  } else {
    logger.warn("analysis-service", "validation-failed", {
      phase,
      error: validated.error,
      ...logContext,
    });
    logger.capture("analysis-service", "raw-response", {
      phase,
      raw: JSON.stringify(adapterResult),
      ...logContext,
    });
  }
  return validated;
}

// ── Exported for testing ──

export {
  parseTextResponse as _parseTextResponse,
  validatePhaseOutput as _validatePhaseOutput,
  trimJsonLike as _trimJsonLike,
};
