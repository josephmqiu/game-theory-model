// In-memory search configuration.
//
// IMPORTANT: this is deliberately NOT persisted server-side. The Nitro server
// runs as a child process and restarts on crash, losing this state. The
// renderer owns the durable copy (BYOK secret storage) and re-pushes it via
// POST /api/ai/search-config on boot and on every settings-save. Never write
// the provider key to disk from here.

import type { SearchProviderId } from "./types";

interface SearchConfig {
  provider: SearchProviderId | null;
  apiKey: string | null;
}

const config: SearchConfig = {
  provider: null,
  apiKey: null,
};

export function setSearchConfig(next: {
  provider: SearchProviderId | null;
  apiKey: string | null;
}): void {
  config.provider = next.provider;
  config.apiKey = next.apiKey;
}

export function getSearchConfig(): Readonly<SearchConfig> {
  return { provider: config.provider, apiKey: config.apiKey };
}

export function isSearchConfigured(): boolean {
  return (
    config.provider !== null &&
    typeof config.apiKey === "string" &&
    config.apiKey.length > 0
  );
}
