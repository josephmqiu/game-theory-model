import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
  ThreadMessageState,
  ThreadState,
} from "./workspace-state";
import type {
  AnalysisMutationEvent,
  AnalysisProgressEvent,
} from "./events";
import type { AnalysisRuntimeOverrides, RuntimeProvider } from "./analysis-runtime";
import type { AnalysisStateResponse, RunStatus } from "./api";
import type { RuntimeError } from "./runtime-error";
import type { PendingInteractionState } from "./user-input";

export type WorkspaceRuntimeTopic =
  | "threads"
  | "thread-detail"
  | "run-detail"
  | "analysis"
  | "chat";

export interface WorkspaceRuntimeScope {
  workspaceId: string;
  threadId?: string;
}

export type WorkspaceRuntimeTopicRevisions = Partial<
  Record<WorkspaceRuntimeTopic, number>
>;

export interface WorkspaceRuntimeThreadDetail {
  thread: ThreadState;
  messages: ThreadMessageState[];
  activities: ActivityEntry[];
  pendingInteractions?: PendingInteractionState[];
}

export interface WorkspaceRuntimeBootstrap {
  workspaceId: string;
  threads: ThreadState[];
  activeThreadId?: string;
  activeThreadDetail: WorkspaceRuntimeThreadDetail | null;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
  topicRevisions: WorkspaceRuntimeTopicRevisions;
  serverConnectionId: string;
}

export interface WorkspaceRuntimeThreadsUpdatedEvent {
  kind: "threads.updated";
  workspaceId: string;
  threads: ThreadState[];
}

export interface WorkspaceRuntimeThreadDetailUpdatedEvent {
  kind: "thread.detail.updated";
  workspaceId: string;
  threadId?: string;
  detail: WorkspaceRuntimeThreadDetail | null;
}

export interface WorkspaceRuntimeRunDetailUpdatedEvent {
  kind: "run.detail.updated";
  workspaceId: string;
  threadId?: string;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
}

export interface WorkspaceRuntimeAnalysisMutationEvent {
  kind: "analysis.mutation";
  event: AnalysisMutationEvent;
}

export interface WorkspaceRuntimeAnalysisStatusEvent {
  kind: "analysis.status";
  runStatus: RunStatus;
}

export interface WorkspaceRuntimeAnalysisProgressEvent {
  kind: "analysis.progress";
  event: AnalysisProgressEvent;
}

export interface WorkspaceRuntimeChatMessageDeltaEvent {
  kind: "chat.message.delta";
  correlationId: string;
  content: string;
  contentKind?: "output" | "reasoning";
}

export interface WorkspaceRuntimeChatMessageCompleteEvent {
  kind: "chat.message.complete";
  correlationId: string;
  messageId?: string;
  content: string;
}

export interface WorkspaceRuntimeChatMessageErrorEvent {
  kind: "chat.message.error";
  correlationId: string;
  error: RuntimeError;
}

export interface WorkspaceRuntimeChatToolStartEvent {
  kind: "chat.tool.start";
  correlationId: string;
  toolName: string;
}

export interface WorkspaceRuntimeChatToolResultEvent {
  kind: "chat.tool.result";
  correlationId: string;
  toolName: string;
  output?: unknown;
}

export interface WorkspaceRuntimeChatToolErrorEvent {
  kind: "chat.tool.error";
  correlationId: string;
  toolName: string;
  error: string;
}

export type WorkspaceRuntimeEvent =
  | WorkspaceRuntimeThreadsUpdatedEvent
  | WorkspaceRuntimeThreadDetailUpdatedEvent
  | WorkspaceRuntimeRunDetailUpdatedEvent
  | WorkspaceRuntimeAnalysisMutationEvent
  | WorkspaceRuntimeAnalysisStatusEvent
  | WorkspaceRuntimeAnalysisProgressEvent
  | WorkspaceRuntimeChatMessageDeltaEvent
  | WorkspaceRuntimeChatMessageCompleteEvent
  | WorkspaceRuntimeChatMessageErrorEvent
  | WorkspaceRuntimeChatToolStartEvent
  | WorkspaceRuntimeChatToolResultEvent
  | WorkspaceRuntimeChatToolErrorEvent;

export type WorkspaceRuntimeEventByTopic = {
  threads: WorkspaceRuntimeThreadsUpdatedEvent;
  "thread-detail": WorkspaceRuntimeThreadDetailUpdatedEvent;
  "run-detail": WorkspaceRuntimeRunDetailUpdatedEvent;
  analysis:
    | WorkspaceRuntimeAnalysisMutationEvent
    | WorkspaceRuntimeAnalysisStatusEvent
    | WorkspaceRuntimeAnalysisProgressEvent;
  chat:
    | WorkspaceRuntimeChatMessageDeltaEvent
    | WorkspaceRuntimeChatMessageCompleteEvent
    | WorkspaceRuntimeChatMessageErrorEvent
    | WorkspaceRuntimeChatToolStartEvent
    | WorkspaceRuntimeChatToolResultEvent
    | WorkspaceRuntimeChatToolErrorEvent;
};

export interface WorkspaceRuntimeClientHello {
  type: "client_hello";
  connectionId?: string;
  workspaceId: string;
  activeThreadId?: string;
  activeChatCorrelations?: string[];
  lastSeenByTopic?: WorkspaceRuntimeTopicRevisions;
}

export interface WorkspaceRuntimeCreateThreadRequestPayload {
  workspaceId: string;
  title?: string;
}

export interface WorkspaceRuntimeResolveQuestionPayload {
  workspaceId: string;
  threadId: string;
  interactionId: string;
  kind: "question" | "approval";
  selectedOptions?: number[];
  customText?: string;
  approved?: boolean;
  reason?: string;
}

export interface WorkspaceRuntimeRenameThreadRequestPayload {
  workspaceId: string;
  threadId: string;
  title: string;
}

export interface WorkspaceRuntimeDeleteThreadRequestPayload {
  workspaceId: string;
  threadId: string;
}

export interface WorkspaceRuntimeChatTurnStartRequestPayload {
  workspaceId: string;
  threadId?: string;
  threadTitle?: string;
  correlationId: string;
  message: {
    content: string;
    attachments?: Array<{
      name: string;
      mediaType: string;
      data: string;
    }>;
  };
  provider: RuntimeProvider;
  model: string;
  thinkingMode?: "adaptive" | "disabled" | "enabled";
  thinkingBudgetTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
}

export interface WorkspaceRuntimeAnalysisStateRequestPayload {
  workspaceId: string;
}

export interface WorkspaceRuntimeAnalysisStartRequestPayload {
  workspaceId: string;
  threadId?: string;
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
}

export interface WorkspaceRuntimeAnalysisAbortRequestPayload {
  workspaceId: string;
}

export interface WorkspaceRuntimeRequestPayloadMap {
  "analysis.start": WorkspaceRuntimeAnalysisStartRequestPayload;
  "analysis.abort": WorkspaceRuntimeAnalysisAbortRequestPayload;
  "workspace.thread.create": WorkspaceRuntimeCreateThreadRequestPayload;
  "workspace.thread.rename": WorkspaceRuntimeRenameThreadRequestPayload;
  "workspace.thread.delete": WorkspaceRuntimeDeleteThreadRequestPayload;
  "interaction.respond": WorkspaceRuntimeResolveQuestionPayload;
  "chat.turn.start": WorkspaceRuntimeChatTurnStartRequestPayload;
  "analysis.state.get": WorkspaceRuntimeAnalysisStateRequestPayload;
}

export type WorkspaceRuntimeRequestKind =
  keyof WorkspaceRuntimeRequestPayloadMap;

export type WorkspaceRuntimeRequest<
  TKind extends WorkspaceRuntimeRequestKind = WorkspaceRuntimeRequestKind,
> = {
  type: "request";
  requestId: string;
  kind: TKind;
  payload: WorkspaceRuntimeRequestPayloadMap[TKind];
};

export interface WorkspaceRuntimeResponse<TResult = unknown> {
  type: "response";
  requestId: string;
  ok: boolean;
  result?: TResult;
  error?: string;
  receipt?: {
    receiptId?: string;
  };
}

export interface WorkspaceRuntimeBootstrapEnvelope {
  type: "bootstrap";
  payload: WorkspaceRuntimeBootstrap;
}

export type WorkspaceRuntimePushEnvelope<
  TTopic extends WorkspaceRuntimeTopic = WorkspaceRuntimeTopic,
> = {
  type: "push";
  topic: TTopic;
  revision: number;
  scope: WorkspaceRuntimeScope;
  event: WorkspaceRuntimeEventByTopic[TTopic];
  replayed?: boolean;
};

export type WorkspaceRuntimeClientEnvelope =
  | WorkspaceRuntimeClientHello
  | WorkspaceRuntimeRequest;

export type WorkspaceRuntimeServerEnvelope =
  | WorkspaceRuntimeBootstrapEnvelope
  | WorkspaceRuntimePushEnvelope
  | WorkspaceRuntimeResponse;

export type WorkspaceRuntimeAnalysisStateResult = AnalysisStateResponse;

export type WorkspaceTransportDiagnosticCode =
  | "connect"
  | "disconnect"
  | "error"
  | "hello-received"
  | "bootstrap-sent"
  | "request-received"
  | "request-completed"
  | "request-failed"
  | "request-timeout"
  | "request-queued"
  | "request-flushed"
  | "response-mismatch"
  | "malformed-frame"
  | "push-sent"
  | "push-dropped"
  | "replay-sent"
  | "reconnect-scheduled"
  | "reconnect-open"
  | "close";

export type WorkspaceRecoveryDiagnosticCode =
  | "recovery-scan-started"
  | "recovery-scan-completed"
  | "recovery-binding-found"
  | "recovery-binding-missing"
  | "resume-deferred-on-question"
  | "resume-attempt"
  | "resume-succeeded"
  | "resume-failed"
  | "fallback-selected"
  | "binding-upserted"
  | "binding-cleared"
  | "run-recovery-failed"
  | "recovery-questions-dismissed";

export interface WorkspaceTransportDiagnostic {
  id: string;
  source: "client" | "server";
  code: WorkspaceTransportDiagnosticCode;
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  connectionId?: string;
  workspaceId?: string;
  threadId?: string;
  data?: Record<string, unknown>;
}

export interface WorkspaceRecoveryDiagnostic {
  id: string;
  source: "server";
  code: WorkspaceRecoveryDiagnosticCode;
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  workspaceId?: string;
  threadId?: string;
  runId?: string;
  phaseTurnId?: string;
  provider?: string;
  providerSessionId?: string;
  data?: Record<string, unknown>;
}

export interface WorkspaceRuntimeDiagnosticsSnapshot {
  recent: WorkspaceTransportDiagnostic[];
  recoveryRecent: WorkspaceRecoveryDiagnostic[];
  byConnectionId?: WorkspaceTransportDiagnostic[];
}
