import type {
  AnalysisRuntimeOverrides,
  ResolvedAnalysisRuntime,
} from "./types/analysis-runtime";
import { analysisRuntimeConfig } from "./analysis-runtime-config";

export function getDefaultAnalysisRuntime(): ResolvedAnalysisRuntime {
  return {
    webSearch: analysisRuntimeConfig.codex.analysisWebSearchEnabled,
    effortLevel: "standard",
  };
}

export function resolveAnalysisRuntime(
  overrides?: AnalysisRuntimeOverrides,
): ResolvedAnalysisRuntime {
  const defaults = getDefaultAnalysisRuntime();

  return {
    webSearch:
      typeof overrides?.webSearch === "boolean"
        ? overrides.webSearch
        : defaults.webSearch,
    effortLevel: overrides?.effortLevel ?? defaults.effortLevel,
  };
}
