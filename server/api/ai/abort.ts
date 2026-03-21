import { defineEventHandler } from "h3";
import type { AbortAnalysisResponse } from "../../../shared/types/api";
import * as analysisOrchestrator from "../../agents/analysis-agent";

export default defineEventHandler((): AbortAnalysisResponse => {
  const aborted = analysisOrchestrator.isRunning();
  if (aborted) {
    analysisOrchestrator.abort();
  }

  return { aborted };
});
