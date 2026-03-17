import { z } from "zod";

import type { McpServerLike, RuntimeToolContext } from "./context";

export function registerPlayTools(
  server: McpServerLike,
  context: RuntimeToolContext,
): void {
  server.registerTool({
    name: "start_play_session",
    description: "Start a headless play-out session from a given scenario.",
    inputSchema: z.object({
      scenario_id: z.string(),
      ai_controlled_players: z.array(z.string()).optional(),
    }),
    async execute(input) {
      if (!context.executeCommand) {
        return {
          success: false,
          error: "Play-out command execution is unavailable in this runtime.",
        };
      }

      const result = await context.executeCommand("start_play_session", {
        scenarioId: input.scenario_id,
        aiControlledPlayers: input.ai_controlled_players,
      });

      return {
        success: true,
        data: result,
      };
    },
  });

  server.registerTool({
    name: "play_turn",
    description: "Execute a single turn in an active play-out session.",
    inputSchema: z.object({
      session_id: z.string(),
      player_id: z.string(),
      action: z.string(),
      reasoning: z.string().optional(),
    }),
    async execute(input) {
      if (!context.executeCommand) {
        return {
          success: false,
          error: "Play-out command execution is unavailable in this runtime.",
        };
      }

      const result = await context.executeCommand("play_turn", {
        sessionId: input.session_id,
        playerId: input.player_id,
        action: input.action,
        reasoning: input.reasoning,
      });

      return {
        success: true,
        data: result,
      };
    },
  });
}
