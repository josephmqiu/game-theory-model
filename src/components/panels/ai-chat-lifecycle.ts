import type { ChatMessage } from "@/services/ai/ai-types";
import {
  PHASE_LABELS,
  V3_PHASES,
  getRunnablePhaseNumber,
  type MethodologyPhase,
} from "@/types/methodology";

export function getPhaseStartMessageId(
  runId: string,
  phase: MethodologyPhase,
): string {
  return `phase-${runId}-${phase}-start`;
}

export function getAnalysisCompleteMessageId(runId: string): string {
  return `analysis-complete-${runId}`;
}

export function buildPhaseStartMessage(
  runId: string,
  phase: MethodologyPhase,
): ChatMessage | null {
  const phaseNumber = getRunnablePhaseNumber(phase);
  if (phaseNumber === null) {
    return null;
  }

  return {
    id: getPhaseStartMessageId(runId, phase),
    role: "assistant",
    content: `Starting Phase ${phaseNumber}: ${PHASE_LABELS[phase]}...`,
    timestamp: Date.now(),
  };
}

export function buildAnalysisCompleteMessage(
  runId: string,
  entityCount: number,
): ChatMessage {
  return {
    id: getAnalysisCompleteMessageId(runId),
    role: "assistant",
    content: `Analysis complete. ${entityCount} entities identified across ${V3_PHASES.length} phases. Click any entity on the canvas to inspect.`,
    timestamp: Date.now(),
  };
}
