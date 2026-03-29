import i18n from "@/i18n";
import type { AnalysisPhaseActivityEvent } from "./analysis-client";

/**
 * Convert a streamed phase_activity event into a human-readable status line.
 * Uses i18n for localised labels; falls back to the event kind.
 */
export function formatPhaseActivityNote(
  event: AnalysisPhaseActivityEvent,
): string {
  const query = event.query?.trim();
  if (event.kind === "web-search" && query) {
    return i18n.t("analysis.activity.usingWebSearchQuery", { query });
  }

  const message = event.message.trim();
  if (message) return message;

  if (event.toolName) {
    return i18n.t("analysis.activity.usingTool", { toolName: event.toolName });
  }

  return i18n.t("analysis.activity.default");
}
