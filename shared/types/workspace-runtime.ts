import type {
  ActivityEntry,
  PhaseTurnSummaryState,
  RunState,
  ThreadMessageState,
  ThreadState,
} from "./workspace-state";

export type WorkspaceRuntimeChannel =
  | "threads"
  | "thread-detail"
  | "run-detail";

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

export interface WorkspaceRuntimePushPayloadMap {
  threads: WorkspaceRuntimeThreadsPushPayload;
  "thread-detail": WorkspaceRuntimeThreadDetailPushPayload;
  "run-detail": WorkspaceRuntimeRunDetailPushPayload;
}

export interface WorkspaceRuntimeClientHello {
  type: "client_hello";
  connectionId?: string;
  workspaceId: string;
  activeThreadId?: string;
  lastSeenByChannel?: WorkspaceRuntimeChannelRevisions;
}

export interface WorkspaceRuntimeCreateThreadRequestPayload {
  workspaceId: string;
  title?: string;
}

export interface WorkspaceRuntimeRequestPayloadMap {
  "workspace.thread.create": WorkspaceRuntimeCreateThreadRequestPayload;
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
  | "response-mismatch"
  | "malformed-frame"
  | "push-sent"
  | "push-dropped"
  | "replay-sent"
  | "reconnect-scheduled"
  | "reconnect-open"
  | "close";

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

export interface WorkspaceRuntimeDiagnosticsSnapshot {
  recent: WorkspaceTransportDiagnostic[];
  byConnectionId?: WorkspaceTransportDiagnostic[];
}

