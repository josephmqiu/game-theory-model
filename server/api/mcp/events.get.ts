/**
 * GET /api/mcp/events — SSE stream for live state updates.
 * Clients (renderer, MCP) subscribe to receive state changes.
 */

import { defineEventHandler } from "h3";
import {
  getSyncState,
  registerSSEClient,
  unregisterSSEClient,
} from "../../utils/mcp-sync-state";
import { getPendingCommands } from "../../utils/mcp-command-bus";

export default defineEventHandler((event) => {
  const res = event.node.res;
  const clientId = crypto.randomUUID();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "http://localhost:3000",
  });

  // Send client ID
  res.write(`data: ${JSON.stringify({ type: "client:id", clientId })}\n\n`);

  // Send current state snapshot
  const { state, version } = getSyncState();
  if (state.canonical) {
    res.write(
      `data: ${JSON.stringify({ type: "state:update", version, state })}\n\n`,
    );
  }
  for (const command of getPendingCommands()) {
    res.write(
      `data: ${JSON.stringify({ type: "command:queued", command })}\n\n`,
    );
  }

  registerSSEClient(clientId, res);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      if (!res.closed) {
        res.write(`: heartbeat\n\n`);
      }
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  // Clean up on close
  res.on("close", () => {
    clearInterval(heartbeat);
    unregisterSSEClient(clientId);
  });

  // Return a promise that resolves on close to keep the connection open
  return new Promise<void>((resolve) => {
    res.on("close", resolve);
  });
});
