import type { Analysis } from "./entity";
import type { MethodologyPhase } from "./methodology";
import type { RuntimeError } from "./runtime-error";

export type RunStatusValue = "idle" | "running" | "failed" | "cancelled";
export type RunKind = "analysis" | "revalidation";

export interface RunStatus {
  status: RunStatusValue;
  kind: RunKind | null;
  runId: string | null;
  activePhase: MethodologyPhase | null;
  progress: {
    completed: number;
    total: number;
  };
  failedPhase?: MethodologyPhase;
  failure?: RuntimeError;
  deferredRevalidationPending: boolean;
}

export interface AnalysisStateResponse {
  analysis: Analysis;
  runStatus: RunStatus;
  revision: number;
}

export interface AbortAnalysisResponse {
  aborted: boolean;
}
