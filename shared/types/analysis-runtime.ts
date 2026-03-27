import type { MethodologyPhase } from "./methodology";

export type RuntimeProvider = "claude" | "codex";
export type HistoricalRuntimeProviderAlias = "anthropic" | "openai";
export type RuntimeEffort = "low" | "medium" | "high" | "max";
export type LegacyRuntimeEffort =
  | RuntimeEffort
  | "quick"
  | "standard"
  | "thorough";

export type AnalysisEffortLevel = RuntimeEffort;

export type ProviderHealthReason =
  | "not-installed"
  | "unauthenticated"
  | "misconfigured"
  | "transport"
  | "process"
  | "unknown";

export type ProviderHealthCheckName =
  | "binary"
  | "version"
  | "auth"
  | "transport"
  | "runtime"
  | "models";

export type ProviderHealthCheckStatus = "pass" | "warn" | "fail" | "unknown";

export interface ProviderHealthCheck {
  name: ProviderHealthCheckName;
  status: ProviderHealthCheckStatus;
  message?: string;
  observedValue?: string;
}

export interface ProviderHealthState {
  provider?: RuntimeProvider;
  status: "unknown" | "healthy" | "degraded" | "unavailable";
  reason: ProviderHealthReason | null;
  message?: string;
  checkedAt: number;
  binaryPath?: string;
  version?: string;
  checks: ProviderHealthCheck[];
}

export interface RuntimeModelCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  toolCalls: boolean;
  webSearch: boolean;
  imageInput: boolean;
  threadResume: boolean;
}

export interface RuntimeModelEffortSupport {
  supported: RuntimeEffort[];
  default: RuntimeEffort | null;
  aliases?: Partial<Record<string, RuntimeEffort>>;
}

export interface RuntimeModelInfo {
  provider: RuntimeProvider;
  id: string;
  displayName: string;
  description?: string;
  capabilities: RuntimeModelCapabilities;
  effort: RuntimeModelEffortSupport;
}

export const ALLOWED_RUNTIME_PROVIDERS = ["claude", "codex"] as const;
export type AllowedRuntimeProvider = (typeof ALLOWED_RUNTIME_PROVIDERS)[number];

export const HISTORICAL_RUNTIME_PROVIDER_ALIASES = [
  "anthropic",
  "openai",
] as const;

export const RUNTIME_PROVIDER_LABELS: Record<AllowedRuntimeProvider, string> = {
  claude: "Claude",
  codex: "Codex",
} as const;

export function isAllowedRuntimeProvider(
  provider: string,
): provider is AllowedRuntimeProvider {
  return (ALLOWED_RUNTIME_PROVIDERS as readonly string[]).includes(provider);
}

// Compatibility shim for persisted state and older requests that still carry
// pre-canonical provider ids. Active product code should use RuntimeProvider.
export function normalizeRuntimeProvider(
  provider?: string | null,
): RuntimeProvider | undefined {
  if (!provider) return undefined;
  if (provider === "claude" || provider === "anthropic") return "claude";
  if (provider === "codex" || provider === "openai") return "codex";
  return undefined;
}

export function normalizeRuntimeEffort(
  effort?: LegacyRuntimeEffort | null,
): RuntimeEffort | undefined {
  if (!effort) return undefined;
  if (effort === "quick") return "low";
  if (effort === "standard") return "medium";
  if (effort === "thorough") return "high";
  return effort;
}

export interface AnalysisRuntimeOverrides {
  webSearch?: boolean;
  effortLevel?: LegacyRuntimeEffort;
  activePhases?: MethodologyPhase[];
}

export interface ResolvedAnalysisRuntime {
  webSearch: boolean;
  effortLevel: RuntimeEffort;
}
