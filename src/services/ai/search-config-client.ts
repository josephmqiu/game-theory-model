// Renderer -> server push for the BYOK web-search config.
//
// The server holds this in memory only (it restarts on crash), so the renderer
// is the source of truth and must call pushSearchConfig() on app boot and on
// every settings-save. T5 wires this into the Settings UI + store.

// Kept in sync with the server-side SearchProviderId (server/services/search).
// Duplicated rather than imported to preserve the renderer/server runtime
// boundary — renderer code must never import server modules.
export type SearchProviderId = "tavily" | "brave";

export interface SearchConfigPush {
  provider: SearchProviderId | null;
  apiKey: string | null;
}

export interface PushSearchConfigResult {
  ok: boolean;
  configured: boolean;
  error?: string;
}

export async function pushSearchConfig(
  config: SearchConfigPush,
): Promise<PushSearchConfigResult> {
  try {
    const response = await fetch("/api/ai/search-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      configured?: boolean;
      error?: string;
    };

    if (!response.ok || result.error) {
      return {
        ok: false,
        configured: false,
        error: result.error ?? `HTTP ${response.status}`,
      };
    }

    return { ok: true, configured: Boolean(result.configured) };
  } catch (error) {
    return {
      ok: false,
      configured: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
