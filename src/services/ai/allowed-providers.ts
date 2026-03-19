// src/services/ai/allowed-providers.ts
export const ALLOWED_PROVIDERS = ["anthropic", "openai"] as const;
export type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AllowedProvider, string> = {
  anthropic: "Claude",
  openai: "Codex",
} as const;

export function isAllowedProvider(
  provider: string,
): provider is AllowedProvider {
  return (ALLOWED_PROVIDERS as readonly string[]).includes(provider);
}
