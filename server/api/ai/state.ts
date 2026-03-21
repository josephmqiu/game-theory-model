import { defineEventHandler } from "h3";
import type { AnalysisStateResponse, RunStatus } from "../../../shared/types/api";
import { V1_PHASES } from "../../../src/types/methodology";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import * as entityGraphService from "../../services/entity-graph-service";

function buildIdleRunStatus(): RunStatus {
  const analysis = entityGraphService.getAnalysis();
  const completed = analysis.phases.filter((phase) => phase.status === "complete")
    .length;

  return {
    status: "idle",
    runId: null,
    activePhase: null,
    progress: {
      completed,
      total: V1_PHASES.length,
    },
  };
}

export default defineEventHandler((): AnalysisStateResponse => {
  const activeStatus = analysisOrchestrator.getActiveStatus();

  return {
    analysis: entityGraphService.getAnalysis(),
    runStatus: activeStatus
      ? {
          status: "running",
          runId: activeStatus.runId,
          activePhase: activeStatus.activePhase,
          progress: {
            completed: activeStatus.phasesCompleted,
            total: activeStatus.totalPhases,
          },
        }
      : buildIdleRunStatus(),
  };
});
