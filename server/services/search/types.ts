// Search provider contracts (OpenClaw-style pluggable web search).
// One file per provider by design — see index.ts for the registry.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchProviderId = "tavily" | "brave";

/**
 * Options for a single search call.
 *
 * NOTE on `apiKey`: the task-level interface sketched `opts` as
 * `{ maxResults?; signal? }`, but a provider cannot call its upstream API
 * without a key. Threading the key through `opts` keeps each provider a pure,
 * stateless function that is trivially unit-testable, instead of coupling the
 * provider modules to the in-memory config-cache. The web_search handler is
 * the single caller and injects the key it reads from config-cache.
 */
export interface SearchOptions {
  apiKey: string;
  maxResults?: number;
  signal?: AbortSignal;
}

export interface SearchProvider {
  id: SearchProviderId;
  search(query: string, opts: SearchOptions): Promise<SearchResult[]>;
}

/** Shared per-request timeout for all providers. */
export const SEARCH_TIMEOUT_MS = 10_000;
