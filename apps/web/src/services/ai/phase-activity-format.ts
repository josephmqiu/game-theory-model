import i18n from "@/i18n";
import type { AnalysisPhaseActivityEvent } from "@/transport/analysis-rpc";

/**
 * Convert a phase_activity SSE event into a human-readable status line.
 * Uses i18n for localised labels; falls back to the event kind.
 */
export function formatPhaseActivityNote(
  event: AnalysisPhaseActivityEvent,
): string {
  const message = event.message.trim();
  if (message) return message;

  if (event.toolName) {
    return i18n.t("analysis.activity.usingTool", { toolName: event.toolName });
  }

  switch (event.kind) {
    case "preparing":
      return i18n.t("analysis.activity.preparing");
    case "researching":
      return i18n.t("analysis.activity.researching");
    case "synthesizing":
      return i18n.t("analysis.activity.synthesizing");
    case "validating":
      return i18n.t("analysis.activity.validating");
    case "retrying":
      return i18n.t("analysis.activity.retrying");
    default:
      return i18n.t("analysis.activity.default");
  }
}
