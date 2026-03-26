import { nanoid } from "nanoid";
import { z } from "zod";
import type { Message as WebSocketMessage, Peer as WebSocketPeer } from "crossws";
import type {
  WorkspaceRuntimeBootstrap,
  WorkspaceRuntimeClientEnvelope,
  WorkspaceRuntimeClientHello,
  WorkspaceRuntimeDiagnosticsSnapshot,
  WorkspaceRuntimePushEnvelope,
  WorkspaceRuntimeRequest,
  WorkspaceRuntimeResponse,
  WorkspaceTransportDiagnostic,
} from "../../../shared/types/workspace-runtime";
import { getWorkspaceDatabase } from "./workspace-db";
import { createThreadService } from "./thread-service";
import { buildWorkspaceRuntimeSnapshotCore } from "./workspace-runtime-query";
import {
  getWorkspaceRuntimeChannelRevisions,
  listWorkspaceRuntimeReplayPushes,
  onWorkspaceRuntimePush,
} from "./workspace-runtime-publisher";

const MAX_RECENT_DIAGNOSTICS = 200;
const MAX_CONNECTION_DIAGNOSTICS = 50;

const clientHelloSchema = z.object({
  type: z.literal("client_hello"),
  connectionId: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1),
  activeThreadId: z.string().trim().min(1).optional(),
  lastSeenByChannel: z
    .object({
      threads: z.number().int().nonnegative().optional(),
      "thread-detail": z.number().int().nonnegative().optional(),
      "run-detail": z.number().int().nonnegative().optional(),
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

interface PeerState {
  connectionId: string;
  peer: WebSocketPeer;
  workspaceId?: string;
  activeThreadId?: string;
}

const recentDiagnostics: WorkspaceTransportDiagnostic[] = [];
const diagnosticsByConnectionId = new Map<string, WorkspaceTransportDiagnostic[]>();
const peerStates = new Map<string, PeerState>();

function pushBounded<T>(items: T[], value: T, maxSize: number): void {
  items.push(value);
  if (items.length > maxSize) {
    items.splice(0, items.length - maxSize);
  }
}

function recordDiagnostic(
  diagnostic: Omit<WorkspaceTransportDiagnostic, "id" | "source" | "timestamp"> & {
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
  envelope: WorkspaceRuntimeBootstrap | WorkspaceRuntimePushEnvelope | WorkspaceRuntimeResponse,
): void {
  peer.send(JSON.stringify("type" in envelope && envelope.type === "push"
    ? envelope
    : "serverConnectionId" in envelope
      ? { type: "bootstrap", payload: envelope }
      : envelope));
}

function buildBootstrap(hello: WorkspaceRuntimeClientHello, connectionId: string) {
  const database = getWorkspaceDatabase();
  const snapshot = buildWorkspaceRuntimeSnapshotCore(database, {
    workspaceId: hello.workspaceId,
    activeThreadId: hello.activeThreadId,
  });

  return {
    ...snapshot,
    channelRevisions: getWorkspaceRuntimeChannelRevisions({
      workspaceId: snapshot.workspaceId,
      threadId: snapshot.activeThreadId,
    }),
    serverConnectionId: connectionId,
  } satisfies WorkspaceRuntimeBootstrap;
}

function parseClientEnvelope(message: WebSocketMessage): WorkspaceRuntimeClientEnvelope {
  const rawText = message.text();

  try {
    return JSON.parse(rawText) as WorkspaceRuntimeClientEnvelope;
  } catch {
    throw new Error("Malformed websocket frame");
  }
}

async function handleHello(peerState: PeerState, envelope: WorkspaceRuntimeClientHello) {
  const bootstrap = buildBootstrap(envelope, peerState.connectionId);
  peerState.workspaceId = bootstrap.workspaceId;
  peerState.activeThreadId = bootstrap.activeThreadId;

  recordDiagnostic({
    code: "hello-received",
    level: "info",
    message: "Received websocket client hello",
    connectionId: peerState.connectionId,
    workspaceId: envelope.workspaceId,
    threadId: envelope.activeThreadId,
    data: {
      priorConnectionId: envelope.connectionId,
      lastSeenByChannel: envelope.lastSeenByChannel ?? {},
    },
  });

  sendEnvelope(peerState.peer, bootstrap);
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

  for (const replay of replayPushes) {
    sendEnvelope(peerState.peer, replay);
  }

  if (replayPushes.length > 0) {
    recordDiagnostic({
      code: "replay-sent",
      level: "info",
      message: "Replayed latest workspace runtime pushes after bootstrap",
      connectionId: peerState.connectionId,
      workspaceId: bootstrap.workspaceId,
      threadId: bootstrap.activeThreadId,
      data: {
        channels: replayPushes.map((push) => push.channel),
      },
    });
  }
}

async function handleRequest(
  peerState: PeerState,
  envelope: WorkspaceRuntimeRequest,
) {
  if (envelope.kind !== "workspace.thread.create") {
    const unsupportedResponse: WorkspaceRuntimeResponse = {
      type: "response",
      requestId: envelope.requestId,
      ok: false,
      error: `Unsupported request kind: ${envelope.kind}`,
    };
    sendEnvelope(peerState.peer, unsupportedResponse);
    return;
  }

  const parsed = createThreadRequestSchema.safeParse(envelope);
  if (!parsed.success) {
    const invalidResponse: WorkspaceRuntimeResponse = {
      type: "response",
      requestId: envelope.requestId,
      ok: false,
      error: "Invalid workspace.thread.create payload",
    };
    sendEnvelope(peerState.peer, invalidResponse);
    recordDiagnostic({
      code: "request-failed",
      level: "warn",
      message: "Rejected invalid websocket request payload",
      connectionId: peerState.connectionId,
      workspaceId: peerState.workspaceId,
      threadId: peerState.activeThreadId,
      data: {
        kind: envelope.kind,
      },
    });
    return;
  }

  recordDiagnostic({
    code: "request-received",
    level: "info",
    message: "Received websocket runtime request",
    connectionId: peerState.connectionId,
    workspaceId: parsed.data.payload.workspaceId,
    threadId: peerState.activeThreadId,
    data: {
      kind: parsed.data.kind,
      requestId: parsed.data.requestId,
    },
  });

  try {
    const thread = createThreadService(getWorkspaceDatabase()).createThread({
      workspaceId: parsed.data.payload.workspaceId,
      title: parsed.data.payload.title,
      producer: "workspace-runtime-transport",
    });

    const response: WorkspaceRuntimeResponse<{
      workspaceId: string;
      thread: typeof thread;
    }> = {
      type: "response",
      requestId: parsed.data.requestId,
      ok: true,
      result: {
        workspaceId: thread.workspaceId,
        thread,
      },
    };
    sendEnvelope(peerState.peer, response);
    recordDiagnostic({
      code: "request-completed",
      level: "info",
      message: "Completed websocket runtime request",
      connectionId: peerState.connectionId,
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create thread";
    const response: WorkspaceRuntimeResponse = {
      type: "response",
      requestId: parsed.data.requestId,
      ok: false,
      error: message,
    };
    sendEnvelope(peerState.peer, response);
    recordDiagnostic({
      code: "request-failed",
      level: "error",
      message: "Websocket runtime request failed",
      connectionId: peerState.connectionId,
      workspaceId: parsed.data.payload.workspaceId,
      threadId: peerState.activeThreadId,
      data: {
        kind: parsed.data.kind,
        requestId: parsed.data.requestId,
        error: message,
      },
    });
  }
}

export function openWorkspaceRuntimeConnection(peer: WebSocketPeer): void {
  const peerState: PeerState = {
    connectionId: peer.id,
    peer,
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
