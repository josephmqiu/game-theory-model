import type {
  AIProviderType,
  IntegrationStatusSnapshot,
  MCPCliTool,
  ProviderStatusSnapshot,
} from "../../src/types/agent-settings";
import { resolveClaudeCli } from "./resolve-claude-cli";
import { resolveCodexCli } from "./resolve-codex-cli";
import { resolveOpenCodeCli } from "./resolve-opencode-cli";
import { resolveCopilotCli } from "./copilot-client";
import { resolveGeminiCli } from "./resolve-gemini-cli";
import { resolveKiroCli } from "./resolve-kiro-cli";
import {
  getManagedMcpConfigPath,
  hasManagedMcpConfig,
} from "./mcp-config-writers";

function now(): string {
  return new Date().toISOString();
}

function providerStatus(
  provider: AIProviderType,
  installed: boolean,
  statusMessage: string,
): ProviderStatusSnapshot {
  return {
    provider,
    installed,
    authenticated: installed ? null : false,
    validated: false,
    statusMessage,
    lastCheckedAt: now(),
    configPath: null,
  };
}

function integrationStatus(
  tool: MCPCliTool,
  installed: boolean,
  statusMessage: string,
): IntegrationStatusSnapshot {
  return {
    tool,
    installed,
    authenticated: installed ? null : false,
    validated: false,
    statusMessage,
    lastCheckedAt: now(),
    configPath: null,
  };
}

export async function getProviderStatuses(): Promise<ProviderStatusSnapshot[]> {
  return [
    providerStatus(
      "anthropic",
      Boolean(resolveClaudeCli()),
      resolveClaudeCli()
        ? "Claude Code CLI detected. Run Validate to confirm access and models."
        : "Claude Code CLI not found.",
    ),
    providerStatus(
      "openai",
      Boolean(resolveCodexCli()),
      resolveCodexCli()
        ? "Codex CLI detected. Run Validate to confirm models."
        : "Codex CLI not found.",
    ),
    providerStatus(
      "opencode",
      Boolean(resolveOpenCodeCli()),
      resolveOpenCodeCli()
        ? "OpenCode CLI detected. Run Validate to confirm configured providers."
        : "OpenCode CLI not found.",
    ),
    providerStatus(
      "copilot",
      Boolean(resolveCopilotCli()),
      resolveCopilotCli()
        ? "GitHub Copilot CLI detected. Run Validate to confirm authentication."
        : "GitHub Copilot CLI not found.",
    ),
  ];
}

export async function getMcpIntegrationStatuses(): Promise<IntegrationStatusSnapshot[]> {
  const entries: Array<[MCPCliTool, boolean, string]> = [
    [
      "claude-code",
      Boolean(resolveClaudeCli()),
      resolveClaudeCli() ? "Claude Code CLI detected." : "Claude Code CLI not found.",
    ],
    [
      "codex-cli",
      Boolean(resolveCodexCli()),
      resolveCodexCli() ? "Codex CLI detected." : "Codex CLI not found.",
    ],
    [
      "gemini-cli",
      Boolean(resolveGeminiCli()),
      resolveGeminiCli() ? "Gemini CLI detected." : "Gemini CLI not found.",
    ],
    [
      "opencode-cli",
      Boolean(resolveOpenCodeCli()),
      resolveOpenCodeCli() ? "OpenCode CLI detected." : "OpenCode CLI not found.",
    ],
    [
      "kiro-cli",
      Boolean(resolveKiroCli()),
      resolveKiroCli() ? "Kiro CLI detected." : "Kiro CLI not found.",
    ],
    [
      "copilot-cli",
      Boolean(resolveCopilotCli()),
      resolveCopilotCli()
        ? "GitHub Copilot CLI detected."
        : "GitHub Copilot CLI not found.",
    ],
  ];

  return Promise.all(
    entries.map(async ([tool, installed, message]) => {
      const status = integrationStatus(tool, installed, message);
      const hasConfig = await hasManagedMcpConfig(tool);
      return {
        ...status,
        configPath: hasConfig ? getManagedMcpConfigPath(tool) : null,
      };
    }),
  );
}
