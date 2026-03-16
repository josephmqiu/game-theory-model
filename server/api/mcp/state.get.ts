/**
 * GET /api/mcp/state — returns the current synced state for MCP to read.
 */

import { defineEventHandler } from "h3";
import { getSyncState } from "../../utils/mcp-sync-state";

export default defineEventHandler(() => {
  const { state, version } = getSyncState();

  if (!state.canonical) {
    return { status: "no_state", version: 0 };
  }

  return { status: "ok", version, state };
});
