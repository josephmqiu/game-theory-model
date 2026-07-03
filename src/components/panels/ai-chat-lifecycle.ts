import type { ChatMessage } from "@/services/ai/ai-types";
import { RUNNABLE_PHASES } from "@/types/methodology";

export function getAnalysisCompleteMessageId(runId: string): string {
  return `analysis-complete-${runId}`;
}

export function buildAnalysisCompleteMessage(
  runId: string,
  entityCount: number,
): ChatMessage {
  return {
    id: getAnalysisCompleteMessageId(runId),
    role: "assistant",
    content: `Analysis complete. ${entityCount} entities identified across ${RUNNABLE_PHASES.length} phases. Click any entity on the canvas to inspect.`,
    timestamp: Date.now(),
  };
}

export function buildSessionExpiredMessage(): ChatMessage {
  return {
    id: `session-expired-${Date.now()}`,
    role: "assistant",
    content: "Session expired — starting fresh",
    timestamp: Date.now(),
  };
}
