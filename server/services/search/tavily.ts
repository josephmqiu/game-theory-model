// Tavily search provider. POST https://api.tavily.com/search with the API key
// in the JSON body. To add another provider, create a sibling file and register
// it in index.ts — never fan providers into a single switch.

import type { SearchOptions, SearchProvider, SearchResult } from "./types";
import { createTimeoutSignal, readErrorSnippet } from "./http";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 5;

interface TavilyRawResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
}

function mapResult(raw: TavilyRawResult): SearchResult {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    url: typeof raw.url === "string" ? raw.url : "",
    snippet: typeof raw.content === "string" ? raw.content : "",
  };
}

export const tavilyProvider: SearchProvider = {
  id: "tavily",
  async search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
    const { signal, cleanup } = createTimeoutSignal(opts.signal);
    try {
      const response = await fetch(TAVILY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: opts.apiKey,
          query,
          max_results: opts.maxResults ?? DEFAULT_MAX_RESULTS,
        }),
        signal,
      });

      if (!response.ok) {
        const snippet = await readErrorSnippet(response);
        throw new Error(
          `Tavily search failed (HTTP ${response.status})${snippet ? `: ${snippet}` : ""}`,
        );
      }

      const data = (await response.json()) as { results?: TavilyRawResult[] };
      const results = Array.isArray(data.results) ? data.results : [];
      return results.map(mapResult);
    } finally {
      cleanup();
    }
  },
};
