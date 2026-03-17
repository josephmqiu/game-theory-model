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

// ── add_scenario ──────────────────────────────────────────────────────────────

const addScenarioSchema = z.object({
  name: z.string().min(1),
  narrative: z.string().min(1),
  formalization_id: z.string().min(1),
  probability_value: z.number().min(0).max(1).optional(),
});

function createAddScenarioTool(): ToolDefinition {
  return {
    name: "add_scenario",
    description:
      "Adds a scenario to the analysis. A scenario represents a specific pathway through the game tree with an estimated probability.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Human-readable name for the scenario.",
        },
        narrative: {
          type: "string",
          description: "Narrative description of how this scenario unfolds.",
        },
        formalization_id: {
          type: "string",
          description: "ID of the formalization this scenario is drawn from.",
        },
        probability_value: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description:
            "Estimated probability of this scenario (0-1). Optional.",
        },
      },
      required: ["name", "narrative", "formalization_id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `scenario_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addScenarioSchema,
        (data) => {
          const parsed = data as z.infer<typeof addScenarioSchema>;
          const probabilityEstimate =
            parsed.probability_value !== undefined
              ? {
                  mode: "point" as const,
                  value: parsed.probability_value,
                  confidence: 0.5,
                  rationale: "Probability assigned at scenario creation.",
                  source_claims: [] as string[],
                  assumptions: [] as string[],
                }
              : undefined;
          return {
            kind: "add_scenario" as const,
            id,
            payload: {
              name: parsed.name,
              narrative: parsed.narrative,
              formalization_id: parsed.formalization_id,
              path: [],
              probability_model: "ordinal_only" as const,
              key_assumptions: [],
              invalidators: [],
              ...(probabilityEstimate !== undefined
                ? { estimated_probability: probabilityEstimate }
                : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_scenario ───────────────────────────────────────────────────────────

const updateScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  narrative: z.string().min(1).optional(),
  probability_value: z.number().min(0).max(1).optional(),
});

function createUpdateScenarioTool(): ToolDefinition {
  return {
    name: "update_scenario",
    description:
      "Updates fields on an existing scenario. Only provided fields are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the scenario to update.",
        },
        name: {
          type: "string",
          description: "New name for the scenario.",
        },
        narrative: {
          type: "string",
          description: "Updated narrative.",
        },
        probability_value: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Updated probability estimate.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateScenarioSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateScenarioSchema>;
          const probabilityField =
            parsed.probability_value !== undefined
              ? {
                  estimated_probability: {
                    mode: "point" as const,
                    value: parsed.probability_value,
                    confidence: 0.5,
                    rationale: "Probability updated via update_scenario tool.",
                    source_claims: [] as string[],
                    assumptions: [] as string[],
                  },
                }
              : {};
          const payload = {
            id: parsed.id,
            ...(parsed.name !== undefined ? { name: parsed.name } : {}),
            ...(parsed.narrative !== undefined
              ? { narrative: parsed.narrative }
              : {}),
            ...probabilityField,
          };
          return {
            kind: "update_scenario" as const,
            payload,
          };
        },
        context,
      );
    },
  };
}

// ── add_tail_risk ─────────────────────────────────────────────────────────────

const addTailRiskSchema = z.object({
  event_description: z.string().min(1),
  probability_value: z.number().min(0).max(1).optional(),
  trigger: z.string().min(1).optional(),
  consequences: z.string().min(1).optional(),
  why_unlikely: z.string().min(1).optional(),
});

function createAddTailRiskTool(): ToolDefinition {
  return {
    name: "add_tail_risk",
    description:
      "Adds a tail risk — a low-probability, high-impact event that falls outside primary scenario modelling.",
    inputSchema: {
      type: "object",
      properties: {
        event_description: {
          type: "string",
          description: "Description of the tail risk event.",
        },
        probability_value: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Estimated probability (0-1). Optional.",
        },
        trigger: {
          type: "string",
          description: "What would trigger this event. Optional.",
        },
        consequences: {
          type: "string",
          description: "Consequences if the event occurs. Optional.",
        },
        why_unlikely: {
          type: "string",
          description: "Explanation of why this event is unlikely. Optional.",
        },
      },
      required: ["event_description"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `tail_risk_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addTailRiskSchema,
        (data) => {
          const parsed = data as z.infer<typeof addTailRiskSchema>;
          return {
            kind: "add_tail_risk" as const,
            id,
            payload: {
              event_description: parsed.event_description,
              probability: {
                mode: "point" as const,
                value: parsed.probability_value ?? 0.05,
                confidence: 0.3,
                rationale:
                  parsed.why_unlikely ??
                  "Tail risk probability assigned at creation.",
                source_claims: [] as string[],
                assumptions: [] as string[],
              },
              trigger: parsed.trigger ?? "",
              why_unlikely: parsed.why_unlikely ?? "",
              consequences: parsed.consequences ?? "",
              drift_toward: false,
              drift_evidence: null,
              related_scenarios: [],
              evidence_refs: [],
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_central_thesis ────────────────────────────────────────────────────────

const addCentralThesisSchema = z.object({
  statement: z.string().min(1),
  falsification_condition: z.string().min(1),
});

function createAddCentralThesisTool(): ToolDefinition {
  return {
    name: "add_central_thesis",
    description:
      "Adds the central thesis of the analysis — the core analytical claim and the conditions under which it would be falsified.",
    inputSchema: {
      type: "object",
      properties: {
        statement: {
          type: "string",
          description: "The central thesis statement.",
        },
        falsification_condition: {
          type: "string",
          description: "What would falsify or overturn this thesis.",
        },
      },
      required: ["statement", "falsification_condition"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `central_thesis_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addCentralThesisSchema,
        (data) => {
          const parsed = data as z.infer<typeof addCentralThesisSchema>;
          return {
            kind: "add_central_thesis" as const,
            id,
            payload: {
              statement: parsed.statement,
              falsification_condition: parsed.falsification_condition,
              evidence_refs: [],
              assumption_refs: [],
              scenario_refs: [],
              forecast_basis: "discretionary" as const,
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_central_thesis ─────────────────────────────────────────────────────

const updateCentralThesisSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1).optional(),
  falsification_condition: z.string().min(1).optional(),
});

function createUpdateCentralThesisTool(): ToolDefinition {
  return {
    name: "update_central_thesis",
    description:
      "Updates the statement or falsification condition of an existing central thesis.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the central thesis to update.",
        },
        statement: {
          type: "string",
          description: "Updated thesis statement.",
        },
        falsification_condition: {
          type: "string",
          description: "Updated falsification condition.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateCentralThesisSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateCentralThesisSchema>;
          const payload = {
            id: parsed.id,
            ...(parsed.statement !== undefined
              ? { statement: parsed.statement }
              : {}),
            ...(parsed.falsification_condition !== undefined
              ? { falsification_condition: parsed.falsification_condition }
              : {}),
          };
          return {
            kind: "update_central_thesis" as const,
            payload,
          };
        },
        context,
      );
    },
  };
}

// ── add_eliminated_outcome ────────────────────────────────────────────────────

const addEliminatedOutcomeSchema = z.object({
  outcome_description: z.string().min(1),
  elimination_reasoning: z.string().min(1),
  citing_phases: z
    .array(
      z.object({
        phase: z.number().int().min(1).max(10),
        finding: z.string().min(1),
      }),
    )
    .optional(),
  surprise_factor: z.enum(["high", "medium", "low"]).default("low"),
});

function createAddEliminatedOutcomeTool(): ToolDefinition {
  return {
    name: "add_eliminated_outcome",
    description:
      "Records an outcome that has been analytically eliminated — an event that will not occur given current analysis.",
    inputSchema: {
      type: "object",
      properties: {
        outcome_description: {
          type: "string",
          description: "Description of the eliminated outcome.",
        },
        elimination_reasoning: {
          type: "string",
          description: "Reasoning for why this outcome is eliminated.",
        },
        citing_phases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              phase: {
                type: "number",
                description:
                  "Phase number (1-10) that supports this elimination.",
              },
              finding: {
                type: "string",
                description: "The specific finding from that phase.",
              },
            },
            required: ["phase", "finding"],
          },
          description:
            "Optional list of analytical phases supporting this elimination.",
        },
        surprise_factor: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "How surprising this elimination would be if wrong. Defaults to 'low'.",
        },
      },
      required: ["outcome_description", "elimination_reasoning"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `eliminated_outcome_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addEliminatedOutcomeSchema,
        (data) => {
          const parsed = data as z.infer<typeof addEliminatedOutcomeSchema>;
          return {
            kind: "add_eliminated_outcome" as const,
            id,
            payload: {
              outcome_description: parsed.outcome_description,
              elimination_reasoning: parsed.elimination_reasoning,
              citing_phases: parsed.citing_phases ?? [],
              evidence_refs: [],
              surprise_factor: parsed.surprise_factor,
              related_scenarios: [],
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_signal_classification ─────────────────────────────────────────────────

const addSignalClassificationSchema = z.object({
  signal_ref: z.string().min(1),
  classification: z.enum(["cheap_talk", "costly_signal", "audience_cost"]),
  player_id: z.string().min(1).optional(),
  signal_description: z.string().min(1).optional(),
  cost_description: z.string().min(1).optional(),
  informativeness: z.enum(["high", "medium", "low", "none"]).default("medium"),
});

function createAddSignalClassificationTool(): ToolDefinition {
  return {
    name: "add_signal_classification",
    description:
      "Classifies a signal as cheap talk, costly signal, or audience cost. Signal classification is central to signaling game analysis.",
    inputSchema: {
      type: "object",
      properties: {
        signal_ref: {
          type: "string",
          description:
            "ID or reference string for the signal being classified.",
        },
        classification: {
          type: "string",
          enum: ["cheap_talk", "costly_signal", "audience_cost"],
          description: "Signal classification.",
        },
        player_id: {
          type: "string",
          description: "Optional ID of the player sending the signal.",
        },
        signal_description: {
          type: "string",
          description: "Optional description of the signal.",
        },
        cost_description: {
          type: "string",
          description: "Optional description of the cost involved (if any).",
        },
        informativeness: {
          type: "string",
          enum: ["high", "medium", "low", "none"],
          description: "How informative this signal is. Defaults to 'medium'.",
        },
      },
      required: ["signal_ref", "classification"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `signal_classification_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addSignalClassificationSchema,
        (data) => {
          const parsed = data as z.infer<typeof addSignalClassificationSchema>;
          return {
            kind: "add_signal_classification" as const,
            id,
            payload: {
              player_id: parsed.player_id ?? parsed.signal_ref,
              signal_description:
                parsed.signal_description ?? parsed.signal_ref,
              classification: parsed.classification,
              cost_description: parsed.cost_description ?? null,
              informativeness: parsed.informativeness,
              informativeness_conditions: [],
              evidence_refs: [],
              game_refs: [],
            },
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createScenarioTools(): ToolDefinition[] {
  return [
    createAddScenarioTool(),
    createUpdateScenarioTool(),
    createAddTailRiskTool(),
    createAddCentralThesisTool(),
    createUpdateCentralThesisTool(),
    createAddEliminatedOutcomeTool(),
    createAddSignalClassificationTool(),
  ];
}
