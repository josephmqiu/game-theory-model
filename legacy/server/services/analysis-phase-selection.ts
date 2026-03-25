import type { MethodologyPhase } from "../../shared/types/methodology";
import { V3_PHASES } from "../../shared/types/methodology";

export type SupportedAnalysisPhase = Exclude<MethodologyPhase, "revalidation">;

export const SUPPORTED_ANALYSIS_PHASES: SupportedAnalysisPhase[] = [
  ...V3_PHASES,
] as SupportedAnalysisPhase[];

export function getCanonicalAnalysisPhaseIndex(
  phase: MethodologyPhase,
): number {
  return SUPPORTED_ANALYSIS_PHASES.indexOf(phase as SupportedAnalysisPhase);
}

export function normalizeRequestedActivePhases(
  requestedPhases?: MethodologyPhase[],
): SupportedAnalysisPhase[] {
  if (requestedPhases === undefined) {
    return [...SUPPORTED_ANALYSIS_PHASES];
  }

  if (!Array.isArray(requestedPhases)) {
    throw new Error("activePhases must be an array of supported phases");
  }

  const invalidPhases = requestedPhases.filter(
    (phase): phase is MethodologyPhase =>
      !SUPPORTED_ANALYSIS_PHASES.includes(phase as SupportedAnalysisPhase),
  );

  if (invalidPhases.length > 0) {
    throw new Error(
      `Invalid activePhases: ${invalidPhases.join(", ")}. Allowed phases: ${SUPPORTED_ANALYSIS_PHASES.join(", ")}`,
    );
  }

  const requestedPhaseSet = new Set(
    requestedPhases as SupportedAnalysisPhase[],
  );
  const normalized = SUPPORTED_ANALYSIS_PHASES.filter((phase) =>
    requestedPhaseSet.has(phase),
  );

  if (normalized.length === 0) {
    throw new Error(
      "activePhases must include at least one supported canonical phase",
    );
  }

  return normalized;
}
