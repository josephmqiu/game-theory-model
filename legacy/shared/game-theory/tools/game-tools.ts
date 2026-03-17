import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types/agent";
import { executeTool } from "./execute-helper";

// ── add_game ──────────────────────────────────────────────────────────────────

const addGameSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional().default("No description provided."),
  players: z.array(z.string().min(1)).optional(),
  canonical_game_type: z
    .enum([
      "chicken_brinkmanship",
      "prisoners_dilemma",
      "coordination",
      "war_of_attrition",
      "bargaining",
      "signaling",
      "bayesian_incomplete_info",
      "coalition_alliance",
      "domestic_political",
      "economic_chokepoint",
      "bertrand_competition",
      "hotelling_differentiation",
      "entry_deterrence",
      "network_effects_platform",
    ])
    .optional(),
  move_order: z.enum(["simultaneous", "sequential"]).optional(),
  status: z
    .enum(["active", "paused", "resolved", "stale"])
    .optional()
    .default("active"),
});

function createAddGameTool(): ToolDefinition {
  return {
    name: "add_game",
    description:
      "Adds a strategic game to the analysis. A game represents a formal strategic interaction between players.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Human-readable name for the game.",
        },
        description: {
          type: "string",
          description: "Short description of the strategic situation.",
        },
        players: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of player IDs participating in this game.",
        },
        canonical_game_type: {
          type: "string",
          enum: [
            "chicken_brinkmanship",
            "prisoners_dilemma",
            "coordination",
            "war_of_attrition",
            "bargaining",
            "signaling",
            "bayesian_incomplete_info",
            "coalition_alliance",
            "domestic_political",
            "economic_chokepoint",
            "bertrand_competition",
            "hotelling_differentiation",
            "entry_deterrence",
            "network_effects_platform",
          ],
          description: "Canonical game-theoretic classification. Optional.",
        },
        move_order: {
          type: "string",
          enum: ["simultaneous", "sequential"],
          description: "Whether moves are simultaneous or sequential.",
        },
        status: {
          type: "string",
          enum: ["active", "paused", "resolved", "stale"],
          description: "Game status. Defaults to 'active'.",
        },
      },
      required: ["name"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `game_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addGameSchema,
        (data) => {
          const parsed = data as z.infer<typeof addGameSchema>;
          const now = new Date().toISOString();
          return {
            kind: "add_game" as const,
            id,
            payload: {
              name: parsed.name,
              description: parsed.description,
              semantic_labels: [],
              players: parsed.players ?? [],
              status: parsed.status,
              formalizations: [],
              coupling_links: [],
              key_assumptions: [],
              created_at: now,
              updated_at: now,
              ...(parsed.canonical_game_type !== undefined
                ? { canonical_game_type: parsed.canonical_game_type }
                : {}),
              ...(parsed.move_order !== undefined
                ? { move_order: parsed.move_order }
                : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_game ───────────────────────────────────────────────────────────────

const updateGameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["active", "paused", "resolved", "stale"]).optional(),
  canonical_game_type: z
    .enum([
      "chicken_brinkmanship",
      "prisoners_dilemma",
      "coordination",
      "war_of_attrition",
      "bargaining",
      "signaling",
      "bayesian_incomplete_info",
      "coalition_alliance",
      "domestic_political",
      "economic_chokepoint",
      "bertrand_competition",
      "hotelling_differentiation",
      "entry_deterrence",
      "network_effects_platform",
    ])
    .optional(),
  move_order: z.enum(["simultaneous", "sequential"]).optional(),
});

function createUpdateGameTool(): ToolDefinition {
  return {
    name: "update_game",
    description:
      "Updates fields on an existing game by ID. Only provided fields are changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the game to update." },
        name: { type: "string", description: "New name for the game." },
        description: {
          type: "string",
          description: "New description for the game.",
        },
        status: {
          type: "string",
          enum: ["active", "paused", "resolved", "stale"],
          description: "New status.",
        },
        canonical_game_type: {
          type: "string",
          enum: [
            "chicken_brinkmanship",
            "prisoners_dilemma",
            "coordination",
            "war_of_attrition",
            "bargaining",
            "signaling",
            "bayesian_incomplete_info",
            "coalition_alliance",
            "domestic_political",
            "economic_chokepoint",
            "bertrand_competition",
            "hotelling_differentiation",
            "entry_deterrence",
            "network_effects_platform",
          ],
          description: "Updated canonical game type.",
        },
        move_order: {
          type: "string",
          enum: ["simultaneous", "sequential"],
          description: "Updated move order.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateGameSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateGameSchema>;
          const payload = {
            id: parsed.id,
            updated_at: new Date().toISOString(),
            ...(parsed.name !== undefined ? { name: parsed.name } : {}),
            ...(parsed.description !== undefined
              ? { description: parsed.description }
              : {}),
            ...(parsed.status !== undefined ? { status: parsed.status } : {}),
            ...(parsed.canonical_game_type !== undefined
              ? { canonical_game_type: parsed.canonical_game_type }
              : {}),
            ...(parsed.move_order !== undefined
              ? { move_order: parsed.move_order }
              : {}),
          };
          return {
            kind: "update_game" as const,
            payload,
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

// TODO: add_escalation_ladder — deferred to Phase 3 integration
// TODO: run_solver — requires solver infrastructure wiring, deferred

export function createGameTools(): ToolDefinition[] {
  return [createAddGameTool(), createUpdateGameTool()];
}
