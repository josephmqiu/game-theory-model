import type { AnalysisFailureKind } from "@/services/ai/methodology-orchestrator";
import type { MethodologyPhase } from "@/types/methodology";

export type PhaseFailureState = Partial<
  Record<
    MethodologyPhase,
    {
      failureKind: AnalysisFailureKind;
      runId: string;
    }
  >
>;

export const PHASE_FAILURE_LABELS: Record<AnalysisFailureKind, string> = {
  timeout: "timeout",
  "parse-error": "parse error",
  "provider-error": "provider error",
};

export function getPhaseFailureLabel(kind: AnalysisFailureKind): string {
  return PHASE_FAILURE_LABELS[kind];
}
