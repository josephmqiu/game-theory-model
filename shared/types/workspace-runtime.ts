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
  ChatContentKind,
} from "./events";
import type { AnalysisStateResponse, RunStatus } from "./api";
import type { RuntimeProvider } from "./analysis-runtime";
import type { RuntimeError } from "./runtime-error";
import type { PendingQuestionState } from "./user-input";

export type WorkspaceRuntimeChannel =
  | "threads"
  | "thread-detail"
  | "run-detail"
  | "analysis-mutation"
  | "analysis-status"
  | "analysis-progress"
  | "chat-event";

export interface WorkspaceRuntimeScope {
  workspaceId: string;
  threadId?: string;
}

export type WorkspaceRuntimeChannelRevisions = Partial<
  Record<WorkspaceRuntimeChannel, number>
>;

export interface WorkspaceRuntimeThreadDetail {
  thread: ThreadState;
  messages: ThreadMessageState[];
  activities: ActivityEntry[];
  pendingQuestions?: PendingQuestionState[];
}

export interface WorkspaceRuntimeRunDetail {
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
}

export interface WorkspaceRuntimeBootstrap {
  workspaceId: string;
  threads: ThreadState[];
  activeThreadId?: string;
  activeThreadDetail: WorkspaceRuntimeThreadDetail | null;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
  channelRevisions: WorkspaceRuntimeChannelRevisions;
  serverConnectionId: string;
}

export interface WorkspaceRuntimeThreadsPushPayload {
  workspaceId: string;
  threads: ThreadState[];
}

export interface WorkspaceRuntimeThreadDetailPushPayload {
  workspaceId: string;
  threadId?: string;
  detail: WorkspaceRuntimeThreadDetail | null;
}

export interface WorkspaceRuntimeRunDetailPushPayload {
  workspaceId: string;
  threadId?: string;
  latestRun: RunState | null;
  latestPhaseTurns: PhaseTurnSummaryState[];
}

export interface WorkspaceRuntimeAnalysisMutationPayload {
  event: AnalysisMutationEvent;
}

export interface WorkspaceRuntimeAnalysisStatusPayload {
  runStatus: RunStatus;
}

export interface WorkspaceRuntimeAnalysisProgressPayload {
  event: AnalysisProgressEvent;
}

export interface WorkspaceRuntimeChatTurnDeltaEvent {
  type: "chat.message.delta";
  correlationId: string;
  content: string;
  content_kind?: ChatContentKind;
}

export interface WorkspaceRuntimeChatTurnCompleteEvent {
  type: "chat.message.complete";
  correlationId: string;
  messageId?: string;
  content: string;
}

export interface WorkspaceRuntimeChatTurnErrorEvent {
  type: "chat.message.error";
  correlationId: string;
  error: RuntimeError;
}

export interface WorkspaceRuntimeChatToolStartEvent {
  type: "chat.tool.start";
  correlationId: string;
  toolName: string;
}

export interface WorkspaceRuntimeChatToolResultEvent {
  type: "chat.tool.result";
  correlationId: string;
  toolName: string;
  output?: unknown;
}

export interface WorkspaceRuntimeChatToolErrorEvent {
  type: "chat.tool.error";
  correlationId: string;
  toolName: string;
  error: string;
}

export type WorkspaceRuntimeChatEvent =
  | WorkspaceRuntimeChatTurnDeltaEvent
  | WorkspaceRuntimeChatTurnCompleteEvent
  | WorkspaceRuntimeChatTurnErrorEvent
  | WorkspaceRuntimeChatToolStartEvent
  | WorkspaceRuntimeChatToolResultEvent
  | WorkspaceRuntimeChatToolErrorEvent;

export interface WorkspaceRuntimeChatEventPayload {
  correlationId: string;
  event: WorkspaceRuntimeChatEvent;
}

export interface WorkspaceRuntimePushPayloadMap {
  threads: WorkspaceRuntimeThreadsPushPayload;
  "thread-detail": WorkspaceRuntimeThreadDetailPushPayload;
  "run-detail": WorkspaceRuntimeRunDetailPushPayload;
  "analysis-mutation": WorkspaceRuntimeAnalysisMutationPayload;
  "analysis-status": WorkspaceRuntimeAnalysisStatusPayload;
  "analysis-progress": WorkspaceRuntimeAnalysisProgressPayload;
  "chat-event": WorkspaceRuntimeChatEventPayload;
}

export interface WorkspaceRuntimeClientHello {
  type: "client_hello";
  connectionId?: string;
  workspaceId: string;
  activeThreadId?: string;
  activeChatCorrelations?: string[];
  lastSeenByChannel?: WorkspaceRuntimeChannelRevisions;
}

export interface WorkspaceRuntimeCreateThreadRequestPayload {
  workspaceId: string;
  title?: string;
}

export interface WorkspaceRuntimeResolveQuestionPayload {
  workspaceId: string;
  threadId: string;
  questionId: string;
  selectedOptions?: number[];
  customText?: string;
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

export interface WorkspaceRuntimeRequestPayloadMap {
  "workspace.thread.create": WorkspaceRuntimeCreateThreadRequestPayload;
  "workspace.thread.rename": WorkspaceRuntimeRenameThreadRequestPayload;
  "workspace.thread.delete": WorkspaceRuntimeDeleteThreadRequestPayload;
  "question.resolve": WorkspaceRuntimeResolveQuestionPayload;
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
  TChannel extends WorkspaceRuntimeChannel = WorkspaceRuntimeChannel,
> = {
  type: "push";
  channel: TChannel;
  revision: number;
  scope: WorkspaceRuntimeScope;
  payload: WorkspaceRuntimePushPayloadMap[TChannel];
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
