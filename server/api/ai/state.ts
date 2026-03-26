import { defineEventHandler } from "h3";
import type { AnalysisStateResponse } from "../../../shared/types/api";
import * as entityGraphService from "../../services/entity-graph-service";
import * as runtimeStatus from "../../services/runtime-status";
import { waitForRuntimeRecovery } from "../../services/workspace";

export default defineEventHandler(async (): Promise<AnalysisStateResponse> => {
  await waitForRuntimeRecovery();
  return {
    analysis: entityGraphService.getAnalysis(),
    runStatus: runtimeStatus.getSnapshot(),
    revision: runtimeStatus.getRevision(),
  };
});
