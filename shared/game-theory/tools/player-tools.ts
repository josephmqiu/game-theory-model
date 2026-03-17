import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types/agent";
import type { Command } from "../engine/commands";
import { executeTool } from "./execute-helper";

// ── add_player ────────────────────────────────────────────────────────────────

const addPlayerObjectiveSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1).optional(),
});

const addPlayerConstraintSchema = z.object({
  label: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(["soft", "hard"]),
  description: z.string().min(1).optional(),
});

const addPlayerSchema = z.object({
  name: z.string().min(1),
  type: z
    .enum([
      "state",
      "organization",
      "market",
      "public",
      "coalition",
      "individual",
    ])
    .optional()
    .default("individual"),
  role: z
    .enum(["primary", "involuntary", "background", "gatekeeper", "internal"])
    .optional(),
  objectives: z.array(addPlayerObjectiveSchema).optional(),
  constraints: z.array(addPlayerConstraintSchema).optional(),
});

function buildObjective(obj: z.infer<typeof addPlayerObjectiveSchema>): {
  label: string;
  weight: {
    representation: "cardinal_estimate";
    value: number;
    confidence: number;
    rationale: string;
    source_claims: string[];
  };
  description?: string;
} {
  return {
    label: obj.label,
    weight: {
      representation: "cardinal_estimate" as const,
      value: 0.5,
      confidence: 0.5,
      rationale: "Default weight assigned at creation.",
      source_claims: [],
    },
    ...(obj.description !== undefined ? { description: obj.description } : {}),
  };
}

function createAddPlayerTool(): ToolDefinition {
  return {
    name: "add_player",
    description:
      "Adds a player (state, organization, coalition, etc.) to the analysis. Players are the key actors whose strategic interactions are modelled.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Human-readable name for the player.",
        },
        type: {
          type: "string",
          enum: [
            "state",
            "organization",
            "market",
            "public",
            "coalition",
            "individual",
          ],
          description: "Category of actor. Defaults to 'individual'.",
        },
        role: {
          type: "string",
          enum: [
            "primary",
            "involuntary",
            "background",
            "gatekeeper",
            "internal",
          ],
          description: "Strategic role of the player in the game. Optional.",
        },
        objectives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Short label for the objective.",
              },
              description: {
                type: "string",
                description: "Optional longer description.",
              },
            },
            required: ["label"],
          },
          description: "Optional list of player objectives.",
        },
        constraints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Short label for the constraint.",
              },
              type: {
                type: "string",
                description: "Constraint category (e.g. 'legal', 'resource').",
              },
              severity: {
                type: "string",
                enum: ["soft", "hard"],
                description: "Whether the constraint is hard or soft.",
              },
              description: {
                type: "string",
                description: "Optional longer description.",
              },
            },
            required: ["label", "type", "severity"],
          },
          description: "Optional list of player constraints.",
        },
      },
      required: ["name"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `player_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addPlayerSchema,
        (data) => {
          const parsed = data as z.infer<typeof addPlayerSchema>;
          return {
            kind: "add_player" as const,
            id,
            payload: {
              name: parsed.name,
              type: parsed.type,
              objectives: (parsed.objectives ?? []).map(buildObjective),
              constraints: parsed.constraints ?? [],
              ...(parsed.role !== undefined ? { role: parsed.role } : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── update_player ─────────────────────────────────────────────────────────────

const updatePlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  type: z
    .enum([
      "state",
      "organization",
      "market",
      "public",
      "coalition",
      "individual",
    ])
    .optional(),
  role: z
    .enum(["primary", "involuntary", "background", "gatekeeper", "internal"])
    .optional(),
});

function createUpdatePlayerTool(): ToolDefinition {
  return {
    name: "update_player",
    description:
      "Updates fields on an existing player by ID. Only the provided fields are changed; all others remain as-is.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID of the player to update.",
        },
        name: {
          type: "string",
          description: "New name for the player.",
        },
        type: {
          type: "string",
          enum: [
            "state",
            "organization",
            "market",
            "public",
            "coalition",
            "individual",
          ],
          description: "New player type.",
        },
        role: {
          type: "string",
          enum: [
            "primary",
            "involuntary",
            "background",
            "gatekeeper",
            "internal",
          ],
          description: "New strategic role.",
        },
      },
      required: ["id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updatePlayerSchema,
        (data) => {
          const parsed = data as z.infer<typeof updatePlayerSchema>;
          return {
            kind: "update_player" as const,
            id: parsed.id,
            payload: {
              id: parsed.id,
              ...(parsed.name !== undefined ? { name: parsed.name } : {}),
              ...(parsed.type !== undefined ? { type: parsed.type } : {}),
              ...(parsed.role !== undefined ? { role: parsed.role } : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── add_player_objective ──────────────────────────────────────────────────────

const addPlayerObjectivePatchSchema = z.object({
  player_id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  weight: z.number().min(0).max(1).optional(),
});

function createAddPlayerObjectiveTool(): ToolDefinition {
  return {
    name: "add_player_objective",
    description:
      "Appends an objective to an existing player's objectives list. Uses update_player to add to the existing objectives array.",
    inputSchema: {
      type: "object",
      properties: {
        player_id: {
          type: "string",
          description: "ID of the player to add the objective to.",
        },
        label: {
          type: "string",
          description: "Short label for the objective.",
        },
        description: {
          type: "string",
          description: "Optional longer description of the objective.",
        },
        weight: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Relative importance from 0 to 1. Defaults to 0.5.",
        },
      },
      required: ["player_id", "label"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const parsed = addPlayerObjectivePatchSchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { player_id, label, description, weight } = parsed.data;

      // Read the current player from the canonical store
      const existingPlayer = context.canonical.players[player_id];
      if (!existingPlayer) {
        return {
          success: false,
          error: `Player ${player_id} does not exist.`,
        };
      }

      const newObjective = {
        label,
        weight: {
          representation: "cardinal_estimate" as const,
          value: weight ?? 0.5,
          confidence: 0.5,
          rationale: "Weight assigned via add_player_objective tool.",
          source_claims: [] as string[],
        },
        ...(description !== undefined ? { description } : {}),
      };

      const command: Command = {
        kind: "update_player" as const,
        payload: {
          id: player_id,
          objectives: [...existingPlayer.objectives, newObjective],
        },
      };

      const result = context.dispatch(command);

      if (result.status === "committed") {
        return {
          success: true,
          data: { id: player_id, kind: "update_player" },
        };
      }

      const errors =
        result.status === "rejected"
          ? result.errors
          : ["Dispatch returned dry_run"];
      return { success: false, error: errors.join("; ") };
    },
  };
}

// ── update_information_state ──────────────────────────────────────────────────

const updateInformationStateSchema = z.object({
  player_id: z.string().min(1),
  knows: z.array(z.string()).optional(),
  doesnt_know: z.array(z.string()).optional(),
  beliefs: z.array(z.string()).optional(),
});

function createUpdateInformationStateTool(): ToolDefinition {
  return {
    name: "update_information_state",
    description:
      "Sets or replaces the information state of a player — what they know, don't know, and what beliefs they hold. Uses update_player under the hood.",
    inputSchema: {
      type: "object",
      properties: {
        player_id: {
          type: "string",
          description: "ID of the player whose information state to update.",
        },
        knows: {
          type: "array",
          items: { type: "string" },
          description:
            "List of propositions or facts the player is known to know.",
        },
        doesnt_know: {
          type: "array",
          items: { type: "string" },
          description: "List of propositions the player is known not to know.",
        },
        beliefs: {
          type: "array",
          items: { type: "string" },
          description:
            "List of beliefs the player holds (possibly with uncertainty).",
        },
      },
      required: ["player_id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      return executeTool(
        input,
        updateInformationStateSchema,
        (data) => {
          const parsed = data as z.infer<typeof updateInformationStateSchema>;
          return {
            kind: "update_player" as const,
            payload: {
              id: parsed.player_id,
              information_state: {
                knows: parsed.knows ?? [],
                doesnt_know: parsed.doesnt_know ?? [],
                beliefs: parsed.beliefs ?? [],
              },
            },
          };
        },
        context,
      );
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createPlayerTools(): ToolDefinition[] {
  return [
    createAddPlayerTool(),
    createUpdatePlayerTool(),
    createAddPlayerObjectiveTool(),
    createUpdateInformationStateTool(),
  ];
}
