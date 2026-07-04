// Brave search provider. GET https://api.search.brave.com/res/v1/web/search
// with the API key in the X-Subscription-Token header. To add another provider,
// create a sibling file and register it in index.ts.

import type { SearchOptions, SearchProvider, SearchResult } from "./types";
import { createTimeoutSignal, readErrorSnippet } from "./http";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const DEFAULT_MAX_RESULTS = 5;

interface BraveRawResult {
  title?: unknown;
  url?: unknown;
  description?: unknown;
}

function mapResult(raw: BraveRawResult): SearchResult {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    url: typeof raw.url === "string" ? raw.url : "",
    snippet: typeof raw.description === "string" ? raw.description : "",
  };
}

export const braveProvider: SearchProvider = {
  id: "brave",
  async search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
    const { signal, cleanup } = createTimeoutSignal(opts.signal);
    try {
      const url = new URL(BRAVE_ENDPOINT);
      url.searchParams.set("q", query);
      url.searchParams.set(
        "count",
        String(opts.maxResults ?? DEFAULT_MAX_RESULTS),
      );

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": opts.apiKey,
        },
        signal,
      });

      if (!response.ok) {
        const snippet = await readErrorSnippet(response);
        throw new Error(
          `Brave search failed (HTTP ${response.status})${snippet ? `: ${snippet}` : ""}`,
        );
      }

      const data = (await response.json()) as {
        web?: { results?: BraveRawResult[] };
      };
      const results = Array.isArray(data.web?.results) ? data.web.results : [];
      return results.map(mapResult);
    } finally {
      cleanup();
    }
  },
};
