import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import type {
  AIProviderType,
  IntegrationStatusSnapshot,
  MCPCliTool,
  MCPTransportMode,
  ProviderStatusSnapshot,
} from "../../../src/types/agent-settings";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { discoverAgentConnection } from "../ai/connect-agent.post";
import {
  getManagedMcpConfigPath,
  hasManagedMcpConfig,
  smokeTestManagedMcpStdio,
  writeManagedMcpConfig,
} from "../../utils/mcp-config-writers";

const validateSchema = z.object({
  kind: z.enum(["provider", "integration"]),
  target: z.string().min(1),
  transportMode: z.enum(["stdio", "http", "both"]).optional(),
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
      installed: result.installed,
      authenticated: result.authenticated,
      validated: result.connected,
      statusStage: result.statusStage,
      reachable: result.reachable,
      lastError: result.connected ? null : result.error ?? null,
      modelsDiscovered: result.modelsDiscovered,
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

  const requestedTransportMode: MCPTransportMode =
    parsed.data.transportMode ?? "stdio";

  if (!integration.installed) {
    return {
      status: "error",
      integration: integration,
    };
  }

  let configPath = integration.configPath;
  let reachable = false;
  let lastError: string | null = null;

  try {
    if (!configPath) {
      const writeResult = await writeManagedMcpConfig(
        parsed.data.target,
        requestedTransportMode,
      );
      configPath = writeResult.outputPath;
      reachable = writeResult.reachable;
      if (!writeResult.reachable) {
        lastError = "Managed MCP config was written, but the stdio runtime failed the smoke test.";
      }
    } else if (await hasManagedMcpConfig(parsed.data.target)) {
      const smoke = await smokeTestManagedMcpStdio();
      reachable = smoke.reachable;
      lastError = smoke.reachable ? null : smoke.error ?? null;
    } else {
      configPath = getManagedMcpConfigPath(parsed.data.target);
    }
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "Could not validate MCP runtime.";
  }

  const validated = Boolean(configPath) && reachable;
  const statusStage = !configPath
    ? "detected"
    : validated
      ? "ready"
      : "config_written";

  return {
    status: validated ? "ok" : "error",
    integration: {
      ...integration,
      validated,
      authenticated: integration.authenticated,
      statusStage,
      reachable,
      lastError,
      configPath,
      statusMessage:
        validated
          ? `${parsed.data.target} is ready for MCP wiring.`
          : configPath
            ? `${parsed.data.target} config exists, but runtime validation still failed.`
            : `${parsed.data.target} is detected but not configured yet.`,
      lastCheckedAt: new Date().toISOString(),
    },
  };
});
