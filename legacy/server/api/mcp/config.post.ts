import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import type {
  IntegrationStatusSnapshot,
  MCPCliTool,
  MCPTransportMode,
} from "../../../src/types/agent-settings";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { writeManagedMcpConfig } from "../../utils/mcp-config-writers";

const configSchema = z.object({
  tool: z.enum([
    "claude-code",
    "codex-cli",
    "gemini-cli",
    "opencode-cli",
    "kiro-cli",
    "copilot-cli",
  ]),
  transportMode: z.enum(["stdio", "http", "both"]),
});

async function findIntegration(
  tool: MCPCliTool,
): Promise<IntegrationStatusSnapshot | undefined> {
  return (await getMcpIntegrationStatuses()).find((entry) => entry.tool === tool);
}

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = configSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid MCP config request.",
    };
  }

  const integration = await findIntegration(parsed.data.tool);
  if (!integration) {
    setResponseStatus(event, 404);
    return {
      status: "error",
      error: "Integration not found.",
    };
  }

  if (!integration.installed) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: `${parsed.data.tool} is not installed on this machine.`,
    };
  }

  const outputPath = await writeManagedMcpConfig(
    parsed.data.tool,
    parsed.data.transportMode as MCPTransportMode,
  );
  const refreshed = await findIntegration(parsed.data.tool);

  return {
    status: "ok",
    path: outputPath.outputPath,
    integration: refreshed
      ? {
          ...refreshed,
          validated: outputPath.reachable,
          authenticated: integration.authenticated,
          statusStage: outputPath.reachable ? "ready" : "config_written",
          reachable: outputPath.reachable,
          lastError: outputPath.reachable
            ? null
            : "Managed config was written, but runtime smoke validation failed.",
          configPath: outputPath.outputPath,
          statusMessage: outputPath.reachable
            ? `Managed MCP config written for ${parsed.data.tool}.`
            : `Managed MCP config written for ${parsed.data.tool}, but runtime validation still failed.`,
        }
      : {
          ...integration,
          validated: outputPath.reachable,
          statusStage: outputPath.reachable ? "ready" : "config_written",
          reachable: outputPath.reachable,
          lastError: outputPath.reachable
            ? null
            : "Managed config was written, but runtime smoke validation failed.",
          configPath: outputPath.outputPath,
          statusMessage: outputPath.reachable
            ? `Managed MCP config written for ${parsed.data.tool}.`
            : `Managed MCP config written for ${parsed.data.tool}, but runtime validation still failed.`,
        },
  };
});
