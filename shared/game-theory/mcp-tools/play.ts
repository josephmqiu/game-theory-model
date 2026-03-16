import { z } from "zod";

import type { McpServerLike } from "./context";

export function registerPlayTools(server: McpServerLike): void {
  server.registerTool({
    name: "start_play_session",
    description: "Start a headless play-out session from a given scenario.",
    inputSchema: z.object({
      scenario_id: z.string(),
      ai_controlled_players: z.array(z.string()).optional(),
    }),
    execute() {
      return {
        success: false,
        error: "Play-out sessions are not implemented in M5.",
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
    execute() {
      return {
        success: false,
        error: "Play-out sessions are not implemented in M5.",
      };
    },
  });
}
