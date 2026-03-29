import type {
  ProviderHealthState,
  RuntimeEffort,
  RuntimeModelInfo,
  RuntimeProvider,
} from "../../../shared/types/analysis-runtime";
import { normalizeRuntimeProvider } from "../../../shared/types/analysis-runtime";
import type { RuntimeError } from "../../../shared/types/runtime-error";
import {
  createProcessRuntimeError,
  createProviderRuntimeError,
} from "../../../shared/types/runtime-error";
import type { AnalysisActivityCallback } from "./analysis-activity";
import type { RuntimeAdapterChatEvent } from "./runtime-adapter-events";
import type {
  ProviderSessionBindingRecoveryOutcome,
  ProviderSessionBindingState,
} from "../workspace/provider-session-binding-service";

export type { RuntimeProvider } from "../../../shared/types/analysis-runtime";

export interface StreamChatOptions {
  runId?: string;
  /** Wall-clock timeout per chat turn in ms (default: 5 min) */
  timeoutMs?: number;
  /** Abort signal — when aborted, closes the provider session and ends the stream */
  signal?: AbortSignal;
}

export interface AnalysisRunOptions {
  runId?: string;
  maxTurns?: number;
  signal?: AbortSignal;
  webSearch?: boolean;
  allowedToolNames?: string[];
  onActivity?: AnalysisActivityCallback;
}

export type RuntimeSessionPurpose = "chat" | "analysis" | "recovery";

export interface RuntimeAdapterSessionContext {
  workspaceId?: string;
  threadId: string;
  runId?: string;
  phaseTurnId?: string;
  purpose: RuntimeSessionPurpose;
}

export interface RuntimeChatTurnInput {
  prompt: string;
  systemPrompt: string;
  model: string;
  messages?: Array<{ role: string; content: string }>;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface RuntimeStructuredTurnInput {
  prompt: string;
  systemPrompt: string;
  model: string;
  schema: Record<string, unknown>;
  maxTurns?: number;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  webSearch?: boolean;
  allowedToolNames?: string[];
  onActivity?: AnalysisActivityCallback;
}

export interface RuntimeSessionDiagnostics {
  provider: RuntimeProvider;
  sessionId: string;
  runId?: string;
  providerSessionId?: string;
  logPath?: string;
  recovery?: ProviderSessionBindingRecoveryOutcome;
  details?: Record<string, unknown>;
}

export interface RuntimeAdapterSession {
  provider: RuntimeProvider;
  context: RuntimeAdapterSessionContext;
  streamChatTurn(
    input: RuntimeChatTurnInput,
  ): AsyncGenerator<RuntimeAdapterChatEvent>;
  runStructuredTurn<T = unknown>(input: RuntimeStructuredTurnInput): Promise<T>;
  getDiagnostics(): RuntimeSessionDiagnostics;
  getBinding(): ProviderSessionBindingState | null;
  dispose(): Promise<void>;
}

export interface RuntimeAdapter {
  provider: RuntimeProvider;
  createSession(
    context: RuntimeAdapterSessionContext,
    binding?: ProviderSessionBindingState | null,
  ): RuntimeAdapterSession;
  listModels(): Promise<RuntimeModelInfo[]>;
  checkHealth(): Promise<ProviderHealthState>;
}

export function createBaseCapabilities(provider: RuntimeProvider) {
  return {
    streaming: true,
    structuredOutput: true,
    toolCalls: true,
    webSearch: true,
    imageInput: provider === "claude",
    threadResume: provider === "claude" || provider === "codex",
  };
}

export function createBaseEffortSupport(provider: RuntimeProvider) {
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

export function mapRuntimeModels(
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

export async function getRuntimeAdapter(
  providerInput?: string,
): Promise<RuntimeAdapter> {
  const provider = normalizeRuntimeProvider(providerInput);
  if (provider === "codex") {
    const mod = await import("./codex-adapter");
    return mod.codexRuntimeAdapter;
  }

  if (provider === "claude" || !providerInput) {
    const mod = await import("./claude-adapter");
    return mod.claudeRuntimeAdapter;
  }

  throw new Error(`Unknown provider: ${providerInput}. Allowed: claude, codex`);
}

export async function listRuntimeModels(
  providerInput?: string,
): Promise<RuntimeModelInfo[]> {
  const provider = normalizeRuntimeProvider(providerInput);
  if (!provider) {
    return [];
  }

  const adapter = await getRuntimeAdapter(provider);
  return adapter.listModels();
}

export async function checkRuntimeProviderHealth(
  providerInput?: string,
): Promise<ProviderHealthState> {
  const provider = normalizeRuntimeProvider(providerInput);
  if (!provider) {
    return {
      status: "unknown",
      reason: "unknown",
      message: "Unknown runtime provider",
      checkedAt: Date.now(),
      checks: [],
    };
  }

  const adapter = await getRuntimeAdapter(provider);
  return adapter.checkHealth();
}

export function runtimeErrorFromHealth(
  health: ProviderHealthState,
): RuntimeError {
  if (health.reason === "not-installed") {
    return createProcessRuntimeError(
      health.message ?? "Provider not installed",
      {
        provider: health.provider,
        processState: "not-installed",
        retryable: false,
      },
    );
  }

  return createProviderRuntimeError(
    health.message ?? "Provider health check failed",
    {
      provider: health.provider,
      reason: health.reason === "unauthenticated" ? "unauthorized" : "unknown",
      retryable: health.reason === "transport",
    },
  );
}
