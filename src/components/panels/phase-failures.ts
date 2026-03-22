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

const FAILURE_I18N_KEYS: Record<AnalysisFailureKind, string> = {
  timeout: "analysis.failure.timeout",
  "parse-error": "analysis.failure.parseError",
  "provider-error": "analysis.failure.providerError",
};

export function getPhaseFailureLabel(
  kind: AnalysisFailureKind,
  t: (key: string) => string,
): string {
  return t(FAILURE_I18N_KEYS[kind]);
}
