import type { MethodologyPhase } from "./methodology";

export type AnalysisEffortLevel = "quick" | "standard" | "thorough";

export interface AnalysisRuntimeOverrides {
  webSearch?: boolean;
  effortLevel?: AnalysisEffortLevel;
  activePhases?: MethodologyPhase[];
}

export interface ResolvedAnalysisRuntime {
  webSearch: boolean;
  effortLevel: AnalysisEffortLevel;
}
