import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import type { GroupedModel } from "../../../src/types/agent-settings";
import type {
  ProviderHealthCheck,
  ProviderHealthState,
} from "../../../shared/types/analysis-runtime";
import { getClaudeProviderSnapshot } from "../../services/ai/claude-health";
import { getCodexProviderSnapshot } from "../../services/ai/codex-health";

interface ConnectBody {
  agent: "claude-code" | "codex-cli";
}

interface ConnectResult {
  connected: boolean;
  models: GroupedModel[];
  error?: string;
  notInstalled?: boolean;
  health?: unknown;
}

/**
 * POST /api/ai/connect-agent
 * Actively connects to a local CLI tool and fetches its supported models.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<ConnectBody>(event);
  setResponseHeaders(event, { "Content-Type": "application/json" });

  if (!body?.agent) {
    return {
      connected: false,
      models: [],
      error: "Missing agent field",
    } satisfies ConnectResult;
  }

  if (body.agent === "claude-code") {
    return connectClaudeCode();
  }

  if (body.agent === "codex-cli") {
    return connectCodexCli();
  }

  return {
    connected: false,
    models: [],
    error: `Unknown agent: ${body.agent}`,
  } satisfies ConnectResult;
});

function mapModels(
  provider: "anthropic" | "openai",
  models: Array<{
    value: string;
    displayName: string;
    description: string;
  }>,
): GroupedModel[] {
  return models.map((model) => ({
    value: model.value,
    displayName: model.displayName,
    description: model.description,
    provider,
  }));
}

function toConnectResult(
  provider: "anthropic" | "openai",
  snapshot: Awaited<ReturnType<typeof getClaudeProviderSnapshot>>,
): ConnectResult {
  const models = mapModels(provider, snapshot.models);
  const connected = isProviderConnectable(provider, snapshot.health, models);

  return {
    connected,
    models,
    ...(snapshot.health.reason === "not-installed"
      ? { notInstalled: true }
      : {}),
    ...(!connected && snapshot.health.message
      ? { error: snapshot.health.message }
      : {}),
    health: snapshot.health,
  };
}

function getCheckStatus(
  health: ProviderHealthState,
  name: ProviderHealthCheck["name"],
): ProviderHealthCheck["status"] | undefined {
  return health.checks.find((check) => check.name === name)?.status;
}

function hasPassingRuntimeProbe(health: ProviderHealthState): boolean {
  return (
    getCheckStatus(health, "runtime") === "pass" ||
    getCheckStatus(health, "transport") === "pass"
  );
}

function isClaudeConnectable(
  health: ProviderHealthState,
  models: GroupedModel[],
): boolean {
  if (models.length === 0) return false;
  if (getCheckStatus(health, "binary") === "fail") return false;
  if (getCheckStatus(health, "auth") === "fail") return false;
  return true;
}

function isCodexConnectable(
  health: ProviderHealthState,
  models: GroupedModel[],
): boolean {
  if (models.length === 0) return false;
  if (getCheckStatus(health, "binary") !== "pass") return false;
  if (getCheckStatus(health, "version") !== "pass") return false;
  if (!hasPassingRuntimeProbe(health)) return false;
  return true;
}

function isProviderConnectable(
  provider: "anthropic" | "openai",
  health: ProviderHealthState,
  models: GroupedModel[],
): boolean {
  return provider === "anthropic"
    ? isClaudeConnectable(health, models)
    : isCodexConnectable(health, models);
}

/** Connect to Claude Code and preserve the existing renderer response shape. */
export async function connectClaudeCode(): Promise<ConnectResult> {
  return toConnectResult("anthropic", await getClaudeProviderSnapshot());
}

/** Connect to Codex CLI and preserve the existing renderer response shape. */
export async function connectCodexCli(): Promise<ConnectResult> {
  return toConnectResult("openai", await getCodexProviderSnapshot());
}
