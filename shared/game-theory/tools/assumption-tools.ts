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

// ── add_assumption ────────────────────────────────────────────────────────────

const addAssumptionSchema = z.object({
  statement: z.string().min(1),
  type: z
    .enum([
      "behavioral",
      "capability",
      "structural",
      "institutional",
      "rationality",
      "information",
    ])
    .default("behavioral"),
  sensitivity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  confidence: z.number().min(0).max(1).default(0.7),
  evidence_quality: z.string().min(1).optional(),
});

function createAddAssumptionTool(): ToolDefinition {
  return {
    name: "add_assumption",
    description:
      "Adds an analytical assumption to the model. Assumptions underpin game-theoretic reasoning and are tracked for sensitivity.",
    inputSchema: {
      type: "object",
      properties: {
        statement: {
          type: "string",
          description: "The assumption statement.",
        },
        type: {
          type: "string",
          enum: [
            "behavioral",
            "capability",
            "structural",
            "institutional",
            "rationality",
            "information",
          ],
          description: "Category of assumption. Defaults to 'behavioral'.",
        },
        sensitivity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description:
            "How sensitive the analysis is to this assumption. Defaults to 'medium'.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confidence in this assumption (0-1). Defaults to 0.7.",
        },
        evidence_quality: {
          type: "string",
          description:
            "Optional note about the quality of supporting evidence.",
        },
      },
      required: ["statement"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `assumption_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addAssumptionSchema,
        (data) => {
          const parsed = data as z.infer<typeof addAssumptionSchema>;
          return {
            kind: "add_assumption" as const,
            id,
            payload: {
              statement: parsed.statement,
              type: parsed.type,
              sensitivity: parsed.sensitivity,
              confidence: parsed.confidence,
              supported_by: [],
              contradicted_by: [],
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_assumption ─────────────────────────────────────────────────────────

const updateAssumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1).optional(),
  type: z
    .enum([
      "behavioral",
      "capability",
      "structural",
      "institutional",
      "rationality",
      "information",
    ])
    .optional(),
  sensitivity: z.enum(["critical", "high", "medium", "low"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

function createUpdateAssumptionTool(): ToolDefinition {
  return {
    name: "update_assumption",
    description:
      "Updates fields on an existing assumption by ID. Only provided fields are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the assumption to update.",
        },
        statement: {
          type: "string",
          description: "New assumption statement.",
        },
        type: {
          type: "string",
          enum: [
            "behavioral",
            "capability",
            "structural",
            "institutional",
            "rationality",
            "information",
          ],
          description: "Updated assumption type.",
        },
        sensitivity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Updated sensitivity level.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Updated confidence value.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateAssumptionSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateAssumptionSchema>;
          const payload = {
            id: parsed.id,
            ...(parsed.statement !== undefined
              ? { statement: parsed.statement }
              : {}),
            ...(parsed.type !== undefined ? { type: parsed.type } : {}),
            ...(parsed.sensitivity !== undefined
              ? { sensitivity: parsed.sensitivity }
              : {}),
            ...(parsed.confidence !== undefined
              ? { confidence: parsed.confidence }
              : {}),
          };
          return {
            kind: "update_assumption" as const,
            payload,
          };
        },
        context,
      );
    },
  };
}

// ── add_contradiction ─────────────────────────────────────────────────────────

const addContradictionSchema = z.object({
  left_ref: z.string().min(1),
  right_ref: z.string().min(1),
  description: z.string().min(1),
  resolution_status: z
    .enum(["open", "partially_resolved", "resolved", "deferred"])
    .default("open"),
  notes: z.string().min(1).optional(),
});

function createAddContradictionTool(): ToolDefinition {
  return {
    name: "add_contradiction",
    description:
      "Records a contradiction between two analytical entities. Contradictions flag inconsistencies that need resolution.",
    inputSchema: {
      type: "object",
      properties: {
        left_ref: {
          type: "string",
          description: "ID of the first entity in the contradiction.",
        },
        right_ref: {
          type: "string",
          description: "ID of the second entity in the contradiction.",
        },
        description: {
          type: "string",
          description: "Description of the contradiction.",
        },
        resolution_status: {
          type: "string",
          enum: ["open", "partially_resolved", "resolved", "deferred"],
          description: "Current resolution status. Defaults to 'open'.",
        },
        notes: {
          type: "string",
          description: "Optional notes on the contradiction.",
        },
      },
      required: ["left_ref", "right_ref", "description"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `contradiction_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addContradictionSchema,
        (data) => {
          const parsed = data as z.infer<typeof addContradictionSchema>;
          return {
            kind: "add_contradiction" as const,
            id,
            payload: {
              left_ref: parsed.left_ref,
              right_ref: parsed.right_ref,
              description: parsed.description,
              resolution_status: parsed.resolution_status,
              ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_latent_factor ─────────────────────────────────────────────────────────

const addLatentFactorSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  assumption_ids: z.array(z.string().min(1)).optional(),
});

function createAddLatentFactorTool(): ToolDefinition {
  return {
    name: "add_latent_factor",
    description:
      "Adds a latent factor — an unobservable variable that influences game dynamics. Latent factors capture hidden structural features.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the latent factor.",
        },
        description: {
          type: "string",
          description: "Optional description of what this factor represents.",
        },
        assumption_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional IDs of assumptions linked to this factor.",
        },
      },
      required: ["name"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `latent_factor_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addLatentFactorSchema,
        (data) => {
          const parsed = data as z.infer<typeof addLatentFactorSchema>;
          return {
            kind: "add_latent_factor" as const,
            id,
            payload: {
              name: parsed.name,
              ...(parsed.description !== undefined
                ? { description: parsed.description }
                : {}),
              states: [],
              affects: [],
              assumptions: parsed.assumption_ids ?? [],
              source_claims: [],
            },
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createAssumptionTools(): ToolDefinition[] {
  return [
    createAddAssumptionTool(),
    createUpdateAssumptionTool(),
    createAddContradictionTool(),
    createAddLatentFactorTool(),
  ];
}
