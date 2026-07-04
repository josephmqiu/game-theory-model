// shared/ai/allowed-providers.ts — single source of truth for the provider
// allowlist, shared by renderer (src/) and server code.
export const ALLOWED_PROVIDERS = ["anthropic", "openai", "custom"] as const;
export type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AllowedProvider, string> = {
  anthropic: "Claude",
  openai: "Codex",
  custom: "Custom",
} as const;

export function isAllowedProvider(
  provider: string,
): provider is AllowedProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(provider);
}
