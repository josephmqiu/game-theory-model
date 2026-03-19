import type { MethodologyPhase } from "@/types/methodology";

export type AnalysisFailureKind = "timeout" | "parse-error" | "provider-error";

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
