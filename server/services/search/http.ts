// Shared HTTP helpers for search providers: a per-request timeout that also
// honors an optional caller-supplied AbortSignal, plus safe error-body
// extraction that never echoes credentials.

import { SEARCH_TIMEOUT_MS } from "./types";

export interface TimedFetch {
  signal: AbortSignal;
  cleanup: () => void;
}

/**
 * Build an AbortSignal that fires after `timeoutMs` OR when `external` aborts.
 * Returns a cleanup() the caller MUST invoke (e.g. in finally) to clear the
 * timer and detach listeners.
 */
export function createTimeoutSignal(
  external?: AbortSignal,
  timeoutMs: number = SEARCH_TIMEOUT_MS,
): TimedFetch {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) {
      controller.abort();
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (external) external.removeEventListener("abort", onExternalAbort);
    },
  };
}

/** Read up to `max` chars of a non-2xx response body for error context. */
export async function readErrorSnippet(
  response: Response,
  max = 200,
): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, max).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}
