import { nanoid } from "nanoid";
import type {
  WorkspaceRuntimeBootstrap,
  WorkspaceRuntimeBootstrapEnvelope,
  WorkspaceRuntimeChannel,
  WorkspaceRuntimeClientHello,
  WorkspaceRuntimePushEnvelope,
  WorkspaceRuntimeRequest,
  WorkspaceRuntimeRequestKind,
  WorkspaceRuntimeServerEnvelope,
  WorkspaceTransportDiagnostic,
} from "../../../shared/types/workspace-runtime";

const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const CHANNELS: WorkspaceRuntimeChannel[] = [
  "threads",
  "thread-detail",
  "run-detail",
];
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_DIAGNOSTICS = 100;

type RuntimeListener = (
  envelope: WorkspaceRuntimeBootstrapEnvelope | WorkspaceRuntimePushEnvelope,
) => void;

interface PendingRequest {
  kind: WorkspaceRuntimeRequestKind;
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

function pushBounded<T>(items: T[], value: T, maxSize: number): void {
  items.push(value);
  if (items.length > maxSize) {
    items.splice(0, items.length - maxSize);
  }
}

function buildWebSocketUrl(pathname: string): string {
  if (typeof window === "undefined") {
    throw new Error(
      "Workspace runtime websocket is only available in the browser.",
    );
  }

  const url = new URL(pathname, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

class WorkspaceRuntimeClient {
  private ws: WebSocket | null = null;
  private desiredContext: {
    workspaceId: string;
    activeThreadId?: string;
  } | null = null;
  private currentConnectionId: string | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private intentionalClose = false;
  private pendingBootstrap: {
    reject: (reason?: unknown) => void;
    resolve: (bootstrap: WorkspaceRuntimeBootstrap) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null = null;
  private listeners = new Set<RuntimeListener>();
  private pendingRequests = new Map<string, PendingRequest>();
  private latestPushByChannel = new Map<
    WorkspaceRuntimePushEnvelope["channel"],
    WorkspaceRuntimePushEnvelope
  >();
  private diagnostics: WorkspaceTransportDiagnostic[] = [];

  private readonly handleOpen = () => {
    this.reconnectAttempt = 0;
    this.recordDiagnostic({
      code: "reconnect-open",
      level: "info",
      message: "Workspace runtime websocket opened",
      connectionId: this.currentConnectionId,
      workspaceId: this.desiredContext?.workspaceId,
      threadId: this.desiredContext?.activeThreadId,
    });
    void this.sendHello();
  };

  private readonly handleMessage = (event: MessageEvent<string>) => {
    let envelope: WorkspaceRuntimeServerEnvelope;

    try {
      envelope = JSON.parse(event.data) as WorkspaceRuntimeServerEnvelope;
    } catch {
      this.recordDiagnostic({
        code: "malformed-frame",
        level: "warn",
        message: "Received malformed workspace runtime frame",
        connectionId: this.currentConnectionId,
        workspaceId: this.desiredContext?.workspaceId,
        threadId: this.desiredContext?.activeThreadId,
      });
      return;
    }

    if (envelope.type === "bootstrap") {
      this.currentConnectionId = envelope.payload.serverConnectionId;
      this.listeners.forEach((listener) => listener(envelope));
      if (this.pendingBootstrap) {
        clearTimeout(this.pendingBootstrap.timeoutId);
        this.pendingBootstrap.resolve(envelope.payload);
        this.pendingBootstrap = null;
      }
      return;
    }

    if (envelope.type === "push") {
      this.latestPushByChannel.set(envelope.channel, envelope);
      this.listeners.forEach((listener) => listener(envelope));
      return;
    }

    const pending = this.pendingRequests.get(envelope.requestId);
    if (!pending) {
      this.recordDiagnostic({
        code: "response-mismatch",
        level: "warn",
        message: "Received unmatched workspace runtime response",
        connectionId: this.currentConnectionId,
        workspaceId: this.desiredContext?.workspaceId,
        threadId: this.desiredContext?.activeThreadId,
        data: {
          requestId: envelope.requestId,
        },
      });
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(envelope.requestId);

    if (envelope.ok) {
      pending.resolve(envelope.result);
    } else {
      pending.reject(
        new Error(envelope.error ?? "Workspace runtime request failed"),
      );
    }
  };

  private readonly handleClose = (event: CloseEvent) => {
    this.recordDiagnostic({
      code: "close",
      level: "info",
      message: "Workspace runtime websocket closed",
      connectionId: this.currentConnectionId,
      workspaceId: this.desiredContext?.workspaceId,
      threadId: this.desiredContext?.activeThreadId,
      data: {
        code: event.code,
        reason: event.reason,
      },
    });

    this.ws = null;

    if (this.intentionalClose || !this.desiredContext) {
      return;
    }

    const backoffMs =
      RECONNECT_BACKOFF_MS[
        Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)
      ] ?? 30_000;
    this.reconnectAttempt += 1;

    this.recordDiagnostic({
      code: "reconnect-scheduled",
      level: "warn",
      message: "Scheduling workspace runtime reconnect",
      connectionId: this.currentConnectionId,
      workspaceId: this.desiredContext.workspaceId,
      threadId: this.desiredContext.activeThreadId,
      data: {
        attempt: this.reconnectAttempt,
        backoffMs,
      },
    });

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureSocket();
    }, backoffMs);
  };

  private readonly handleError = () => {
    this.recordDiagnostic({
      code: "error",
      level: "error",
      message: "Workspace runtime websocket error",
      connectionId: this.currentConnectionId,
      workspaceId: this.desiredContext?.workspaceId,
      threadId: this.desiredContext?.activeThreadId,
    });
  };

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private recordDiagnostic(
    diagnostic: Omit<
      WorkspaceTransportDiagnostic,
      "id" | "source" | "timestamp"
    >,
  ): void {
    pushBounded(
      this.diagnostics,
      {
        id: `diag-${nanoid()}`,
        source: "client",
        timestamp: Date.now(),
        ...diagnostic,
      },
      MAX_DIAGNOSTICS,
    );
  }

  private ensureSocket(): void {
    if (typeof window === "undefined" || !this.desiredContext) {
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.intentionalClose = false;
    const ws = new WebSocket(buildWebSocketUrl("/api/workspace/runtime"));
    this.ws = ws;
    ws.addEventListener("open", this.handleOpen);
    ws.addEventListener("message", this.handleMessage);
    ws.addEventListener("close", this.handleClose);
    ws.addEventListener("error", this.handleError);
  }

  private async sendHello(): Promise<void> {
    if (
      !this.desiredContext ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const hello: WorkspaceRuntimeClientHello = {
      type: "client_hello",
      ...(this.currentConnectionId
        ? { connectionId: this.currentConnectionId }
        : {}),
      workspaceId: this.desiredContext.workspaceId,
      ...(this.desiredContext.activeThreadId
        ? { activeThreadId: this.desiredContext.activeThreadId }
        : {}),
      lastSeenByChannel: Object.fromEntries(
        CHANNELS.map((ch) => [
          ch,
          this.latestPushByChannel.get(ch)?.revision ?? 0,
        ]),
      ) as Record<WorkspaceRuntimeChannel, number>,
    };

    this.ws.send(JSON.stringify(hello));
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async bindContext(context: {
    workspaceId: string;
    activeThreadId?: string;
  }): Promise<WorkspaceRuntimeBootstrap> {
    this.desiredContext = context;
    this.clearReconnectTimer();

    // Reject any prior pending bootstrap to avoid leaked promises.
    if (this.pendingBootstrap) {
      clearTimeout(this.pendingBootstrap.timeoutId);
      this.pendingBootstrap.reject(
        new Error("Superseded by newer bindContext call"),
      );
      this.pendingBootstrap = null;
    }

    const bootstrapPromise = new Promise<WorkspaceRuntimeBootstrap>(
      (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.pendingBootstrap = null;
          this.recordDiagnostic({
            code: "request-timeout",
            level: "error",
            message: "Workspace runtime bootstrap timed out",
            connectionId: this.currentConnectionId,
            workspaceId: this.desiredContext?.workspaceId,
            threadId: this.desiredContext?.activeThreadId,
          });
          reject(new Error("Workspace runtime bootstrap timed out"));
        }, REQUEST_TIMEOUT_MS);
        this.pendingBootstrap = { resolve, reject, timeoutId };
      },
    );

    this.ensureSocket();

    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.sendHello();
    }

    return await bootstrapPromise;
  }

  async sendRequest<T>(
    kind: WorkspaceRuntimeRequestKind,
    payload: WorkspaceRuntimeRequest["payload"],
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Workspace runtime websocket is not connected.");
    }

    const requestId = `req-${nanoid()}`;
    const request: WorkspaceRuntimeRequest = {
      type: "request",
      requestId,
      kind,
      payload,
    };

    this.recordDiagnostic({
      code: "request-received",
      level: "info",
      message: "Sending workspace runtime request",
      connectionId: this.currentConnectionId,
      workspaceId: this.desiredContext?.workspaceId,
      threadId: this.desiredContext?.activeThreadId,
      data: {
        kind,
        requestId,
      },
    });

    return await new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.recordDiagnostic({
          code: "request-timeout",
          level: "error",
          message: "Workspace runtime request timed out",
          connectionId: this.currentConnectionId,
          workspaceId: this.desiredContext?.workspaceId,
          threadId: this.desiredContext?.activeThreadId,
          data: {
            kind,
            requestId,
          },
        });
        reject(new Error(`Workspace runtime request timed out: ${kind}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        kind,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      this.ws?.send(JSON.stringify(request));
    });
  }

  disconnect(): void {
    this.desiredContext = null;
    this.currentConnectionId = undefined;
    this.latestPushByChannel.clear();
    this.clearReconnectTimer();
    if (this.pendingBootstrap) {
      clearTimeout(this.pendingBootstrap.timeoutId);
      this.pendingBootstrap.reject(new Error("Workspace runtime disconnected"));
      this.pendingBootstrap = null;
    }
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Workspace runtime disconnected"));
    }
    this.pendingRequests.clear();

    if (!this.ws) {
      return;
    }

    this.intentionalClose = true;
    this.detachSocketListeners(this.ws);
    this.ws.close();
    this.ws = null;
  }

  private detachSocketListeners(ws: WebSocket): void {
    ws.removeEventListener("open", this.handleOpen);
    ws.removeEventListener("message", this.handleMessage);
    ws.removeEventListener("close", this.handleClose);
    ws.removeEventListener("error", this.handleError);
  }

  getDiagnostics(): WorkspaceTransportDiagnostic[] {
    return [...this.diagnostics];
  }

  resetForTest(): void {
    this.disconnect();
    this.listeners.clear();
    this.diagnostics = [];
    this.reconnectAttempt = 0;
  }
}

export const workspaceRuntimeClient = new WorkspaceRuntimeClient();
