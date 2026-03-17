import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import type { IntegrationStatusSnapshot, MCPCliTool } from "../../../src/types/agent-settings";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { deleteManagedMcpConfig } from "../../utils/mcp-config-writers";

const deleteSchema = z.object({
  tool: z.enum([
    "claude-code",
    "codex-cli",
    "gemini-cli",
    "opencode-cli",
    "kiro-cli",
    "copilot-cli",
  ]),
});

async function findIntegration(
  tool: MCPCliTool,
): Promise<IntegrationStatusSnapshot | undefined> {
  return (await getMcpIntegrationStatuses()).find((entry) => entry.tool === tool);
}

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = deleteSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid MCP config delete request.",
    };
  }

  await deleteManagedMcpConfig(parsed.data.tool);
  const refreshed = await findIntegration(parsed.data.tool);

  return {
    status: "ok",
    integration: refreshed
      ? {
          ...refreshed,
          statusMessage: `Managed MCP config removed for ${parsed.data.tool}.`,
          configPath: null,
        }
      : null,
  };
});
