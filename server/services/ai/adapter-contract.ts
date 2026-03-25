import type {
  ProviderHealthState,
  RuntimeEffort,
  RuntimeModelInfo,
  RuntimeProvider,
} from "../../../shared/types/analysis-runtime";
import {
  normalizeRuntimeProvider,
} from "../../../shared/types/analysis-runtime";
import type { ChatEvent } from "../../../shared/types/events";
import type { RuntimeError } from "../../../shared/types/runtime-error";
import {
  createProcessRuntimeError,
  createProviderRuntimeError,
} from "../../../shared/types/runtime-error";
import { connectClaudeCode, connectCodexCli } from "../../api/ai/connect-agent";

export type { RuntimeProvider } from "../../../shared/types/analysis-runtime";

export interface RuntimeChatTurnInput {
  prompt: string;
  systemPrompt: string;
  model: string;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface RuntimeStructuredTurnInput {
  prompt: string;
  systemPrompt: string;
  model: string;
  schema: Record<string, unknown>;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  webSearch?: boolean;
  onActivity?: (activity: {
    kind: "note" | "tool" | "web-search";
    message: string;
    toolName?: string;
    query?: string;
  }) => void;
}

export interface RuntimeAdapter {
  provider: RuntimeProvider;
  streamChatTurn(input: RuntimeChatTurnInput): AsyncGenerator<ChatEvent>;
  runStructuredTurn<T = unknown>(
    input: RuntimeStructuredTurnInput,
  ): Promise<T>;
  listModels(): Promise<RuntimeModelInfo[]>;
  checkHealth(): Promise<ProviderHealthState>;
}

function createBaseCapabilities(provider: RuntimeProvider) {
  return {
    streaming: true,
    structuredOutput: true,
    toolCalls: true,
    webSearch: true,
    imageInput: provider === "claude",
    threadResume: provider === "codex",
  };
}

function createBaseEffortSupport(provider: RuntimeProvider) {
  const supported: RuntimeEffort[] = ["low", "medium", "high", "max"];
  return {
    supported,
    default: "medium" as const,
    aliases:
      provider === "claude"
        ? {
            quick: "low" as const,
            standard: "medium" as const,
            thorough: "high" as const,
          }
        : {
            xhigh: "max" as const,
          },
  };
}

function mapRuntimeModels(
  provider: RuntimeProvider,
  models: Array<{
    value: string;
    displayName: string;
    description: string;
  }>,
): RuntimeModelInfo[] {
  return models.map((model) => ({
    provider,
    id: model.value,
    displayName: model.displayName,
    ...(model.description ? { description: model.description } : {}),
    capabilities: createBaseCapabilities(provider),
    effort: createBaseEffortSupport(provider),
  }));
}

function buildProviderHealth(
  provider: RuntimeProvider,
  result: {
    connected: boolean;
    error?: string;
    notInstalled?: boolean;
  },
): ProviderHealthState {
  const checkedAt = Date.now();
  if (result.connected) {
    return {
      provider,
      status: "healthy",
      reason: null,
      checkedAt,
    };
  }

  const message = result.error ?? "Unknown provider status";
  if (result.notInstalled) {
    return {
      provider,
      status: "unavailable",
      reason: "not-installed",
      message,
      checkedAt,
    };
  }

  if (/login|auth|unauthorized|forbidden/i.test(message)) {
    return {
      provider,
      status: "degraded",
      reason: "unauthenticated",
      message,
      checkedAt,
    };
  }

  if (/transport|mcp|responding|timed out/i.test(message)) {
    return {
      provider,
      status: "degraded",
      reason: "transport",
      message,
      checkedAt,
    };
  }

  if (/process|app-server|exit|spawn/i.test(message)) {
    return {
      provider,
      status: "degraded",
      reason: "process",
      message,
      checkedAt,
    };
  }

  return {
    provider,
    status: "degraded",
    reason: "unknown",
    message,
    checkedAt,
  };
}

export async function listRuntimeModels(
  providerInput: RuntimeProvider | "anthropic" | "openai",
): Promise<RuntimeModelInfo[]> {
  const provider = normalizeRuntimeProvider(providerInput);
  if (!provider) {
    return [];
  }

  const result =
    provider === "claude" ? await connectClaudeCode() : await connectCodexCli();

  if (!result.connected) {
    return [];
  }

  return mapRuntimeModels(provider, result.models);
}

export async function checkRuntimeProviderHealth(
  providerInput: RuntimeProvider | "anthropic" | "openai",
): Promise<ProviderHealthState> {
  const provider = normalizeRuntimeProvider(providerInput);
  if (!provider) {
    return {
      status: "unknown",
      reason: "unknown",
      message: "Unknown runtime provider",
      checkedAt: Date.now(),
    };
  }

  const result =
    provider === "claude" ? await connectClaudeCode() : await connectCodexCli();
  return buildProviderHealth(provider, result);
}

export function runtimeErrorFromHealth(
  health: ProviderHealthState,
): RuntimeError {
  if (health.reason === "not-installed") {
    return createProcessRuntimeError(health.message ?? "Provider not installed", {
      provider: health.provider,
      processState: "not-installed",
      retryable: false,
    });
  }

  return createProviderRuntimeError(
    health.message ?? "Provider health check failed",
    {
      provider: health.provider,
      reason:
        health.reason === "unauthenticated" ? "unauthorized" : "unknown",
      retryable: health.reason === "transport",
    },
  );
}
