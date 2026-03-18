import { z } from "zod/v4";
import type { MethodologyPhase } from "@/types/methodology";
import type {
  AnalysisEntity,
  AnalysisRelationship,
  ParseResult,
} from "@/types/entity";
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

// ── Supported phase types ──

type SupportedPhase = Extract<
  MethodologyPhase,
  "situational-grounding" | "player-identification" | "baseline-model"
>;

// ── Output schemas ──

const positionSchema = z.object({ x: z.number(), y: z.number() });

const baseEntityFields = {
  id: z.string().min(1),
  position: positionSchema,
  confidence: entityConfidenceSchema,
  source: entitySourceSchema,
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

// ── JSON extraction (mirrors trimJsonLike from analysis-ai-helpers) ──

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

// ── Phase worker types ──

export interface PhaseWorkerOutput {
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
}

export interface PhaseWorker {
  phase: SupportedPhase;
  buildPrompt(
    topic: string,
    priorContext?: string,
  ): {
    system: string;
    user: string;
  };
  parseResponse(raw: string): ParseResult<PhaseWorkerOutput>;
}

// ── Factory ──

export function createPhaseWorker(phase: SupportedPhase): PhaseWorker {
  const systemPrompt = PHASE_PROMPTS[phase];
  const entitySchemas = PHASE_ENTITY_SCHEMAS[phase];

  return {
    phase,

    buildPrompt(topic: string, priorContext?: string) {
      const parts = [`Analyze the following topic:\n\n${topic}`];
      if (priorContext) {
        parts.push(
          `\nPrior phase output (use as context, reference entity ids where relevant):\n\n${priorContext}`,
        );
      }
      return { system: systemPrompt, user: parts.join("\n") };
    },

    parseResponse(raw: string): ParseResult<PhaseWorkerOutput> {
      const trimmed = trimJsonLike(raw);
      if (!trimmed) {
        return { success: false, error: "Empty response" };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return { success: false, error: "Invalid JSON in response" };
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return { success: false, error: "Response is not a JSON object" };
      }

      const obj = parsed as Record<string, unknown>;

      if (!Array.isArray(obj.entities)) {
        return { success: false, error: 'Missing "entities" array' };
      }

      if (!Array.isArray(obj.relationships)) {
        return { success: false, error: 'Missing "relationships" array' };
      }

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
            error: `Relationship ${i}: ${msg}`,
          };
        }
        relationships.push(result.data);
      }

      return { success: true, data: { entities, relationships } };
    },
  };
}

// ── Pre-configured instances ──

export const phase1Worker = createPhaseWorker("situational-grounding");
export const phase2Worker = createPhaseWorker("player-identification");
export const phase3Worker = createPhaseWorker("baseline-model");
