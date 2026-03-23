import type { Analysis } from "./entity";
import type { MethodologyPhase } from "./methodology";

export type RunStatusValue = "idle" | "running" | "failed" | "cancelled";
export type RunKind = "analysis" | "revalidation";
export type RunFailureKind =
  | "rate_limit"
  | "provider_api_error"
  | "connector_error"
  | "mcp_transport_error"
  | "validation"
  | "timeout"
  | "unknown";

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
  failureKind?: RunFailureKind;
  failureMessage?: string;
  deferredRevalidationPending: boolean;
}

export interface AnalysisStateResponse {
  analysis: Analysis;
  runStatus: RunStatus;
}

export interface AbortAnalysisResponse {
  aborted: boolean;
}
