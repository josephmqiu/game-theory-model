/**
 * Re-export canonical analysis runtime types from @t3tools/contracts.
 *
 * This file exists for backward compatibility so that existing imports
 * from "./analysis-runtime" or "../types/analysis-runtime" continue to work.
 */
export type {
  AnalysisEffortLevel,
  AnalysisRuntimeOverrides,
  ResolvedAnalysisRuntime,
} from "@t3tools/contracts";
