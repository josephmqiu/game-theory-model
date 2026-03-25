/**
 * Canonical analysis runtime types for the game-theory analysis domain.
 *
 * These are the source-of-truth type definitions. Both apps/web and apps/server
 * re-export from here rather than maintaining independent copies.
 */
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
