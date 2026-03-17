import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import type {
  GroupedModel,
  ProviderStatusStage,
} from "../../../src/types/agent-settings";
import { resolveClaudeCli } from "../../utils/resolve-claude-cli";
import {
  buildClaudeAgentEnv,
  getClaudeAgentDebugFilePath,
} from "../../utils/resolve-claude-agent-env";
import { resolveCodexCli } from "../../utils/resolve-codex-cli";
import { resolveOpenCodeCli } from "../../utils/resolve-opencode-cli";

interface ConnectBody {
  agent: "claude-code" | "codex-cli" | "opencode" | "copilot";
}

export interface ConnectResult {
  installed: boolean;
  connected: boolean;
  authenticated: boolean | null;
  reachable: boolean | null;
  statusStage: ProviderStatusStage;
  models: GroupedModel[];
  modelsDiscovered: number;
  error?: string;
  notInstalled?: boolean;
}

const FALLBACK_CLAUDE_MODELS: GroupedModel[] = [
  {
    value: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    description: "",
    provider: "anthropic",
  },
  {
    value: "claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    description: "",
    provider: "anthropic",
  },
  {
    value: "claude-sonnet-4-5-20250514",
    displayName: "Claude Sonnet 4.5",
    description: "",
    provider: "anthropic",
  },
  {
    value: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    description: "",
    provider: "anthropic",
  },
];

export default defineEventHandler(async (event) => {
  const body = await readBody<ConnectBody>(event);
  setResponseHeaders(event, { "Content-Type": "application/json" });

  if (!body?.agent) {
    return {
      installed: false,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "error",
      models: [],
      modelsDiscovered: 0,
      error: "Missing agent field",
    } satisfies ConnectResult;
  }

  return discoverAgentConnection(body.agent);
});

export async function discoverAgentConnection(
  agent: ConnectBody["agent"],
): Promise<ConnectResult> {
  switch (agent) {
    case "claude-code":
      return connectClaudeCode();
    case "codex-cli":
      return connectCodexCli();
    case "opencode":
      return connectOpenCode();
    case "copilot":
      return connectCopilot();
    default:
      return {
        installed: false,
        connected: false,
        authenticated: false,
        reachable: false,
        statusStage: "error",
        models: [],
        modelsDiscovered: 0,
        error: `Unknown agent: ${agent}`,
      };
  }
}

export async function connectClaudeCode(): Promise<ConnectResult> {
  const claudePath = resolveClaudeCli();
  if (!claudePath) {
    return {
      installed: false,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "missing_binary",
      models: [],
      modelsDiscovered: 0,
      notInstalled: true,
      error: "Claude Code CLI not found",
    };
  }

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const queryHandle = query({
      prompt: "",
      options: {
        maxTurns: 1,
        tools: [],
        permissionMode: "plan",
        persistSession: false,
        env: buildClaudeAgentEnv(),
        ...(getClaudeAgentDebugFilePath()
          ? { debugFile: getClaudeAgentDebugFilePath() }
          : {}),
        pathToClaudeCodeExecutable: claudePath,
      },
    });

    const raw = await queryHandle.supportedModels();
    queryHandle.close();

    return {
      installed: true,
      connected: true,
      authenticated: true,
      reachable: true,
      statusStage: "ready",
      models: raw.map((model) => ({
        value: model.value,
        displayName: model.displayName,
        description: model.description,
        provider: "anthropic",
      })),
      modelsDiscovered: raw.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect";
    if (/closed before|closed early|query closed/i.test(message)) {
      return {
        installed: true,
        connected: true,
        authenticated: true,
        reachable: true,
        statusStage: "ready",
        models: FALLBACK_CLAUDE_MODELS,
        modelsDiscovered: FALLBACK_CLAUDE_MODELS.length,
      };
    }
    return {
      installed: true,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "error",
      models: [],
      modelsDiscovered: 0,
      error: friendlyClaudeError(message),
    };
  }
}

export async function connectCodexCli(): Promise<ConnectResult> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");

    if (!resolveCodexCli()) {
      return {
        installed: false,
        connected: false,
        authenticated: false,
        reachable: false,
        statusStage: "missing_binary",
        models: [],
        modelsDiscovered: 0,
        notInstalled: true,
        error: "Codex CLI not found",
      };
    }

    const cachePath = join(homedir(), ".codex", "models_cache.json");
    const raw = await readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as {
      models?: Array<{
        slug: string;
        display_name: string;
        description: string;
        visibility: string;
        priority: number;
      }>;
    };

    const models =
      parsed.models
        ?.filter((model) => model.visibility === "list")
        .sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999))
        .map((model) => ({
          value: model.slug,
          displayName: model.display_name,
          description: model.description ?? "",
          provider: "openai" as const,
        })) ?? [];

    if (models.length === 0) {
      return {
        installed: true,
        connected: false,
        authenticated: null,
        reachable: true,
        statusStage: "detected",
        models: [],
        modelsDiscovered: 0,
        error: "No models found. Run codex once to populate the model cache.",
      };
    }

    return {
      installed: true,
      connected: true,
      authenticated: null,
      reachable: true,
      statusStage: "ready",
      models,
      modelsDiscovered: models.length,
    };
  } catch (error) {
    return {
      installed: true,
      connected: false,
      authenticated: null,
      reachable: false,
      statusStage: "error",
      models: [],
      modelsDiscovered: 0,
      error: error instanceof Error ? error.message : "Failed to connect",
    };
  }
}

export async function connectOpenCode(): Promise<ConnectResult> {
  try {
    if (!resolveOpenCodeCli()) {
      return {
        installed: false,
        connected: false,
        authenticated: false,
        reachable: false,
        statusStage: "missing_binary",
        models: [],
        modelsDiscovered: 0,
        notInstalled: true,
        error: "OpenCode CLI not found",
      };
    }

    const { getOpencodeClient, releaseOpencodeServer } = await import(
      "../../utils/opencode-client"
    );

    const { client, server } = await getOpencodeClient();
    const { data, error } = await client.config.providers();
    releaseOpencodeServer(server);

    if (error) {
      return {
        installed: true,
        connected: false,
        authenticated: false,
        reachable: false,
        statusStage: "error",
        models: [],
        modelsDiscovered: 0,
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
          provider: "opencode",
        });
      }
    }

    if (models.length === 0) {
      return {
        installed: true,
        connected: false,
        authenticated: false,
        reachable: true,
        statusStage: "detected",
        models: [],
        modelsDiscovered: 0,
        error: 'No models configured in OpenCode. Run "opencode" to set up providers.',
      };
    }

    return {
      installed: true,
      connected: true,
      authenticated: true,
      reachable: true,
      statusStage: "ready",
      models,
      modelsDiscovered: models.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect";
    return {
      installed: true,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "error",
      models: [],
      modelsDiscovered: 0,
      error: friendlyOpenCodeError(message),
    };
  }
}

export async function connectCopilot(): Promise<ConnectResult> {
  const { resolveCopilotCli } = await import("../../utils/copilot-client");
  const cliPath = resolveCopilotCli();
  if (!cliPath) {
    return {
      installed: false,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "missing_binary",
      models: [],
      modelsDiscovered: 0,
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
        .filter((model) => !model.policy || model.policy.state === "enabled")
        .map((model) => ({
          value: model.id,
          displayName: model.name,
          description: model.capabilities?.supports?.vision ? "vision" : "",
          provider: "copilot",
        }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list models";
      await client.stop().catch(() => {});
      return {
        installed: true,
        connected: false,
        authenticated: false,
        reachable: false,
        statusStage: "error",
        models: [],
        modelsDiscovered: 0,
        error: friendlyCopilotError(message),
      };
    }

    await client.stop();

    if (models.length === 0) {
      return {
        installed: true,
        connected: false,
        authenticated: false,
        reachable: true,
        statusStage: "detected",
        models: [],
        modelsDiscovered: 0,
        error: 'No models found. Run "copilot login" to authenticate first.',
      };
    }

    return {
      installed: true,
      connected: true,
      authenticated: true,
      reachable: true,
      statusStage: "ready",
      models,
      modelsDiscovered: models.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect";
    return {
      installed: true,
      connected: false,
      authenticated: false,
      reachable: false,
      statusStage: "error",
      models: [],
      modelsDiscovered: 0,
      error: friendlyCopilotError(message),
    };
  }
}

function friendlyClaudeError(message: string): string {
  if (
    /process exited with code 1|invalid model|unknown model|model.*not/i.test(
      message,
    )
  ) {
    return 'Claude Code exited unexpectedly. Run "claude login" or set ANTHROPIC_API_KEY in ~/.claude/settings.json.';
  }
  if (/exited with code/i.test(message)) {
    return "Unable to connect. Claude Code exited unexpectedly.";
  }
  if (/not found|ENOENT/i.test(message)) {
    return "Claude Code CLI not found. Please install it first.";
  }
  if (/timed?\s*out/i.test(message)) {
    return "Connection timed out. Please try again.";
  }
  return message;
}

function friendlyOpenCodeError(message: string): string {
  if (/ECONNREFUSED/i.test(message)) {
    return 'OpenCode server not running. Start it with "opencode" in your terminal first.';
  }
  if (/not found|ENOENT/i.test(message)) {
    return "OpenCode CLI not found. Please install it first.";
  }
  if (/timed?\s*out/i.test(message)) {
    return "Connection timed out. Please try again.";
  }
  return message;
}

function friendlyCopilotError(message: string): string {
  if (/not found|ENOENT/i.test(message)) {
    return "GitHub Copilot CLI not found. Install it before connecting.";
  }
  if (/not authenticated|authenticate first|auth|unauthenticated|login/i.test(message)) {
    return 'Not authenticated. Run "copilot login" in your terminal first.';
  }
  if (/timed?\s*out/i.test(message)) {
    return "Connection timed out. Please try again.";
  }
  return message;
}
