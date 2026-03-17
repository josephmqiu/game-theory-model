import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types/agent";
import { executeTool } from "./execute-helper";

// ── add_cross_game_link ────────────────────────────────────────────────────────

const addCrossGameLinkSchema = z.object({
  source_game_id: z.string().min(1),
  target_game_id: z.string().min(1),
  trigger_ref_id: z.string().min(1).optional(),
  trigger: z.string().min(1).optional(),
  effect_type: z
    .enum([
      "payoff_shift",
      "belief_update",
      "strategy_unlock",
      "strategy_remove",
      "timing_change",
      "player_entry",
      "player_exit",
      "resource_transfer",
      "commitment_change",
    ])
    .default("payoff_shift"),
  magnitude_value: z.number().optional(),
  rationale: z.string().min(1).optional(),
});

function createAddCrossGameLinkTool(): ToolDefinition {
  return {
    name: "add_cross_game_link",
    description:
      "Creates a cross-game link recording how an event in one game triggers effects in another game.",
    inputSchema: {
      type: "object",
      properties: {
        source_game_id: {
          type: "string",
          description: "ID of the game where the trigger originates.",
        },
        target_game_id: {
          type: "string",
          description: "ID of the game that is affected.",
        },
        trigger_ref_id: {
          type: "string",
          description:
            "ID of an existing game_node or game_edge that acts as the trigger. Required for referential integrity.",
        },
        trigger: {
          type: "string",
          description:
            "Human-readable description of what triggers this cross-game effect.",
        },
        effect_type: {
          type: "string",
          enum: [
            "payoff_shift",
            "belief_update",
            "strategy_unlock",
            "strategy_remove",
            "timing_change",
            "player_entry",
            "player_exit",
            "resource_transfer",
            "commitment_change",
          ],
          description:
            "Type of effect in the target game. Defaults to 'payoff_shift'.",
        },
        magnitude_value: {
          type: "number",
          description: "Optional numeric magnitude of the effect.",
        },
        rationale: {
          type: "string",
          description: "Rationale for this cross-game link.",
        },
      },
      required: ["source_game_id", "target_game_id"],
    },
    execute: async (input: Record<string, unknown>, context: ToolContext) => {
      const id = `cross_game_link_${crypto.randomUUID()}`;
      return executeTool(
        input,
        addCrossGameLinkSchema,
        (data) => {
          const parsed = data as z.infer<typeof addCrossGameLinkSchema>;
          const triggerRef =
            parsed.trigger_ref_id ?? parsed.trigger ?? `link_${id}`;
          const magnitude =
            parsed.magnitude_value !== undefined
              ? {
                  representation: "cardinal_estimate" as const,
                  value: parsed.magnitude_value,
                  confidence: 0.5,
                  rationale: "Magnitude set at link creation.",
                  source_claims: [] as string[],
                }
              : undefined;
          return {
            kind: "add_cross_game_link" as const,
            id,
            payload: {
              source_game_id: parsed.source_game_id,
              target_game_id: parsed.target_game_id,
              trigger_ref: triggerRef,
              effect_type: parsed.effect_type,
              target_ref: parsed.target_game_id,
              rationale: parsed.rationale ?? "",
              ...(magnitude !== undefined ? { magnitude } : {}),
            },
          };
        },
        context,
      );
    },
  };
}

// ── check_disruption_triggers ─────────────────────────────────────────────────

function createCheckDisruptionTriggersTool(): ToolDefinition {
  return {
    name: "check_disruption_triggers",
    description:
      "Read-only tool. Scans the canonical state for active disruption trigger conditions across cross-game links and escalation ladders. Returns a list of triggered conditions.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (
      _input: Record<string, unknown>,
      context: ToolContext,
    ): Promise<ToolResult> => {
      const store = context.canonical;
      const triggers: Array<{ trigger: string; affected_phases: number[] }> =
        [];

      // Check cross-game links for active trigger conditions
      for (const link of Object.values(store.cross_game_links)) {
        const sourceGame = store.games[link.source_game_id];
        const targetGame = store.games[link.target_game_id];
        if (
          sourceGame?.status === "active" &&
          targetGame?.status === "active"
        ) {
          triggers.push({
            trigger: `Cross-game link: ${sourceGame.name} → ${targetGame.name} (${link.effect_type})`,
            affected_phases: [3, 5],
          });
        }
      }

      // Check for stale markers on critical entities
      for (const assumption of Object.values(store.assumptions)) {
        if (
          assumption.sensitivity === "critical" &&
          assumption.stale_markers &&
          assumption.stale_markers.length > 0
        ) {
          triggers.push({
            trigger: `Critical assumption stale: "${assumption.statement}"`,
            affected_phases: [2, 3, 4, 5, 6, 7, 8, 9],
          });
        }
      }

      return {
        success: true,
        data: { triggers },
      };
    },
  };
}

// ── propose_revision ──────────────────────────────────────────────────────────

const proposeRevisionSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  changes: z.record(z.unknown()),
  rationale: z.string().min(1),
});

function createProposeRevisionTool(): ToolDefinition {
  return {
    name: "propose_revision",
    description:
      "Proposes a revision to an existing entity. The proposal is returned as a pending object for UI review — no changes are committed immediately.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          description:
            "Entity type to revise (e.g. 'game', 'player', 'assumption').",
        },
        entity_id: {
          type: "string",
          description: "ID of the entity to revise.",
        },
        changes: {
          type: "object",
          additionalProperties: true,
          description: "Map of field names to new values.",
        },
        rationale: {
          type: "string",
          description: "Reason for the proposed revision.",
        },
      },
      required: ["entity_type", "entity_id", "changes", "rationale"],
    },
    execute: async (
      input: Record<string, unknown>,
      _context: ToolContext,
    ): Promise<ToolResult> => {
      const parsed = proposeRevisionSchema.safeParse(input);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((i) => i.message).join("; ");
        return { success: false, error: `Invalid input: ${messages}` };
      }

      const { entity_type, entity_id, changes, rationale } = parsed.data;
      const proposalId = `proposal_${crypto.randomUUID()}`;

      return {
        success: true,
        data: {
          proposal_id: proposalId,
          entity_type,
          entity_id,
          changes,
          rationale,
          status: "pending" as const,
        },
      };
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createWorkflowTools(): ToolDefinition[] {
  return [
    createAddCrossGameLinkTool(),
    createCheckDisruptionTriggersTool(),
    createProposeRevisionTool(),
  ];
}
