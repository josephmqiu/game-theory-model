import { defineEventHandler } from "h3";
import type { AnalysisStateResponse } from "../../../shared/types/api";
import * as entityGraphService from "../../services/entity-graph-service";
import * as runtimeStatus from "../../services/runtime-status";

export default defineEventHandler((): AnalysisStateResponse => {
  return {
    analysis: entityGraphService.getAnalysis(),
    runStatus: runtimeStatus.getSnapshot(),
    revision: runtimeStatus.getRevision(),
  };
});
