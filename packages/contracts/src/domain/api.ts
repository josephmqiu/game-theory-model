/**
 * Canonical API response types for the game-theory analysis domain.
 *
 * These are the source-of-truth type definitions. Both apps/web and apps/server
 * re-export from here rather than maintaining independent copies.
 */
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
  failedPhase?: MethodologyPhase | undefined;
  failureKind?: RunFailureKind | undefined;
  failureMessage?: string | undefined;
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
