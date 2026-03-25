import { defineEventHandler, setResponseHeaders } from "h3";
import { getStatus } from "../../utils/mcp-server-manager";

/** POST /api/mcp/server — Returns the current in-process MCP server status. */
export default defineEventHandler((event) => {
  setResponseHeaders(event, { "Content-Type": "application/json" });
  return getStatus();
});
