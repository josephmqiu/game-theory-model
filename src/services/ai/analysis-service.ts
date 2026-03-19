// analysis-service.ts — per-phase execution engine.
// Absorbs prompt building (phase-prompts.ts) and response parsing (phase-worker.ts).
// Calls the active adapter's runAnalysisPhase() for structured output,
// with fallback to text parsing for backward compatibility.
//
// Does NOT own retries, sequencing, or run lifecycle — that's the orchestrator's job.

import { z } from "zod/v4";
import type { MethodologyPhase } from "@/types/methodology";
import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import {
  entityConfidenceSchema,
  entitySourceSchema,
  factDataSchema,
  playerDataSchema,
  objectiveDataSchema,
  gameDataSchema,
  strategyDataSchema,
} from "@/types/entity";
import { PHASE_PROMPTS } from "./phase-prompts";
import { createRunLogger } from "./ai-logger";
import type { RunLogger } from "./ai-logger";

// ── Public types ──

export interface PhaseResult {
  success: boolean;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
  error?: string;
}

export interface PhaseContext {
  priorEntities?: string;
  provider?: string;
  model?: string;
  signal?: AbortSignal;
  logger?: RunLogger;
}

// ── Supported phase types ──

type SupportedPhase = Extract<
  MethodologyPhase,
  "situational-grounding" | "player-identification" | "baseline-model"
>;

const SUPPORTED_PHASES: SupportedPhase[] = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
];

function isSupportedPhase(phase: MethodologyPhase): phase is SupportedPhase {
  return (SUPPORTED_PHASES as string[]).includes(phase);
}

// ── Zod schemas (ported from phase-worker.ts) ──

const positionSchema = z.object({ x: z.number(), y: z.number() });

const baseEntityFields = {
  id: z.string().min(1),
  position: positionSchema,
  confidence: entityConfidenceSchema,
  source: entitySourceSchema.default("ai"),
  rationale: z.string(),
  revision: z.number(),
  stale: z.boolean(),
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
};

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
  | { success: true; data: AnalysisEntity }
  | { success: false; error: z.ZodError } {
  for (const schema of schemas) {
    const result = schema.safeParse(value);
    if (result.success) {
      return { success: true, data: result.data as AnalysisEntity };
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
  const entities: AnalysisEntity[] = [];
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
  const relationships: AnalysisRelationship[] = [];
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

  return { success: true, entities, relationships };
}

// ── Prompt building (ported from phase-worker.ts) ──

function buildPrompt(
  phase: SupportedPhase,
  topic: string,
  priorContext?: string,
): { system: string; user: string } {
  const systemPrompt = PHASE_PROMPTS[phase];
  const parts = [`Analyze the following topic:\n\n${topic}`];
  if (priorContext) {
    parts.push(
      `\nPrior phase output (use as context, reference entity ids where relevant):\n\n${priorContext}`,
    );
  }
  return { system: systemPrompt, user: parts.join("\n") };
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

// ── Adapter selection ──

interface AnalysisAdapter {
  runAnalysisPhase<T = unknown>(
    prompt: string,
    systemPrompt: string,
    model: string,
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T>;
}

async function getAdapter(provider?: string): Promise<AnalysisAdapter> {
  // Import dynamically to avoid circular deps
  if (provider === "openai") {
    return import("./codex-adapter");
  }
  return import("./claude-adapter");
}

// ── JSON Schema for structured output ──

const BASE_ENTITY_SCHEMA = {
  id: { type: "string" },
  position: {
    type: "object",
    properties: { x: { type: "number" }, y: { type: "number" } },
    required: ["x", "y"],
  },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  source: { type: "string", enum: ["ai", "human", "computed"] },
  rationale: { type: "string" },
  revision: { type: "number" },
  stale: { type: "boolean" },
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
  required: [
    "id",
    "type",
    "phase",
    "data",
    "position",
    "confidence",
    "rationale",
    "revision",
    "stale",
  ],
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
  required: [
    "id",
    "type",
    "phase",
    "data",
    "position",
    "confidence",
    "rationale",
    "revision",
    "stale",
  ],
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
  required: [
    "id",
    "type",
    "phase",
    "data",
    "position",
    "confidence",
    "rationale",
    "revision",
    "stale",
  ],
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
  required: [
    "id",
    "type",
    "phase",
    "data",
    "position",
    "confidence",
    "rationale",
    "revision",
    "stale",
  ],
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
  required: [
    "id",
    "type",
    "phase",
    "data",
    "position",
    "confidence",
    "rationale",
    "revision",
    "stale",
  ],
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
};

/**
 * Build a JSON Schema representation of the phase output for structured output mode.
 * Uses real entity schemas per phase so providers can enforce structure natively.
 */
function buildOutputSchema(phase: SupportedPhase): Record<string, unknown> {
  const entitySchemas = PHASE_ENTITY_JSON_SCHEMAS[phase];
  const entityItems =
    entitySchemas.length === 1 ? entitySchemas[0] : { oneOf: entitySchemas };

  return {
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

  const { system, user } = buildPrompt(phase, topic, context?.priorEntities);
  const model = context?.model ?? "claude-sonnet-4-20250514";
  const provider = context?.provider ?? "anthropic";
  const schema = buildOutputSchema(phase);

  logger.log("analysis-service", "phase-start", { phase, provider, model });

  let adapter: AnalysisAdapter;
  try {
    adapter = await getAdapter(context?.provider);
  } catch (err) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: `Failed to load adapter: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Check abort signal before adapter call
  if (context?.signal?.aborted) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Aborted",
    };
  }

  logger.log("analysis-service", "adapter-call", { phase, provider });

  let adapterResult: unknown;
  try {
    adapterResult = await adapter.runAnalysisPhase(
      user,
      system,
      model,
      schema,
      context?.signal,
    );
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
    logger.warn("analysis-service", "text-fallback", {
      phase,
      responseLength: adapterResult.length,
    });
    const textResult = parseTextResponse(adapterResult, phase);
    if (textResult.success) {
      logger.log("analysis-service", "validation-success", {
        phase,
        entities: textResult.entities.length,
        relationships: textResult.relationships.length,
      });
    } else {
      logger.warn("analysis-service", "validation-failed", {
        phase,
        error: textResult.error,
      });
      logger.capture("analysis-service", "raw-response", {
        phase,
        raw: adapterResult,
      });
    }
    return textResult;
  }

  // Structured output — validate with Zod
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
  });

  const validated = validatePhaseOutput(adapterResult, phase);
  if (validated.success) {
    logger.log("analysis-service", "validation-success", {
      phase,
      entities: validated.entities.length,
      relationships: validated.relationships.length,
    });
  } else {
    logger.warn("analysis-service", "validation-failed", {
      phase,
      error: validated.error,
    });
    logger.capture("analysis-service", "raw-response", {
      phase,
      raw: JSON.stringify(adapterResult),
    });
  }
  return validated;
}

// ── Exported for testing ──

export {
  buildPrompt as _buildPrompt,
  parseTextResponse as _parseTextResponse,
  validatePhaseOutput as _validatePhaseOutput,
  trimJsonLike as _trimJsonLike,
  getAdapter as _getAdapter,
};
