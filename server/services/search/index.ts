// Search provider registry. One entry per provider file — to add a provider,
// create a sibling module (e.g. serper.ts) exporting a SearchProvider and
// register it here plus in SearchProviderId (types.ts). This keeps the
// dispatch explicit rather than dynamic-importing arbitrary ids.

import type { SearchProvider, SearchProviderId } from "./types";
import { tavilyProvider } from "./tavily";
import { braveProvider } from "./brave";

const PROVIDERS: Record<SearchProviderId, SearchProvider> = {
  tavily: tavilyProvider,
  brave: braveProvider,
};

export function getSearchProvider(id: SearchProviderId): SearchProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown search provider: ${String(id)}`);
  }
  return provider;
}

export type { SearchProvider, SearchProviderId, SearchResult } from "./types";
