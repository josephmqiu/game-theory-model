import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types/agent";
import { executeTool } from "./execute-helper";

// ── add_trust_assessment ──────────────────────────────────────────────────────

const addTrustAssessmentSchema = z.object({
  assessor_player_id: z.string().min(1),
  target_player_id: z.string().min(1),
  level: z.enum(["zero", "low", "moderate", "high"]),
  interaction_history_summary: z.string().min(1).optional(),
  implications: z.string().min(1).optional(),
});

function createAddTrustAssessmentTool(): ToolDefinition {
  return {
    name: "add_trust_assessment",
    description:
      "Records a trust assessment from one player toward another. Trust level affects cooperation dynamics and strategy selection.",
    inputSchema: {
      type: "object",
      properties: {
        assessor_player_id: {
          type: "string",
          description: "ID of the player making the trust assessment.",
        },
        target_player_id: {
          type: "string",
          description: "ID of the player being assessed.",
        },
        level: {
          type: "string",
          enum: ["zero", "low", "moderate", "high"],
          description: "Trust level.",
        },
        interaction_history_summary: {
          type: "string",
          description: "Optional summary of past interactions.",
        },
        implications: {
          type: "string",
          description: "Optional strategic implications of this trust level.",
        },
      },
      required: ["assessor_player_id", "target_player_id", "level"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `trust_assessment_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addTrustAssessmentSchema,
        (data) => {
          const parsed = data as z.infer<typeof addTrustAssessmentSchema>;
          return {
            kind: "add_trust_assessment" as const,
            id,
            payload: {
              assessor_player_id: parsed.assessor_player_id,
              target_player_id: parsed.target_player_id,
              level: parsed.level,
              posterior_belief: {
                representation: "cardinal_estimate" as const,
                value:
                  parsed.level === "zero"
                    ? 0
                    : parsed.level === "low"
                      ? 0.25
                      : parsed.level === "moderate"
                        ? 0.5
                        : 0.85,
                confidence: 0.5,
                rationale: "Default trust estimate from level assignment.",
                source_claims: [] as string[],
              },
              evidence_refs: [],
              interaction_history_summary:
                parsed.interaction_history_summary ?? "",
              driving_patterns: [],
              implications: parsed.implications ?? "",
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_trust_assessment ───────────────────────────────────────────────────

const updateTrustAssessmentSchema = z.object({
  id: z.string().min(1),
  level: z.enum(["zero", "low", "moderate", "high"]).optional(),
  interaction_history_summary: z.string().min(1).optional(),
  implications: z.string().min(1).optional(),
});

function createUpdateTrustAssessmentTool(): ToolDefinition {
  return {
    name: "update_trust_assessment",
    description:
      "Updates an existing trust assessment. Only provided fields are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the trust assessment to update.",
        },
        level: {
          type: "string",
          enum: ["zero", "low", "moderate", "high"],
          description: "New trust level.",
        },
        interaction_history_summary: {
          type: "string",
          description: "Updated interaction history summary.",
        },
        implications: {
          type: "string",
          description: "Updated strategic implications.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateTrustAssessmentSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateTrustAssessmentSchema>;
          const levelValue =
            parsed.level === undefined
              ? {}
              : {
                  level: parsed.level,
                  posterior_belief: {
                    representation: "cardinal_estimate" as const,
                    value:
                      parsed.level === "zero"
                        ? 0
                        : parsed.level === "low"
                          ? 0.25
                          : parsed.level === "moderate"
                            ? 0.5
                            : 0.85,
                    confidence: 0.5,
                    rationale: "Updated trust estimate from level change.",
                    source_claims: [] as string[],
                  },
                };
          const payload = {
            id: parsed.id,
            ...levelValue,
            ...(parsed.interaction_history_summary !== undefined
              ? {
                  interaction_history_summary:
                    parsed.interaction_history_summary,
                }
              : {}),
            ...(parsed.implications !== undefined
              ? { implications: parsed.implications }
              : {}),
          };
          return {
            kind: "update_trust_assessment" as const,
            payload,
          };
        },
        context,
      );
    },
  };
}

// ── add_repeated_game_pattern ─────────────────────────────────────────────────

const addRepeatedGamePatternSchema = z.object({
  game_id: z.string().min(1),
  pattern_type: z.enum([
    "defection_during_cooperation",
    "tit_for_tat",
    "grim_trigger",
    "selective_forgiveness",
    "dual_track_deception",
    "adverse_selection",
  ]),
  description: z.string().min(1).optional(),
  impact_on_trust: z.string().min(1).optional(),
  impact_on_model: z.string().min(1).optional(),
});

function createAddRepeatedGamePatternTool(): ToolDefinition {
  return {
    name: "add_repeated_game_pattern",
    description:
      "Records a repeated-game interaction pattern observed in a game — e.g. tit-for-tat, grim trigger, defection during cooperation.",
    inputSchema: {
      type: "object",
      properties: {
        game_id: {
          type: "string",
          description: "ID of the game this pattern belongs to.",
        },
        pattern_type: {
          type: "string",
          enum: [
            "defection_during_cooperation",
            "tit_for_tat",
            "grim_trigger",
            "selective_forgiveness",
            "dual_track_deception",
            "adverse_selection",
          ],
          description: "Type of repeated-game pattern observed.",
        },
        description: {
          type: "string",
          description: "Optional description of the pattern in this context.",
        },
        impact_on_trust: {
          type: "string",
          description:
            "Optional description of how this pattern affects trust.",
        },
        impact_on_model: {
          type: "string",
          description:
            "Optional description of how this pattern affects the game model.",
        },
      },
      required: ["game_id", "pattern_type"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `repeated_game_pattern_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addRepeatedGamePatternSchema,
        (data) => {
          const parsed = data as z.infer<typeof addRepeatedGamePatternSchema>;
          return {
            kind: "add_repeated_game_pattern" as const,
            id,
            payload: {
              game_id: parsed.game_id,
              pattern_type: parsed.pattern_type,
              description: parsed.description ?? "",
              instances: [],
              impact_on_trust: parsed.impact_on_trust ?? "",
              impact_on_model: parsed.impact_on_model ?? "",
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_dynamic_inconsistency_risk ────────────────────────────────────────────

const addDynamicInconsistencyRiskSchema = z.object({
  player_id: z.string().min(1),
  commitment_description: z.string().min(1),
  risk_type: z.enum([
    "leadership_transition",
    "electoral_cycle",
    "executive_vs_legislative",
    "bureaucratic_reversal",
    "other",
  ]),
  durability: z.enum(["fragile", "moderate", "durable"]).default("moderate"),
  mitigation: z.string().min(1).optional(),
});

function createAddDynamicInconsistencyRiskTool(): ToolDefinition {
  return {
    name: "add_dynamic_inconsistency_risk",
    description:
      "Records a dynamic inconsistency risk — where a player's commitment may not hold over time due to political or institutional factors.",
    inputSchema: {
      type: "object",
      properties: {
        player_id: {
          type: "string",
          description: "ID of the player whose commitment is at risk.",
        },
        commitment_description: {
          type: "string",
          description: "Description of the commitment being made.",
        },
        risk_type: {
          type: "string",
          enum: [
            "leadership_transition",
            "electoral_cycle",
            "executive_vs_legislative",
            "bureaucratic_reversal",
            "other",
          ],
          description: "Type of risk driving the inconsistency.",
        },
        durability: {
          type: "string",
          enum: ["fragile", "moderate", "durable"],
          description: "How durable the commitment is. Defaults to 'moderate'.",
        },
        mitigation: {
          type: "string",
          description: "Optional description of mitigation strategies.",
        },
      },
      required: ["player_id", "commitment_description", "risk_type"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `dynamic_inconsistency_risk_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addDynamicInconsistencyRiskSchema,
        (data) => {
          const parsed = data as z.infer<
            typeof addDynamicInconsistencyRiskSchema
          >;
          return {
            kind: "add_dynamic_inconsistency_risk" as const,
            id,
            payload: {
              player_id: parsed.player_id,
              commitment_description: parsed.commitment_description,
              risk_type: parsed.risk_type,
              durability: parsed.durability,
              evidence_refs: [],
              affected_games: [],
              mitigation: parsed.mitigation ?? null,
            },
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createHistoryTools(): ToolDefinition[] {
  return [
    createAddTrustAssessmentTool(),
    createUpdateTrustAssessmentTool(),
    createAddRepeatedGamePatternTool(),
    createAddDynamicInconsistencyRiskTool(),
  ];
}
