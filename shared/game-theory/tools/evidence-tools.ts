import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types/agent";
import type { Command } from "../engine/commands";

// ── Shared helper ─────────────────────────────────────────────────────────────

function executeTool(
  input: unknown,
  schema: z.ZodType,
  buildCommand: (parsed: unknown) => Command,
  context: ToolContext,
): ToolResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join("; ");
    return { success: false, error: `Invalid input: ${messages}` };
  }

  const command = buildCommand(parsed.data);
  const result = context.dispatch(command);

  if (result.status === "committed") {
    const kind = command.kind;
    const id = (command as { id?: string }).id ?? "";
    return { success: true, data: { id, kind } };
  }

  const errors =
    result.status === "rejected"
      ? result.errors
      : ["Dispatch returned dry_run"];
  return { success: false, error: errors.join("; ") };
}

// ── add_source ────────────────────────────────────────────────────────────────

const addSourceSchema = z.object({
  title: z.string().min(1),
  quality_rating: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
});

function createAddSourceTool(): ToolDefinition {
  return {
    name: "add_source",
    description:
      "Adds a source (web page, article, report, transcript, etc.) to the analysis evidence base.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Human-readable title of the source.",
        },
        quality_rating: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Credibility rating of the source. Defaults to 'medium'.",
        },
        notes: {
          type: "string",
          description: "Optional commentary or caveats about the source.",
        },
        url: { type: "string", description: "Optional URL for the source." },
      },
      required: ["title"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `source_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addSourceSchema,
        (data) => {
          const parsed = data as z.infer<typeof addSourceSchema>;
          return {
            kind: "add_source" as const,
            id,
            payload: {
              kind: "article" as const,
              title: parsed.title,
              captured_at: new Date().toISOString(),
              quality_rating: parsed.quality_rating,
              ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
              ...(parsed.url !== undefined ? { url: parsed.url } : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_observation ───────────────────────────────────────────────────────────

const addObservationSchema = z.object({
  source_id: z.string().min(1),
  text: z.string().min(1),
});

function createAddObservationTool(): ToolDefinition {
  return {
    name: "add_observation",
    description:
      "Records a factual observation extracted from a source. Observations are direct readings or quotes from source material.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "ID of the source this observation is drawn from.",
        },
        text: { type: "string", description: "The observed fact or quote." },
      },
      required: ["source_id", "text"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `observation_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addObservationSchema,
        (data) => {
          const parsed = data as z.infer<typeof addObservationSchema>;
          return {
            kind: "add_observation" as const,
            id,
            payload: {
              source_id: parsed.source_id,
              text: parsed.text,
              captured_at: new Date().toISOString(),
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_claim ─────────────────────────────────────────────────────────────────

const addClaimSchema = z.object({
  statement: z.string().min(1),
  based_on: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1).default(0.7),
});

function createAddClaimTool(): ToolDefinition {
  return {
    name: "add_claim",
    description:
      "Adds a claim synthesised from one or more observations or other sources. Claims represent analyst assertions about facts.",
    inputSchema: {
      type: "object",
      properties: {
        statement: { type: "string", description: "The claim statement." },
        based_on: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs of observations or other entities this claim is based on.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confidence level from 0 to 1. Defaults to 0.7.",
        },
      },
      required: ["statement", "based_on"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `claim_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addClaimSchema,
        (data) => {
          const parsed = data as z.infer<typeof addClaimSchema>;
          return {
            kind: "add_claim" as const,
            id,
            payload: {
              statement: parsed.statement,
              based_on: parsed.based_on,
              confidence: parsed.confidence,
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_inference ─────────────────────────────────────────────────────────────

const addInferenceSchema = z.object({
  statement: z.string().min(1),
  derived_from: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1).default(0.7),
  rationale: z.string().min(1),
});

function createAddInferenceTool(): ToolDefinition {
  return {
    name: "add_inference",
    description:
      "Adds an inference — a logical or analytical conclusion derived from claims, observations, or other inferences.",
    inputSchema: {
      type: "object",
      properties: {
        statement: { type: "string", description: "The inference statement." },
        derived_from: {
          type: "array",
          items: { type: "string" },
          description: "IDs of entities this inference is derived from.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confidence level from 0 to 1. Defaults to 0.7.",
        },
        rationale: {
          type: "string",
          description: "Explanation of the reasoning behind this inference.",
        },
      },
      required: ["statement", "derived_from", "rationale"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `inference_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addInferenceSchema,
        (data) => {
          const parsed = data as z.infer<typeof addInferenceSchema>;
          return {
            kind: "add_inference" as const,
            id,
            payload: {
              statement: parsed.statement,
              derived_from: parsed.derived_from,
              confidence: parsed.confidence,
              rationale: parsed.rationale,
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_derivation ────────────────────────────────────────────────────────────

const addDerivationSchema = z.object({
  from_ref: z.string().min(1),
  to_ref: z.string().min(1),
  relation: z.enum(["supports", "infers", "contradicts"]),
});

function createAddDerivationTool(): ToolDefinition {
  return {
    name: "add_derivation",
    description:
      "Creates a directed derivation edge between two entities to record how one entity logically relates to another.",
    inputSchema: {
      type: "object",
      properties: {
        from_ref: {
          type: "string",
          description: "ID of the source entity in the derivation.",
        },
        to_ref: {
          type: "string",
          description: "ID of the target entity in the derivation.",
        },
        relation: {
          type: "string",
          enum: ["supports", "infers", "contradicts"],
          description: "The logical relationship from from_ref to to_ref.",
        },
      },
      required: ["from_ref", "to_ref", "relation"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `derivation_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addDerivationSchema,
        (data) => {
          const parsed = data as z.infer<typeof addDerivationSchema>;
          return {
            kind: "add_derivation" as const,
            id,
            payload: {
              from_ref: parsed.from_ref,
              to_ref: parsed.to_ref,
              relation: parsed.relation,
            },
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createEvidenceTools(): ToolDefinition[] {
  return [
    createAddSourceTool(),
    createAddObservationTool(),
    createAddClaimTool(),
    createAddInferenceTool(),
    createAddDerivationTool(),
  ];
}
