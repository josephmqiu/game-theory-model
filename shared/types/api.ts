import type { Analysis } from "./entity";
import type { MethodologyPhase } from "./methodology";

export interface RunStatus {
  status: "idle" | "running";
  runId: string | null;
  activePhase: MethodologyPhase | null;
  progress: {
    completed: number;
    total: number;
  };
}

export interface AnalysisStateResponse {
  analysis: Analysis;
  runStatus: RunStatus;
}

export interface AbortAnalysisResponse {
  aborted: boolean;
}
