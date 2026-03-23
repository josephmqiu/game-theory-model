import { defineEventHandler } from "h3";
import type {
  AnalysisStateResponse,
  RunStatus,
} from "../../../shared/types/api";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import * as entityGraphService from "../../services/entity-graph-service";
import {
  countCompletedRunnablePhases,
  V3_PHASES,
} from "../../../src/types/methodology";

function buildIdleRunStatus(): RunStatus {
  const analysis = entityGraphService.getAnalysis();
  const completed = countCompletedRunnablePhases(analysis.phases);

  return {
    status: "idle",
    kind: null,
    runId: null,
    activePhase: null,
    progress: {
      completed,
      total: V3_PHASES.length,
    },
    deferredRevalidationPending: false,
  };
}

export default defineEventHandler((): AnalysisStateResponse => {
  const activeStatus = analysisOrchestrator.getActiveStatus();

  return {
    analysis: entityGraphService.getAnalysis(),
    runStatus: activeStatus
      ? {
          status: "running",
          kind: null,
          runId: activeStatus.runId,
          activePhase: activeStatus.activePhase,
          progress: {
            completed: activeStatus.phasesCompleted,
            total: activeStatus.totalPhases,
          },
          deferredRevalidationPending: false,
        }
      : buildIdleRunStatus(),
  };
});
