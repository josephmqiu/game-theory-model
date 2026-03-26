import type { RunKind } from "./api";
import type { AnalysisPhaseActivityKind, PhaseSummary } from "./events";
import type { MethodologyPhase } from "./methodology";
import type { RuntimeError } from "./runtime-error";

export type ThreadTerminalStatus = "completed" | "failed" | "cancelled";
export type DurableMessageRole = "user" | "assistant";
export type ActivityScope = "analysis-phase" | "chat-turn";
export type ActivityStatus = "completed" | "failed";

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

export interface ThreadMessageState {
  id: string;
  workspaceId: string;
  threadId: string;
  role: DurableMessageRole;
  content: string;
  createdAt: number;
  updatedAt: number;
  attachments?: Array<{
    name: string;
    mediaType: string;
    data: string;
  }>;
}

export type DurableRunStatus = "running" | "completed" | "failed" | "cancelled";

export interface RunActivitySummary {
  kind: AnalysisPhaseActivityKind;
  message: string;
}

export interface RunSummaryState {
  statusMessage: string;
  failedPhase?: MethodologyPhase;
  completedPhases: number;
}

export interface RunPromptProvenance {
  analysisType: "game-theory";
  activePhases: MethodologyPhase[];
  templateSetIdentity: string;
  templateSetHash: string;
}

export interface RunLogCorrelation {
  logFileName: string;
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
  summary?: RunSummaryState;
  promptProvenance?: RunPromptProvenance;
  latestPhaseTurnId?: string;
  logCorrelation?: RunLogCorrelation;
}

export interface ActivityEntry {
  id: string;
  eventId: string;
  sequence: number;
  workspaceId: string;
  threadId: string;
  runId?: string;
  phase?: MethodologyPhase;
  scope: ActivityScope;
  kind: AnalysisPhaseActivityKind;
  message: string;
  status?: ActivityStatus;
  toolName?: string;
  query?: string;
  occurredAt: number;
  causedByEventId?: string;
}

export type PhaseTurnStatus = "running" | "completed" | "failed" | "cancelled";

export interface PhaseTurnPromptProvenance {
  phase: MethodologyPhase;
  templateIdentity: string;
  templateHash: string;
  effectivePromptHash: string;
  variant: "initial" | "revision";
}

export interface PhaseTurnActivitySummary {
  lastKind: AnalysisPhaseActivityKind;
  lastMessage: string;
  lastOccurredAt: number;
}

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
  promptProvenance: PhaseTurnPromptProvenance;
  activitySummary?: PhaseTurnActivitySummary;
  startedAt: number;
  completedAt: number | null;
  lastEventId: string;
  createdAt: number;
  updatedAt: number;
}
