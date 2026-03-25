import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import type { GroupedModel } from "../../../src/types/agent-settings";
import type {
  ProviderHealthCheck,
  ProviderHealthState,
} from "../../../shared/types/analysis-runtime";
import { getClaudeProviderSnapshot } from "../../services/ai/claude-health";
import { getCodexProviderSnapshot } from "../../services/ai/codex-health";

interface ConnectBody {
  agent: "claude-code" | "codex-cli" | "opencode" | "copilot";
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

  if (body.agent === "opencode") {
    return connectOpenCode();
  }

  if (body.agent === "copilot") {
    return connectCopilot();
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

/** Resolve the opencode binary path, checking PATH then common install locations. */
async function resolveOpencodeBinary(): Promise<string | undefined> {
  const { execSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const isWin = process.platform === "win32";

  // 1. Try PATH lookup
  try {
    const cmd = isWin ? "where opencode" : "which opencode 2>/dev/null";
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 })
      .trim()
      .split(/\r?\n/)[0]
      ?.trim();
    if (result && existsSync(result)) return result;
  } catch {
    /* not in PATH */
  }

  // 2. Try `npm prefix -g` to find actual npm global bin directory
  //    On Windows, must use `npm.cmd` since Electron spawns cmd.exe
  try {
    const npmCmd = isWin ? "npm.cmd prefix -g" : "npm prefix -g";
    const prefix = execSync(npmCmd, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (prefix) {
      const bin = isWin
        ? join(prefix, "opencode.cmd")
        : join(prefix, "bin", "opencode");
      if (existsSync(bin)) return bin;
    }
  } catch {
    /* npm not available */
  }

  // 3. Common install locations
  //    npm -g → %APPDATA%\npm (Windows), /usr/local (macOS/Linux)
  //    curl installer → ~/.opencode/bin (macOS/Linux)
  //    Homebrew → /usr/local/bin or /opt/homebrew/bin (macOS)
  const home = homedir();
  const candidates = isWin
    ? [
        // npm global
        join(process.env.APPDATA || "", "npm", "opencode.cmd"),
        join(process.env.ProgramFiles || "", "nodejs", "opencode.cmd"),
        // nvm-windows / fnm
        join(process.env.NVM_SYMLINK || "", "opencode.cmd"),
        join(process.env.FNM_MULTISHELL_PATH || "", "opencode.cmd"),
        // Scoop
        join(home, "scoop", "shims", "opencode.exe"),
        join(
          process.env.LOCALAPPDATA || "",
          "Programs",
          "opencode",
          "opencode.exe",
        ),
      ]
    : [
        // curl installer (https://opencode.ai/install)
        join(home, ".opencode", "bin", "opencode"),
        // npm global
        join(home, ".npm-global", "bin", "opencode"),
        "/usr/local/bin/opencode",
        // Homebrew
        "/opt/homebrew/bin/opencode",
        join(home, ".local", "bin", "opencode"),
      ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }

  return undefined;
}

/** Connect to OpenCode and fetch its configured providers/models. */
async function connectOpenCode(): Promise<ConnectResult> {
  try {
    const binaryPath = await resolveOpencodeBinary();
    if (!binaryPath) {
      return {
        connected: false,
        models: [],
        notInstalled: true,
        error: "OpenCode CLI not found",
      };
    }

    const { getOpencodeClient, releaseOpencodeServer } =
      await import("../../utils/opencode-client");
    const { client, server } = await getOpencodeClient();

    const { data, error } = await client.config.providers();
    releaseOpencodeServer(server);

    if (error) {
      return {
        connected: false,
        models: [],
        error: "Failed to fetch providers from OpenCode server.",
      };
    }

    const models: GroupedModel[] = [];
    for (const provider of data?.providers ?? []) {
      if (!provider.models) continue;
      for (const [, model] of Object.entries(provider.models)) {
        models.push({
          value: `${provider.id}/${model.id}`,
          displayName: model.name || model.id,
          description: `via ${provider.name || provider.id}`,
          provider: "opencode" as const,
        });
      }
    }

    if (models.length === 0) {
      return {
        connected: false,
        models: [],
        error:
          'No models configured in OpenCode. Run "opencode" to set up providers.',
      };
    }

    return { connected: true, models };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to connect";
    return { connected: false, models: [], error: friendlyOpenCodeError(raw) };
  }
}

/** Connect to GitHub Copilot CLI via @github/copilot-sdk and fetch available models. */
async function connectCopilot(): Promise<ConnectResult> {
  // Use standalone copilot binary to avoid Bun's node:sqlite issue
  const { resolveCopilotCli } = await import("../../utils/copilot-client");
  const cliPath = resolveCopilotCli();
  if (!cliPath) {
    return {
      connected: false,
      models: [],
      notInstalled: true,
      error: "GitHub Copilot CLI not found",
    };
  }

  try {
    const { CopilotClient } = await import("@github/copilot-sdk");
    const client = new CopilotClient({ autoStart: true, cliPath });

    await client.start();

    let models: GroupedModel[] = [];
    try {
      const modelList = await client.listModels();
      models = modelList
        .filter((m) => !m.policy || m.policy.state === "enabled")
        .map((m) => ({
          value: m.id,
          displayName: m.name,
          description: m.capabilities?.supports?.vision ? "vision" : "",
          provider: "copilot" as const,
        }));
    } catch (listErr) {
      const msg =
        listErr instanceof Error ? listErr.message : "Failed to list models";
      await client.stop().catch(() => {});
      return { connected: false, models: [], error: friendlyCopilotError(msg) };
    }

    await client.stop();

    if (models.length === 0) {
      return {
        connected: false,
        models: [],
        error: 'No models found. Run "copilot login" to authenticate first.',
      };
    }

    return { connected: true, models };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to connect";
    return { connected: false, models: [], error: friendlyCopilotError(raw) };
  }
}

/** Map Copilot SDK errors to user-friendly messages */
function friendlyCopilotError(raw: string): string {
  if (/not found|ENOENT/i.test(raw)) {
    return "GitHub Copilot CLI not found. Install it from https://docs.github.com/copilot/how-tos/copilot-cli";
  }
  if (
    /not authenticated|authenticate first|auth|unauthenticated|login/i.test(raw)
  ) {
    return 'Not authenticated. Run "copilot login" in your terminal first.';
  }
  if (/timed?\s*out/i.test(raw)) {
    return "Connection timed out. Please try again.";
  }
  return raw;
}

/** Map OpenCode connection errors to user-friendly messages */
function friendlyOpenCodeError(raw: string): string {
  if (/ECONNREFUSED/i.test(raw)) {
    return 'OpenCode server not running. Start it with "opencode" in your terminal first.';
  }
  if (/not found|ENOENT/i.test(raw)) {
    return "OpenCode CLI not found. Please install it first.";
  }
  if (/timed?\s*out/i.test(raw)) {
    return "Connection timed out. Please try again.";
  }
  return raw;
}
