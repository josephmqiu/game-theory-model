import type { RunKind } from "./api";
import type { AnalysisPhaseActivityKind, PhaseSummary } from "./events";
import type { MethodologyPhase } from "./methodology";
import type {
  PromptPackMode,
  PromptPackSourceRef,
  PromptPackToolPolicy,
  PromptTemplateVariant,
} from "./prompt-pack";
import type { RuntimeError } from "./runtime-error";

export type ThreadTerminalStatus = "completed" | "failed" | "cancelled";
export type DurableMessageRole = "user" | "assistant";
export type ActivityScope = "analysis-phase" | "chat-turn";
export type ActivityStatus = "completed" | "failed";
export type DurableRunKind = RunKind | "analysis";
export type ThreadMessageSource = "chat" | "analysis";
export type ThreadMessageKind = "user-turn" | "assistant-turn";

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
  runId?: string;
  phaseTurnId?: string;
  phase?: MethodologyPhase;
  runKind?: DurableRunKind;
  source?: ThreadMessageSource;
  kind?: ThreadMessageKind;
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
  promptPackId: string;
  promptPackVersion: string;
  promptPackMode: PromptPackMode;
  promptPackSource: PromptPackSourceRef;
  templateSetIdentity: string;
  templateSetHash: string;
  toolPolicyByPhase: Partial<Record<MethodologyPhase, PromptPackToolPolicy>>;
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
  phaseTurnId?: string;
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
  promptPackId: string;
  promptPackVersion: string;
  promptPackMode: PromptPackMode;
  promptPackSource: PromptPackSourceRef;
  phase: MethodologyPhase;
  templateIdentity: string;
  templateHash: string;
  effectivePromptHash: string;
  variant: PromptTemplateVariant;
  toolPolicy: PromptPackToolPolicy;
  doneCondition: string;
}

export interface TemplatePromptProvenance {
  promptPackId: string;
  promptPackVersion: string;
  promptPackMode: PromptPackMode;
  promptPackSource: PromptPackSourceRef;
  templateIdentity: string;
  templateHash: string;
  effectivePromptHash: string;
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
