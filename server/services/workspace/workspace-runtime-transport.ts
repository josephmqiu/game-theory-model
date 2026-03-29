import { nanoid } from "nanoid";
import { z } from "zod";
import type {
  Message as WebSocketMessage,
  Peer as WebSocketPeer,
} from "crossws";
import type {
  WorkspaceRuntimeBootstrap,
  WorkspaceRuntimeClientEnvelope,
  WorkspaceRuntimeClientHello,
  WorkspaceRuntimeDiagnosticsSnapshot,
  WorkspaceRuntimeRequest,
  WorkspaceRuntimeResponse,
  WorkspaceRuntimeServerEnvelope,
  WorkspaceTransportDiagnostic,
} from "../../../shared/types/workspace-runtime";
import type { AnalysisStateResponse } from "../../../shared/types/api";
import { getWorkspaceDatabase } from "./workspace-db";
import { createThreadService } from "./thread-service";
import * as questionService from "./question-service";
import { startChatTurn } from "../ai/chat-service";
import { buildWorkspaceRuntimeSnapshotCore } from "./workspace-runtime-query";
import {
  _resetWorkspaceRecoveryDiagnosticsForTest,
  listWorkspaceRecoveryDiagnostics,
} from "./runtime-recovery-diagnostics";
import {
  _resetRuntimeRecoveryForTest,
  waitForRuntimeRecovery,
} from "./runtime-recovery-service";
import {
  getWorkspaceRuntimeChannelRevisions,
  listWorkspaceRuntimeReplayPushes,
  onWorkspaceRuntimePush,
} from "./workspace-runtime-publisher";
import {
  getAnalysisBroadcastChannelRevisions,
  listAnalysisBroadcastReplayPushes,
  onAnalysisBroadcast,
} from "./analysis-event-bridge";
import {
  _resetWorkspaceRuntimeChatPublisherForTest,
  listWorkspaceRuntimeChatReplayPushes,
  onWorkspaceRuntimeChatPush,
  publishWorkspaceRuntimeChatEvent,
} from "./workspace-runtime-chat-publisher";
import * as entityGraphService from "../entity-graph-service";
import * as runtimeStatus from "../runtime-status";

const MAX_RECENT_DIAGNOSTICS = 200;
const MAX_CONNECTION_DIAGNOSTICS = 50;

const clientHelloSchema = z.object({
  type: z.literal("client_hello"),
  connectionId: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1),
  activeThreadId: z.string().trim().min(1).optional(),
  activeChatCorrelations: z.array(z.string().trim().min(1)).optional(),
  lastSeenByChannel: z
    .object({
      threads: z.number().int().nonnegative().optional(),
      "thread-detail": z.number().int().nonnegative().optional(),
      "run-detail": z.number().int().nonnegative().optional(),
      "analysis-mutation": z.number().int().nonnegative().optional(),
      "analysis-status": z.number().int().nonnegative().optional(),
      "analysis-progress": z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const createThreadRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("workspace.thread.create"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
    title: z.string().trim().optional(),
  }),
});

const resolveQuestionRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("question.resolve"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
    threadId: z.string().trim().min(1),
    questionId: z.string().trim().min(1),
    selectedOptions: z.array(z.number().int().nonnegative()).optional(),
    customText: z.string().optional(),
  }),
});

const renameThreadRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("workspace.thread.rename"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
    threadId: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }),
});

const deleteThreadRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("workspace.thread.delete"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
    threadId: z.string().trim().min(1),
  }),
});

const chatTurnStartRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("chat.turn.start"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
    threadId: z.string().trim().min(1).optional(),
    threadTitle: z.string().trim().min(1).optional(),
    correlationId: z.string().trim().min(1),
    message: z.object({
      content: z.string(),
      attachments: z
        .array(
          z.object({
            name: z.string(),
            mediaType: z.string(),
            data: z.string(),
          }),
        )
        .optional(),
    }),
    provider: z.enum(["claude", "codex"]),
    model: z.string().trim().min(1),
    thinkingMode: z.enum(["adaptive", "disabled", "enabled"]).optional(),
    thinkingBudgetTokens: z.number().positive().optional(),
    effort: z.enum(["low", "medium", "high", "max"]).optional(),
  }),
});

const analysisStateGetRequestSchema = z.object({
  type: z.literal("request"),
  requestId: z.string().trim().min(1),
  kind: z.literal("analysis.state.get"),
  payload: z.object({
    workspaceId: z.string().trim().min(1),
  }),
});

interface PeerState {
  connectionId: string;
  peer: WebSocketPeer;
  workspaceId?: string;
  activeThreadId?: string;
  activeChatCorrelations: Set<string>;
}

const recentDiagnostics: WorkspaceTransportDiagnostic[] = [];
const diagnosticsByConnectionId = new Map<
  string,
  WorkspaceTransportDiagnostic[]
>();
const peerStates = new Map<string, PeerState>();

function pushBounded<T>(items: T[], value: T, maxSize: number): void {
  items.push(value);
  if (items.length > maxSize) {
    items.splice(0, items.length - maxSize);
  }
}

function recordDiagnostic(
  diagnostic: Omit<
    WorkspaceTransportDiagnostic,
    "id" | "source" | "timestamp"
  > & {
    source?: WorkspaceTransportDiagnostic["source"];
    timestamp?: number;
  },
): void {
  const next: WorkspaceTransportDiagnostic = {
    id: `diag-${nanoid()}`,
    source: diagnostic.source ?? "server",
    timestamp: diagnostic.timestamp ?? Date.now(),
    ...diagnostic,
  };

  pushBounded(recentDiagnostics, next, MAX_RECENT_DIAGNOSTICS);

  if (next.connectionId) {
    const connectionDiagnostics =
      diagnosticsByConnectionId.get(next.connectionId) ?? [];
    pushBounded(connectionDiagnostics, next, MAX_CONNECTION_DIAGNOSTICS);
    diagnosticsByConnectionId.set(next.connectionId, connectionDiagnostics);
  }
}

function sendEnvelope(
  peer: WebSocketPeer,
  envelope: WorkspaceRuntimeServerEnvelope,
): void {
  peer.send(JSON.stringify(envelope));
}

function buildBootstrap(
  hello: WorkspaceRuntimeClientHello,
  connectionId: string,
) {
  const database = getWorkspaceDatabase();
  const snapshot = buildWorkspaceRuntimeSnapshotCore(database, {
    workspaceId: hello.workspaceId,
    activeThreadId: hello.activeThreadId,
  });

  return {
    ...snapshot,
    channelRevisions: {
      ...getWorkspaceRuntimeChannelRevisions({
        workspaceId: snapshot.workspaceId,
        threadId: snapshot.activeThreadId,
      }),
      ...getAnalysisBroadcastChannelRevisions(),
    },
    serverConnectionId: connectionId,
  } satisfies WorkspaceRuntimeBootstrap;
}

function parseClientEnvelope(
  message: WebSocketMessage,
): WorkspaceRuntimeClientEnvelope {
  const rawText = message.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Malformed websocket frame");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("type" in parsed) ||
    typeof (parsed as Record<string, unknown>).type !== "string"
  ) {
    throw new Error("Malformed websocket frame: missing type");
  }

  return parsed as WorkspaceRuntimeClientEnvelope;
}

async function handleHello(
  peerState: PeerState,
  envelope: WorkspaceRuntimeClientHello,
) {
  await waitForRuntimeRecovery();
  let bootstrap;
  try {
    bootstrap = buildBootstrap(envelope, peerState.connectionId);
  } catch (error) {
    recordDiagnostic({
      code: "error",
      level: "error",
      message: "Failed to build bootstrap",
      connectionId: peerState.connectionId,
      workspaceId: envelope.workspaceId,
      threadId: envelope.activeThreadId,
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    peerState.peer.close(1011, "Bootstrap failed");
    return;
  }

  peerState.workspaceId = bootstrap.workspaceId;
  peerState.activeThreadId = bootstrap.activeThreadId;
  peerState.activeChatCorrelations = new Set(
    envelope.activeChatCorrelations ?? [],
  );

  recordDiagnostic({
    code: "hello-received",
    level: "info",
    message: "Received websocket client hello",
    connectionId: peerState.connectionId,
    workspaceId: envelope.workspaceId,
    threadId: envelope.activeThreadId,
    data: {
      priorConnectionId: envelope.connectionId,
      activeChatCorrelationCount: peerState.activeChatCorrelations.size,
      lastSeenByChannel: envelope.lastSeenByChannel ?? {},
    },
  });

  sendEnvelope(peerState.peer, { type: "bootstrap", payload: bootstrap });
  recordDiagnostic({
    code: "bootstrap-sent",
    level: "info",
    message: "Sent workspace runtime bootstrap",
    connectionId: peerState.connectionId,
    workspaceId: bootstrap.workspaceId,
    threadId: bootstrap.activeThreadId,
    data: {
      threadCount: bootstrap.threads.length,
      hasActiveThread: Boolean(bootstrap.activeThreadId),
      hasLatestRun: Boolean(bootstrap.latestRun),
    },
  });

  const replayPushes = listWorkspaceRuntimeReplayPushes({
    workspaceId: bootstrap.workspaceId,
    threadId: bootstrap.activeThreadId,
    lastSeenByChannel: envelope.lastSeenByChannel,
  });
  const replayAnalysisPushes = listAnalysisBroadcastReplayPushes({
    workspaceId: bootstrap.workspaceId,
    lastSeenByChannel: envelope.lastSeenByChannel,
  });
  const replayChatPushes = listWorkspaceRuntimeChatReplayPushes({
    workspaceId: bootstrap.workspaceId,
    activeChatCorrelations: [...peerState.activeChatCorrelations],
  });

  for (const replay of replayPushes) {
    sendEnvelope(peerState.peer, replay);
  }

  for (const replay of replayAnalysisPushes) {
    sendEnvelope(peerState.peer, replay);
  }

  for (const replay of replayChatPushes) {
    sendEnvelope(peerState.peer, replay);

    if (
      replay.payload.event.type === "chat.message.complete" ||
      replay.payload.event.type === "chat.message.error"
    ) {
      peerState.activeChatCorrelations.delete(replay.payload.correlationId);
    }
  }

  if (
    replayPushes.length + replayAnalysisPushes.length + replayChatPushes.length >
    0
  ) {
    recordDiagnostic({
      code: "replay-sent",
      level: "info",
      message: "Replayed latest workspace runtime pushes after bootstrap",
      connectionId: peerState.connectionId,
      workspaceId: bootstrap.workspaceId,
      threadId: bootstrap.activeThreadId,
      data: {
        channels: [
          ...replayPushes,
          ...replayAnalysisPushes,
          ...replayChatPushes,
        ].map((push) => push.channel),
      },
    });
  }
}

async function handleResolveQuestion(
  peerState: PeerState,
  envelope: WorkspaceRuntimeRequest,
) {
  const parsed = resolveQuestionRequestSchema.safeParse(envelope);
  if (!parsed.success) {
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: envelope.requestId,
      ok: false,
      error: "Invalid question.resolve payload",
    });
    return;
  }

  recordDiagnostic({
    code: "request-received",
    level: "info",
    message: "Received question.resolve request",
    connectionId: peerState.connectionId,
    workspaceId: parsed.data.payload.workspaceId,
    threadId: parsed.data.payload.threadId,
    data: {
      kind: parsed.data.kind,
      requestId: parsed.data.requestId,
      questionId: parsed.data.payload.questionId,
    },
  });

  try {
    questionService.resolveQuestion({
      questionId: parsed.data.payload.questionId,
      selectedOptions: parsed.data.payload.selectedOptions,
      customText: parsed.data.payload.customText,
    });

    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: parsed.data.requestId,
      ok: true,
      result: { questionId: parsed.data.payload.questionId },
    });
    recordDiagnostic({
      code: "request-completed",
      level: "info",
      message: "Completed question.resolve request",
      connectionId: peerState.connectionId,
      workspaceId: parsed.data.payload.workspaceId,
      threadId: parsed.data.payload.threadId,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve question";
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: parsed.data.requestId,
      ok: false,
      error: message,
    });
    recordDiagnostic({
      code: "request-failed",
      level: "error",
      message: "question.resolve request failed",
      connectionId: peerState.connectionId,
      workspaceId: parsed.data.payload.workspaceId,
      threadId: parsed.data.payload.threadId,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
        error: message,
      },
    });
  }
}

async function handleChatTurnStart(
  peerState: PeerState,
  envelope: WorkspaceRuntimeRequest,
) {
  const parsed = chatTurnStartRequestSchema.safeParse(envelope);
  if (!parsed.success) {
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: envelope.requestId,
      ok: false,
      error: "Invalid chat.turn.start payload",
    });
    return;
  }

  recordDiagnostic({
    code: "request-received",
    level: "info",
    message: "Received chat.turn.start request",
    connectionId: peerState.connectionId,
    workspaceId: parsed.data.payload.workspaceId,
    threadId: parsed.data.payload.threadId ?? peerState.activeThreadId,
    data: {
      kind: parsed.data.kind,
      requestId: parsed.data.requestId,
      correlationId: parsed.data.payload.correlationId,
      provider: parsed.data.payload.provider,
      model: parsed.data.payload.model,
    },
  });

  console.log("[ws-transport] chat.turn.start received", {
    provider: parsed.data.payload.provider,
    model: parsed.data.payload.model,
    correlationId: parsed.data.payload.correlationId,
  });

  try {
    console.log("[ws-transport] calling startChatTurn...");
    const started = await startChatTurn(parsed.data.payload, {
      correlationId: parsed.data.payload.correlationId,
      producer: "workspace-runtime-transport",
      onEvent: (chatEvent, context) => {
        publishWorkspaceRuntimeChatEvent({
          workspaceId: context.workspaceId,
          threadId: context.threadId,
          correlationId: context.correlationId,
          event: chatEvent,
        });
      },
    });

    console.log("[ws-transport] startChatTurn resolved, sending response");
    peerState.activeChatCorrelations.add(started.correlationId);

    started.completion.finally(() => {
      peerState.activeChatCorrelations.delete(started.correlationId);
    });

    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: parsed.data.requestId,
      ok: true,
      result: {
        workspaceId: started.workspaceId,
        threadId: started.threadId,
        correlationId: started.correlationId,
      },
    });
    recordDiagnostic({
      code: "request-completed",
      level: "info",
      message: "Accepted chat.turn.start request",
      connectionId: peerState.connectionId,
      workspaceId: started.workspaceId,
      threadId: started.threadId,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
        correlationId: started.correlationId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start chat turn";
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: parsed.data.requestId,
      ok: false,
      error: message,
    });
    recordDiagnostic({
      code: "request-failed",
      level: "error",
      message: "chat.turn.start request failed",
      connectionId: peerState.connectionId,
      workspaceId: parsed.data.payload.workspaceId,
      threadId: parsed.data.payload.threadId ?? peerState.activeThreadId,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
        correlationId: parsed.data.payload.correlationId,
        error: message,
      },
    });
  }
}

async function handleSyncRequest(
  peerState: PeerState,
  envelope: WorkspaceRuntimeRequest,
  schema: z.ZodType,
  execute: (parsed: {
    requestId: string;
    kind: string;
    payload: Record<string, unknown>;
  }) => unknown | Promise<unknown>,
) {
  const parsed = schema.safeParse(envelope);
  if (!parsed.success) {
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: envelope.requestId,
      ok: false,
      error: `Invalid ${envelope.kind} payload`,
    } satisfies WorkspaceRuntimeResponse);
    recordDiagnostic({
      code: "request-failed",
      level: "warn",
      message: "Rejected invalid websocket request payload",
      connectionId: peerState.connectionId,
      workspaceId: peerState.workspaceId,
      threadId: peerState.activeThreadId,
      data: { kind: envelope.kind },
    });
    return;
  }

  const data = parsed.data as {
    requestId: string;
    kind: string;
    payload: Record<string, unknown>;
  };
  recordDiagnostic({
    code: "request-received",
    level: "info",
    message: "Received websocket runtime request",
    connectionId: peerState.connectionId,
    workspaceId: (data.payload.workspaceId as string) ?? peerState.workspaceId,
    threadId: peerState.activeThreadId,
    data: { kind: data.kind, requestId: data.requestId },
  });

  try {
    const result = await execute(data);
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: data.requestId,
      ok: true,
      result,
    } satisfies WorkspaceRuntimeResponse);
    recordDiagnostic({
      code: "request-completed",
      level: "info",
      message: "Completed websocket runtime request",
      connectionId: peerState.connectionId,
      workspaceId:
        (data.payload.workspaceId as string) ?? peerState.workspaceId,
      threadId: peerState.activeThreadId,
      data: { kind: data.kind, requestId: data.requestId },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Failed to handle ${data.kind}`;
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: data.requestId,
      ok: false,
      error: message,
    } satisfies WorkspaceRuntimeResponse);
    recordDiagnostic({
      code: "request-failed",
      level: "error",
      message: "Websocket runtime request failed",
      connectionId: peerState.connectionId,
      workspaceId:
        (data.payload.workspaceId as string) ?? peerState.workspaceId,
      threadId: peerState.activeThreadId,
      data: { kind: data.kind, requestId: data.requestId, error: message },
    });
  }
}

async function handleRequest(
  peerState: PeerState,
  envelope: WorkspaceRuntimeRequest,
) {
  if (envelope.kind === "analysis.state.get") {
    await handleSyncRequest(
      peerState,
      envelope,
      analysisStateGetRequestSchema,
      async () => {
        await waitForRuntimeRecovery();
        return {
          analysis: entityGraphService.getAnalysis(),
          runStatus: runtimeStatus.getSnapshot(),
          revision: runtimeStatus.getRevision(),
        } satisfies AnalysisStateResponse;
      },
    );
    return;
  }

  if (envelope.kind === "question.resolve") {
    await handleResolveQuestion(peerState, envelope);
    return;
  }

  if (envelope.kind === "chat.turn.start") {
    await handleChatTurnStart(peerState, envelope);
    return;
  }

  const service = createThreadService(getWorkspaceDatabase());

  switch (envelope.kind) {
    case "workspace.thread.create":
      await handleSyncRequest(
        peerState,
        envelope,
        createThreadRequestSchema,
        (data) => {
          const payload = data.payload as {
            workspaceId: string;
            title?: string;
          };
          const thread = service.createThread({
            workspaceId: payload.workspaceId,
            title: payload.title,
            producer: "workspace-runtime-transport",
          });
          return { workspaceId: thread.workspaceId, thread };
        },
      );
      return;

    case "workspace.thread.rename":
      await handleSyncRequest(
        peerState,
        envelope,
        renameThreadRequestSchema,
        (data) => {
          const payload = data.payload as {
            workspaceId: string;
            threadId: string;
            title: string;
          };
          const thread = service.renameThread({
            workspaceId: payload.workspaceId,
            threadId: payload.threadId,
            title: payload.title,
            producer: "workspace-runtime-transport",
          });
          return { workspaceId: thread.workspaceId, thread };
        },
      );
      return;

    case "workspace.thread.delete":
      await handleSyncRequest(
        peerState,
        envelope,
        deleteThreadRequestSchema,
        (data) => {
          const payload = data.payload as {
            workspaceId: string;
            threadId: string;
          };
          service.deleteThread({
            workspaceId: payload.workspaceId,
            threadId: payload.threadId,
            producer: "workspace-runtime-transport",
          });
          return { workspaceId: payload.workspaceId };
        },
      );
      return;

    default: {
      sendEnvelope(peerState.peer, {
        type: "response",
        requestId: envelope.requestId,
        ok: false,
        error: `Unsupported request kind: ${envelope.kind}`,
      } satisfies WorkspaceRuntimeResponse);
    }
  }
}

export function openWorkspaceRuntimeConnection(peer: WebSocketPeer): void {
  const peerState: PeerState = {
    connectionId: peer.id,
    peer,
    activeChatCorrelations: new Set(),
  };
  peerStates.set(peer.id, peerState);

  recordDiagnostic({
    code: "connect",
    level: "info",
    message: "Opened workspace runtime websocket connection",
    connectionId: peer.id,
    data: {
      remoteAddress: peer.remoteAddress,
    },
  });
}

export async function handleWorkspaceRuntimeMessage(
  peer: WebSocketPeer,
  message: WebSocketMessage,
): Promise<void> {
  const peerState = peerStates.get(peer.id);
  if (!peerState) {
    return;
  }

  let envelope: WorkspaceRuntimeClientEnvelope;
  try {
    envelope = parseClientEnvelope(message);
  } catch (error) {
    recordDiagnostic({
      code: "malformed-frame",
      level: "warn",
      message: "Received malformed websocket frame",
      connectionId: peerState.connectionId,
      workspaceId: peerState.workspaceId,
      threadId: peerState.activeThreadId,
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return;
  }

  if (envelope.type === "client_hello") {
    await handleHello(peerState, clientHelloSchema.parse(envelope));
    return;
  }

  if (!peerState.workspaceId) {
    sendEnvelope(peerState.peer, {
      type: "response",
      requestId: "requestId" in envelope ? envelope.requestId : "unknown",
      ok: false,
      error: "Send client_hello before requests",
    });
    return;
  }

  await handleRequest(peerState, envelope);
}

export function closeWorkspaceRuntimeConnection(
  peer: WebSocketPeer,
  details?: { code?: number; reason?: string },
): void {
  const peerState = peerStates.get(peer.id);
  if (!peerState) {
    return;
  }

  recordDiagnostic({
    code: "close",
    level: "info",
    message: "Closed workspace runtime websocket connection",
    connectionId: peerState.connectionId,
    workspaceId: peerState.workspaceId,
    threadId: peerState.activeThreadId,
    data: {
      code: details?.code,
      reason: details?.reason,
    },
  });

  diagnosticsByConnectionId.delete(peerState.connectionId);
  peerState.activeChatCorrelations.clear();
  peerStates.delete(peer.id);
}

export function recordWorkspaceRuntimeError(
  peer: WebSocketPeer,
  error: unknown,
): void {
  const peerState = peerStates.get(peer.id);
  recordDiagnostic({
    code: "error",
    level: "error",
    message: "Workspace runtime websocket connection error",
    connectionId: peerState?.connectionId ?? peer.id,
    workspaceId: peerState?.workspaceId,
    threadId: peerState?.activeThreadId,
    data: {
      error: error instanceof Error ? error.message : String(error),
    },
  });
}

export function getWorkspaceRuntimeDiagnosticsSnapshot(
  connectionId?: string,
): WorkspaceRuntimeDiagnosticsSnapshot {
  return {
    recent: [...recentDiagnostics],
    recoveryRecent: listWorkspaceRecoveryDiagnostics(),
    ...(connectionId
      ? {
          byConnectionId: [
            ...(diagnosticsByConnectionId.get(connectionId) ?? []),
          ],
        }
      : {}),
  };
}

export function _resetWorkspaceRuntimeTransportForTest(): void {
  recentDiagnostics.splice(0, recentDiagnostics.length);
  diagnosticsByConnectionId.clear();
  peerStates.clear();
  _resetWorkspaceRuntimeChatPublisherForTest();
  _resetWorkspaceRecoveryDiagnosticsForTest();
  _resetRuntimeRecoveryForTest();
}

onWorkspaceRuntimePush((push) => {
  let delivered = 0;

  for (const peerState of peerStates.values()) {
    if (peerState.workspaceId !== push.scope.workspaceId) {
      continue;
    }

    if (
      push.channel !== "threads" &&
      peerState.activeThreadId !== push.scope.threadId
    ) {
      continue;
    }

    sendEnvelope(peerState.peer, push);
    delivered += 1;
    recordDiagnostic({
      code: "push-sent",
      level: "info",
      message: "Sent workspace runtime push",
      connectionId: peerState.connectionId,
      workspaceId: push.scope.workspaceId,
      threadId: push.scope.threadId,
      data: {
        channel: push.channel,
        revision: push.revision,
      },
    });
  }

  if (delivered === 0) {
    recordDiagnostic({
      code: "push-dropped",
      level: "warn",
      message: "No active workspace runtime subscribers matched push scope",
      workspaceId: push.scope.workspaceId,
      threadId: push.scope.threadId,
      data: {
        channel: push.channel,
        revision: push.revision,
      },
    });
  }
});

onWorkspaceRuntimeChatPush((push) => {
  let delivered = 0;

  for (const peerState of peerStates.values()) {
    if (peerState.workspaceId !== push.scope.workspaceId) {
      continue;
    }

    if (!peerState.activeChatCorrelations.has(push.payload.correlationId)) {
      continue;
    }

    sendEnvelope(peerState.peer, push);
    delivered += 1;
    recordDiagnostic({
      code: "push-sent",
      level: "info",
      message: "Sent workspace runtime chat push",
      connectionId: peerState.connectionId,
      workspaceId: push.scope.workspaceId,
      threadId: push.scope.threadId,
      data: {
        channel: push.channel,
        revision: push.revision,
        correlationId: push.payload.correlationId,
      },
    });

    if (
      push.payload.event.type === "chat.message.complete" ||
      push.payload.event.type === "chat.message.error"
    ) {
      peerState.activeChatCorrelations.delete(push.payload.correlationId);
    }
  }

  if (delivered === 0) {
    recordDiagnostic({
      code: "push-dropped",
      level: "warn",
      message: "No active chat correlation matched runtime chat push",
      workspaceId: push.scope.workspaceId,
      threadId: push.scope.threadId,
      data: {
        channel: push.channel,
        revision: push.revision,
        correlationId: push.payload.correlationId,
      },
    });
  }
});

// Analysis events are broadcast to ALL connected peers (no workspace/thread
// scoping — matches the former SSE endpoint's broadcast semantics).
onAnalysisBroadcast((broadcast) => {
  for (const peerState of peerStates.values()) {
    if (!peerState.workspaceId) {
      continue;
    }

    sendEnvelope(peerState.peer, {
      type: "push",
      channel: broadcast.channel,
      revision: broadcast.revision,
      scope: { workspaceId: peerState.workspaceId },
      payload: broadcast.payload,
    });
    recordDiagnostic({
      code: "push-sent",
      level: "info",
      message: `Sent analysis broadcast: ${broadcast.channel}`,
      connectionId: peerState.connectionId,
      workspaceId: peerState.workspaceId,
      data: {
        channel: broadcast.channel,
        revision: broadcast.revision,
      },
    });
  }
});
