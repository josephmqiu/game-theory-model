import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import type {
  AIProviderType,
  IntegrationStatusSnapshot,
  MCPCliTool,
  ProviderStatusSnapshot,
} from "../../../src/types/agent-settings";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { discoverAgentConnection } from "../ai/connect-agent.post";

const validateSchema = z.object({
  kind: z.enum(["provider", "integration"]),
  target: z.string().min(1),
});

const PROVIDER_TO_AGENT: Record<
  AIProviderType,
  "claude-code" | "codex-cli" | "opencode" | "copilot"
> = {
  anthropic: "claude-code",
  openai: "codex-cli",
  opencode: "opencode",
  copilot: "copilot",
};

function isProvider(target: string): target is AIProviderType {
  return target in PROVIDER_TO_AGENT;
}

function isIntegration(target: string): target is MCPCliTool {
  return [
    "claude-code",
    "codex-cli",
    "gemini-cli",
    "opencode-cli",
    "kiro-cli",
    "copilot-cli",
  ].includes(target);
}

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = validateSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid validation request.",
    };
  }

  if (parsed.data.kind === "provider") {
    if (!isProvider(parsed.data.target)) {
      setResponseStatus(event, 400);
      return { status: "error", error: "Unknown provider." };
    }

    const result = await discoverAgentConnection(
      PROVIDER_TO_AGENT[parsed.data.target],
    );

    const snapshot: ProviderStatusSnapshot = {
      provider: parsed.data.target,
      installed: !result.notInstalled,
      authenticated: result.connected ? true : null,
      validated: result.connected,
      statusMessage:
        result.error ??
        (result.connected
          ? `${result.models?.length ?? 0} models validated.`
          : "Validation failed."),
      lastCheckedAt: new Date().toISOString(),
      configPath: null,
    };

    return {
      status: result.connected ? "ok" : "error",
      provider: snapshot,
      models: result.models,
    };
  }

  if (!isIntegration(parsed.data.target)) {
    setResponseStatus(event, 400);
    return { status: "error", error: "Unknown integration." };
  }

  const integration = (await getMcpIntegrationStatuses()).find(
    (entry) => entry.tool === parsed.data.target,
  ) as IntegrationStatusSnapshot | undefined;

  if (!integration) {
    setResponseStatus(event, 404);
    return { status: "error", error: "Integration not found." };
  }

  return {
    status: integration.installed ? "ok" : "error",
    integration: {
      ...integration,
      validated: integration.installed,
      authenticated: integration.installed ? null : false,
      statusMessage: integration.installed
        ? `${parsed.data.target} is available for MCP wiring.`
        : integration.statusMessage,
    },
  };
});
