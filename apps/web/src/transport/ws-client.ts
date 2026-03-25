// transport/ws-client.ts
// WebSocket transport client for the T3 server.
// Replaces the legacy SSE-based EventStreamManager in services/ai/analysis-client.ts.
//
// This module manages the WebSocket connection lifecycle (connect, reconnect, auth),
// dispatches push events to registered channel listeners, and provides an RPC
// request/response mechanism for sending commands to the server.

import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";

// ── Analysis push channel names ──────────────────────────────────────
// These must match the channels the server's AnalysisReactor publishes on.

export const ANALYSIS_CHANNELS = {
  entityCreated: "analysis.entityCreated",
  entityUpdated: "analysis.entityUpdated",
  entityDeleted: "analysis.entityDeleted",
  relationshipCreated: "analysis.relationshipCreated",
  relationshipDeleted: "analysis.relationshipDeleted",
  phaseCompleted: "analysis.phaseCompleted",
  started: "analysis.started",
  completed: "analysis.completed",
  aborted: "analysis.aborted",
  rolledBack: "analysis.rolledBack",
} as const;

export type AnalysisChannel =
  (typeof ANALYSIS_CHANNELS)[keyof typeof ANALYSIS_CHANNELS];

// ── Push event payload types ─────────────────────────────────────────

export interface AnalysisEntityCreatedPayload {
  entity: AnalysisEntity;
}

export interface AnalysisEntityUpdatedPayload {
  entity: AnalysisEntity;
}

export interface AnalysisEntityDeletedPayload {
  entityId: string;
}

export interface AnalysisRelationshipCreatedPayload {
  relationship: AnalysisRelationship;
}

export interface AnalysisRelationshipDeletedPayload {
  relationshipId: string;
}

export interface AnalysisPhaseCompletedPayload {
  phase: MethodologyPhase;
  runId: string;
  summary?: {
    entitiesCreated: number;
    relationshipsCreated: number;
    entitiesUpdated: number;
    durationMs: number;
  };
}

export interface AnalysisStartedPayload {
  runId: string;
  topic: string;
}

export interface AnalysisCompletedPayload {
  runId: string;
}

export interface AnalysisAbortedPayload {
  runId: string;
  reason?: string;
}

export interface AnalysisRolledBackPayload {
  runId: string;
  entityIds: string[];
  relationshipIds: string[];
}

// ── Payload map ──────────────────────────────────────────────────────

export interface AnalysisPushPayloadMap {
  [ANALYSIS_CHANNELS.entityCreated]: AnalysisEntityCreatedPayload;
  [ANALYSIS_CHANNELS.entityUpdated]: AnalysisEntityUpdatedPayload;
  [ANALYSIS_CHANNELS.entityDeleted]: AnalysisEntityDeletedPayload;
  [ANALYSIS_CHANNELS.relationshipCreated]: AnalysisRelationshipCreatedPayload;
  [ANALYSIS_CHANNELS.relationshipDeleted]: AnalysisRelationshipDeletedPayload;
  [ANALYSIS_CHANNELS.phaseCompleted]: AnalysisPhaseCompletedPayload;
  [ANALYSIS_CHANNELS.started]: AnalysisStartedPayload;
  [ANALYSIS_CHANNELS.completed]: AnalysisCompletedPayload;
  [ANALYSIS_CHANNELS.aborted]: AnalysisAbortedPayload;
  [ANALYSIS_CHANNELS.rolledBack]: AnalysisRolledBackPayload;
}

// ── Push envelope (matches server WsPush shape) ──────────────────────

export interface WsPushEnvelope {
  type: "push";
  sequence: number;
  channel: string;
  data: unknown;
}

// ── Listener types ───────────────────────────────────────────────────

type PushListener<T = unknown> = (data: T, sequence: number) => void;

interface ListenerEntry {
  channel: string;
  callback: PushListener;
}

// ── Connection state ─────────────────────────────────────────────────

export type WsConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

type ConnectionStateListener = (state: WsConnectionState) => void;

// ── RPC types ────────────────────────────────────────────────────────

export interface WsRpcResponse {
  id: string;
  result?: unknown;
  error?: { message: string };
}

interface PendingRpc {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const RPC_TIMEOUT_MS = 30_000;
let rpcCounter = 0;

function nextRpcId(): string {
  rpcCounter += 1;
  return `rpc-${rpcCounter}-${Date.now()}`;
}

// ── Reconnection config ──────────────────────────────────────────────

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
const MAX_RECONNECT_ATTEMPTS = 10;

// ── WebSocket transport singleton ────────────────────────────────────

class WsTransport {
  private ws: WebSocket | null = null;
  private listeners: ListenerEntry[] = [];
  private connectionStateListeners: ConnectionStateListener[] = [];
  private pendingRpcs = new Map<string, PendingRpc>();
  private _connectionState: WsConnectionState = "DISCONNECTED";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private url: string | null = null;

  // ── Connection state ─────────────────────────────────────────────

  get connectionState(): WsConnectionState {
    return this._connectionState;
  }

  private setConnectionState(state: WsConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    for (const listener of this.connectionStateListeners) {
      try {
        listener(state);
      } catch {
        // swallow listener errors
      }
    }
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.push(listener);
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  // ── Connect / disconnect ─────────────────────────────────────────

  connect(url: string): void {
    if (this.disposed) return;
    this.url = url;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  disconnect(): void {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState("DISCONNECTED");
  }

  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this.listeners = [];
    this.connectionStateListeners = [];
    // Reject all pending RPCs
    for (const [_id, pending] of this.pendingRpcs) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Transport disposed"));
    }
    this.pendingRpcs.clear();
  }

  // ── Subscribe to push channels ───────────────────────────────────

  /**
   * Subscribe to a specific push channel. Returns an unsubscribe function.
   */
  on<C extends keyof AnalysisPushPayloadMap>(
    channel: C,
    callback: PushListener<AnalysisPushPayloadMap[C]>,
  ): () => void {
    const entry: ListenerEntry = {
      channel,
      callback: callback as PushListener,
    };
    this.listeners.push(entry);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
    };
  }

  /**
   * Subscribe to any push channel by string name.
   */
  onAny(channel: string, callback: PushListener): () => void {
    const entry: ListenerEntry = { channel, callback };
    this.listeners.push(entry);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
    };
  }

  // ── RPC request/response ───────────────────────────────────────

  /**
   * Send an RPC request over WebSocket and wait for the server response.
   * The protocol uses `{ id, body: { _tag: method, ...params } }`.
   * Returns the `result` field of the response or throws on error.
   */
  rpc<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(
          new Error(
            `WebSocket not connected (state: ${this._connectionState})`,
          ),
        );
        return;
      }

      const id = nextRpcId();
      const body = { _tag: method, ...(params ?? {}) };

      const timer = setTimeout(() => {
        this.pendingRpcs.delete(id);
        reject(new Error(`RPC timeout: ${method} (${RPC_TIMEOUT_MS}ms)`));
      }, RPC_TIMEOUT_MS);

      this.pendingRpcs.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timer,
      });

      try {
        this.ws.send(JSON.stringify({ id, body }));
      } catch (err) {
        this.pendingRpcs.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Fire-and-forget: send an RPC request without waiting for a response.
   * Useful for commands like abort where we don't need the result.
   */
  send(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[ws-client] send failed: not connected");
      return;
    }

    const id = nextRpcId();
    const body = { _tag: method, ...(params ?? {}) };

    try {
      this.ws.send(JSON.stringify({ id, body }));
    } catch (err) {
      console.warn(
        "[ws-client] send error",
        method,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ── Internal: socket lifecycle ───────────────────────────────────

  private openSocket(): void {
    if (this.disposed || !this.url) return;

    this.setConnectionState(
      this.reconnectAttempts > 0 ? "RECONNECTING" : "CONNECTING",
    );

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState("CONNECTED");
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      if (this.disposed) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there
    };
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== "string") return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.warn("[ws-client] malformed message", String(raw).slice(0, 200));
      return;
    }

    // ── RPC response ──────────────────────────────────────────────
    if (typeof parsed.id === "string" && parsed.type !== "push") {
      const pending = this.pendingRpcs.get(parsed.id);
      if (pending) {
        this.pendingRpcs.delete(parsed.id);
        clearTimeout(pending.timer);

        const errorField = parsed.error as { message: string } | undefined;
        if (errorField?.message) {
          pending.reject(new Error(errorField.message));
        } else {
          pending.resolve(parsed.result);
        }
      }
      return;
    }

    // ── Push event ────────────────────────────────────────────────
    if (parsed.type !== "push") return;
    const envelope = parsed as unknown as WsPushEnvelope;
    const { channel, data, sequence } = envelope;

    for (const listener of this.listeners) {
      if (listener.channel === channel) {
        try {
          listener.callback(data, sequence);
        } catch (err) {
          console.warn(
            "[ws-client] listener error",
            channel,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;

    this.clearReconnectTimer();
    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.setConnectionState("DISCONNECTED");
      return;
    }

    this.setConnectionState("RECONNECTING");

    const delayIndex = Math.min(
      this.reconnectAttempts - 1,
      RECONNECT_DELAYS_MS.length - 1,
    );
    const delay = RECONNECT_DELAYS_MS[delayIndex] ?? 16_000;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ── Singleton instance ───────────────────────────────────────────────

let instance: WsTransport | null = null;

/**
 * Get or create the singleton WsTransport instance.
 * Call `initWsTransport(url)` to start the connection.
 */
export function getWsTransport(): WsTransport {
  if (!instance) {
    instance = new WsTransport();
  }
  return instance;
}

/**
 * Initialize the WebSocket transport with a server URL.
 * Should be called once at app startup.
 */
export function initWsTransport(url: string): WsTransport {
  const transport = getWsTransport();
  transport.connect(url);
  return transport;
}

/**
 * Tear down the singleton transport. Used in tests.
 */
export function destroyWsTransport(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
