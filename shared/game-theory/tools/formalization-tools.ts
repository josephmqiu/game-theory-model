import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types/agent";
import type { Command } from "../engine/commands";

// ── add_formalization ─────────────────────────────────────────────────────────

const addFormalizationSchema = z.object({
  game_id: z.string().min(1),
  kind: z
    .enum([
      "normal_form",
      "extensive_form",
      "repeated",
      "bayesian",
      "coalition",
      "bargaining",
      "evolutionary",
      "signaling",
    ])
    .default("normal_form"),
  purpose: z
    .enum(["explanatory", "computational", "playout"])
    .default("explanatory"),
  abstraction_level: z
    .enum(["minimal", "moderate", "detailed"])
    .default("minimal"),
  notes: z.string().min(1).optional(),
});

function createAddFormalizationTool(): ToolDefinition {
  return {
    name: "add_formalization",
    description:
      "Adds a formalization (mathematical model) to an existing game. A formalization is the formal representation of a game's structure.",
    inputSchema: {
      type: "object",
      properties: {
        game_id: {
          type: "string",
          description: "ID of the game to attach this formalization to.",
        },
        kind: {
          type: "string",
          enum: [
            "normal_form",
            "extensive_form",
            "repeated",
            "bayesian",
            "coalition",
            "bargaining",
            "evolutionary",
            "signaling",
          ],
          description: "Type of formalization. Defaults to 'normal_form'.",
        },
        purpose: {
          type: "string",
          enum: ["explanatory", "computational", "playout"],
          description:
            "Purpose of this formalization. Defaults to 'explanatory'.",
        },
        abstraction_level: {
          type: "string",
          enum: ["minimal", "moderate", "detailed"],
          description: "Level of abstraction. Defaults to 'minimal'.",
        },
        notes: {
          type: "string",
          description: "Optional notes about this formalization.",
        },
      },
      required: ["game_id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const formalizationId = `formalization_${crypto.randomUUID()}`;

      const parsed = addFormalizationSchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { game_id, kind, purpose, abstraction_level, notes } = parsed.data;

      // Check game exists
      const game = context.canonical.games[game_id];
      if (!game) {
        return {
          success: false,
          error: `Game ${game_id} does not exist.`,
        };
      }

      // Build the kind-specific payload
      let formalizationPayload: Record<string, unknown>;

      if (kind === "normal_form") {
        formalizationPayload = {
          game_id,
          kind: "normal_form" as const,
          purpose,
          abstraction_level,
          assumptions: [],
          strategies: {},
          payoff_cells: [],
          ...(notes !== undefined ? { notes } : {}),
        };
      } else if (kind === "extensive_form") {
        formalizationPayload = {
          game_id,
          kind: "extensive_form" as const,
          purpose,
          abstraction_level,
          assumptions: [],
          root_node_id: "",
          information_sets: [],
          ...(notes !== undefined ? { notes } : {}),
        };
      } else {
        // For other kinds, default to normal_form structure — analyst can update
        formalizationPayload = {
          game_id,
          kind: "normal_form" as const,
          purpose,
          abstraction_level,
          assumptions: [],
          strategies: {},
          payoff_cells: [],
          ...(notes !== undefined ? { notes } : {}),
        };
      }

      // First add the formalization
      const addResult = context.dispatch({
        kind: "add_formalization" as const,
        id: formalizationId,
        payload: formalizationPayload as Parameters<
          typeof context.dispatch
        >[0] extends { kind: "add_formalization"; payload: infer P }
          ? P
          : never,
      });

      if (addResult.status !== "committed") {
        const errors =
          addResult.status === "rejected"
            ? addResult.errors
            : ["Dispatch returned dry_run"];
        return { success: false, error: errors.join("; ") };
      }

      // Attach formalization to game
      const attachResult = context.dispatch({
        kind: "attach_formalization_to_game" as const,
        payload: { game_id, formalization_id: formalizationId },
      });

      if (attachResult.status !== "committed") {
        const errors =
          attachResult.status === "rejected"
            ? attachResult.errors
            : ["Dispatch returned dry_run"];
        return { success: false, error: errors.join("; ") };
      }

      return {
        success: true,
        data: { id: formalizationId, kind: "add_formalization" },
      };
    },
  };
}

// ── add_strategy ──────────────────────────────────────────────────────────────

const addStrategySchema = z.object({
  formalization_id: z.string().min(1),
  player_id: z.string().min(1),
  strategy_label: z.string().min(1),
});

function createAddStrategyTool(): ToolDefinition {
  return {
    name: "add_strategy",
    description:
      "Adds a strategy option for a player to a normal-form formalization. Strategies are stored in the formalization's strategies record.",
    inputSchema: {
      type: "object",
      properties: {
        formalization_id: {
          type: "string",
          description: "ID of the normal-form formalization.",
        },
        player_id: {
          type: "string",
          description: "Player ID whose strategy set is being extended.",
        },
        strategy_label: {
          type: "string",
          description:
            "Label for the new strategy (e.g. 'Cooperate', 'Defect').",
        },
      },
      required: ["formalization_id", "player_id", "strategy_label"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const parsed = addStrategySchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { formalization_id, player_id, strategy_label } = parsed.data;

      const existing = context.canonical.formalizations[formalization_id];
      if (!existing) {
        return {
          success: false,
          error: `Formalization ${formalization_id} does not exist.`,
        };
      }

      if (existing.kind !== "normal_form") {
        return {
          success: false,
          error: `add_strategy only supports normal_form formalizations (got '${existing.kind}').`,
        };
      }

      const currentStrategies = existing.strategies[player_id] ?? [];
      const updatedStrategies = {
        ...existing.strategies,
        [player_id]: [...currentStrategies, strategy_label],
      };

      const command: Command = {
        kind: "update_formalization" as const,
        payload: {
          id: formalization_id,
          strategies: updatedStrategies,
        },
      };

      const result = context.dispatch(command);

      if (result.status === "committed") {
        return {
          success: true,
          data: { id: formalization_id, kind: "update_formalization" },
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

// ── set_payoff ────────────────────────────────────────────────────────────────

const setPayoffSchema = z.object({
  formalization_id: z.string().min(1),
  strategy_profile: z.record(z.string(), z.string()),
  player_id: z.string().min(1),
  value: z.number(),
  confidence: z.number().min(0).max(1).default(0.7),
  rationale: z.string().min(1).default("Payoff assigned via set_payoff tool."),
});

function createSetPayoffTool(): ToolDefinition {
  return {
    name: "set_payoff",
    description:
      "Sets a payoff value for a player in a given strategy profile within a normal-form formalization. Fails if the formalization does not exist.",
    inputSchema: {
      type: "object",
      properties: {
        formalization_id: {
          type: "string",
          description: "ID of the normal-form formalization.",
        },
        strategy_profile: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "Map of player_id → strategy_label describing the joint strategy profile.",
        },
        player_id: {
          type: "string",
          description: "Player whose payoff is being set.",
        },
        value: {
          type: "number",
          description: "Numeric payoff value.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description:
            "Confidence in this payoff estimate (0-1). Defaults to 0.7.",
        },
        rationale: {
          type: "string",
          description: "Rationale for this payoff value.",
        },
      },
      required: ["formalization_id", "strategy_profile", "player_id", "value"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const parsed = setPayoffSchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const {
        formalization_id,
        strategy_profile,
        player_id,
        value,
        confidence,
        rationale,
      } = parsed.data;

      const existing = context.canonical.formalizations[formalization_id];
      if (!existing) {
        return {
          success: false,
          error: `Formalization ${formalization_id} does not exist.`,
        };
      }

      if (existing.kind !== "normal_form") {
        return {
          success: false,
          error: `set_payoff only supports normal_form formalizations (got '${existing.kind}').`,
        };
      }

      // Validate strategy profile matches formalization strategies
      for (const [pid, stratLabel] of Object.entries(strategy_profile)) {
        const validStrategies = existing.strategies[pid];
        if (!validStrategies) {
          return {
            success: false,
            error: `Player ${pid} has no strategies defined in formalization ${formalization_id}.`,
          };
        }
        if (!validStrategies.includes(stratLabel)) {
          return {
            success: false,
            error: `Strategy '${stratLabel}' is not valid for player ${pid}. Valid strategies: ${validStrategies.join(", ")}.`,
          };
        }
      }

      const payoffEstimate = {
        representation: "cardinal_estimate" as const,
        value,
        confidence,
        rationale,
        source_claims: [] as string[],
      };

      // Find or create the cell
      const existingCells = existing.payoff_cells ?? [];
      const cellIndex = existingCells.findIndex((cell) => {
        const profileKeys = Object.keys(strategy_profile);
        return profileKeys.every(
          (pid) => cell.strategy_profile[pid] === strategy_profile[pid],
        );
      });

      let updatedCells: typeof existingCells;
      if (cellIndex >= 0) {
        const existingCell = existingCells[cellIndex]!;
        updatedCells = [
          ...existingCells.slice(0, cellIndex),
          {
            ...existingCell,
            payoffs: {
              ...existingCell.payoffs,
              [player_id]: payoffEstimate,
            },
          },
          ...existingCells.slice(cellIndex + 1),
        ];
      } else {
        updatedCells = [
          ...existingCells,
          {
            strategy_profile,
            payoffs: { [player_id]: payoffEstimate },
          },
        ];
      }

      const command: Command = {
        kind: "update_formalization" as const,
        payload: {
          id: formalization_id,
          payoff_cells: updatedCells,
        },
      };

      const result = context.dispatch(command);

      if (result.status === "committed") {
        return {
          success: true,
          data: { id: formalization_id, kind: "update_formalization" },
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

// ── Public factory ────────────────────────────────────────────────────────────

export function createFormalizationTools(): ToolDefinition[] {
  return [
    createAddFormalizationTool(),
    createAddStrategyTool(),
    createSetPayoffTool(),
  ];
}
