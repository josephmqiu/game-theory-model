// revision-peek.ts — helpers for the "what changed" surface (3.1A).
// Reads the per-entity revision log (E1B) to power the canvas updated-dot
// and the overlay card's compact old→new diff peek.

import type { AnalysisEntity, RevisionLogEntry } from "@/types/entity";

/** Latest revalidation-driven content change, or null. */
export function latestRevalidationEntry(
  entity: Pick<AnalysisEntity, "revisionLog">,
): RevisionLogEntry | null {
  const log = entity.revisionLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.logSource === "revalidation" && entry.fieldDiffs.length > 0) {
      return entry;
    }
  }
  return null;
}

/** True when the newest revalidation change is above the viewed watermark. */
export function hasUnseenRevalidationUpdate(
  entity: Pick<AnalysisEntity, "id" | "revisionLog">,
  viewedLogNos: Record<string, number>,
): boolean {
  const entry = latestRevalidationEntry(entity);
  if (!entry) return false;
  return entry.logNo > (viewedLogNos[entity.id] ?? 0);
}

const PEEK_VALUE_MAX_CHARS = 140;

/**
 * Render a JSON-encoded diff value (see revision-log.ts) as compact display
 * text: strings lose their quotes, structures stay JSON, long values get an
 * ellipsis.
 */
export function formatDiffValue(encoded: string): string {
  let display = encoded;
  try {
    const parsed: unknown = JSON.parse(encoded);
    display = typeof parsed === "string" ? parsed : encoded;
  } catch {
    // Truncated JSON from the server-side 2KB cap — show as-is
  }
  if (display.length > PEEK_VALUE_MAX_CHARS) {
    return display.slice(0, PEEK_VALUE_MAX_CHARS) + "…";
  }
  return display;
}

/** Human label for a diff field path, e.g. "data.key_evidence" → "key evidence". */
export function formatDiffField(field: string): string {
  const leaf = field.startsWith("data.") ? field.slice(5) : field;
  return leaf.replace(/_/g, " ");
}
