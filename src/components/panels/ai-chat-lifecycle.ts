import type { ChatMessage } from "@/services/ai/ai-types";
import {
  PHASE_LABELS,
  V3_PHASES,
  getRunnablePhaseNumber,
  type MethodologyPhase,
} from "@/types/methodology";

export const PHASE_ACTIVITY_LINE_LIMIT = 6;

export function getPhaseStartMessageId(
  runId: string,
  phase: MethodologyPhase,
): string {
  return `phase-${runId}-${phase}-start`;
}

export function getAnalysisCompleteMessageId(runId: string): string {
  return `analysis-complete-${runId}`;
}

export function appendPhaseActivityLine(
  lines: string[],
  line: string,
): string[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return lines;
  }
  if (lines[lines.length - 1] === trimmed) {
    return lines;
  }

  const next = [...lines, trimmed];
  return next.length > PHASE_ACTIVITY_LINE_LIMIT
    ? next.slice(-PHASE_ACTIVITY_LINE_LIMIT)
    : next;
}

function buildPhaseTranscriptContent(
  phase: MethodologyPhase,
  lines: string[],
): string | null {
  const phaseNumber = getRunnablePhaseNumber(phase);
  if (phaseNumber === null) {
    return null;
  }

  const transcriptLines =
    lines.length > 0 ? lines : ["Preparing phase analysis."];

  return [`Phase ${phaseNumber}: ${PHASE_LABELS[phase]}`, ...transcriptLines].join(
    "\n",
  );
}

export function buildPhaseStartMessage(
  runId: string,
  phase: MethodologyPhase,
): ChatMessage | null {
  const content = buildPhaseTranscriptContent(phase, [
    "Preparing phase analysis.",
  ]);
  if (!content) {
    return null;
  }

  return {
    id: getPhaseStartMessageId(runId, phase),
    role: "assistant",
    content,
    isStreaming: true,
    timestamp: Date.now(),
  };
}

export function buildPhaseActivityMessage(
  runId: string,
  phase: MethodologyPhase,
  lines: string[],
  isStreaming = true,
): ChatMessage | null {
  const content = buildPhaseTranscriptContent(phase, lines);
  if (!content) {
    return null;
  }

  return {
    id: getPhaseStartMessageId(runId, phase),
    role: "assistant",
    content,
    isStreaming,
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
