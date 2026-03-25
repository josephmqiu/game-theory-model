import type { RunKind } from "./api";
import type {
  AnalysisPhaseActivityKind,
  PhaseSummary,
} from "./events";
import type { MethodologyPhase } from "./methodology";
import type { RuntimeError } from "./runtime-error";

export type ThreadTerminalStatus = "completed" | "failed" | "cancelled";

export interface ThreadState {
  id: string;
  workspaceId: string;
  title: string;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
  latestRunId?: string;
  latestActivityAt?: number;
  latestTerminalStatus?: ThreadTerminalStatus;
  summary?: string;
}

export type DurableRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunActivitySummary {
  kind: AnalysisPhaseActivityKind;
  message: string;
}

export interface RunState {
  id: string;
  workspaceId: string;
  threadId: string;
  kind: RunKind;
  provider: string | null;
  model: string | null;
  effort: string | null;
  status: DurableRunStatus;
  activePhase: MethodologyPhase | null;
  progress: {
    completed: number;
    total: number;
  };
  failedPhase?: MethodologyPhase;
  failure?: RuntimeError;
  startedAt: number;
  finishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  latestActivityAt?: number;
  latestActivity?: RunActivitySummary;
}

export interface ActivityEntry {
  id: string;
  eventId: string;
  sequence: number;
  workspaceId: string;
  threadId: string;
  runId: string;
  phase: MethodologyPhase;
  kind: AnalysisPhaseActivityKind;
  message: string;
  toolName?: string;
  query?: string;
  occurredAt: number;
  causedByEventId?: string;
}

export type PhaseTurnStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface PhaseTurnSummaryState {
  id: string;
  workspaceId: string;
  threadId: string;
  runId: string;
  phase: MethodologyPhase;
  turnIndex: number;
  status: PhaseTurnStatus;
  summary?: PhaseSummary;
  failure?: RuntimeError;
  startedAt: number;
  completedAt: number | null;
  lastEventId: string;
  createdAt: number;
  updatedAt: number;
}
