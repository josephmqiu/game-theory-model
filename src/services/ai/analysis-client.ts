// src/services/ai/analysis-client.ts
// Renderer-side analysis client. Communicates with server via HTTP/SSE ONLY.
// NEVER imports Node.js modules or server-side services.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  useRunStatusStore,
  type ConnectionState,
} from "@/stores/run-status-store";
import type {
  AbortAnalysisResponse,
  AnalysisStateResponse,
  RunStatus,
} from "../../../shared/types/api";
import type {
  AnalysisMutationEvent,
  AnalysisProgressEvent,
} from "../../../shared/types/events";
import type { Analysis } from "../../../shared/types/entity";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import i18n from "@/i18n";
import { formatPhaseActivityNote } from "./phase-activity-format";

export interface AnalysisPhaseActivityEvent {
  type: "phase_activity";
  phase: string;
  runId: string;
  kind: string;
  message: string;
  toolName?: string;
}

export type AnalysisProgressStreamEvent =
  | AnalysisProgressEvent
  | AnalysisPhaseActivityEvent;

type ProgressCallback = (event: AnalysisProgressStreamEvent) => void;

type MutationEnvelope = {
  channel: "mutation";
  revision?: number;
} & AnalysisMutationEvent;

type ProgressEnvelope = {
  channel: "progress";
  revision?: number;
} & AnalysisProgressEvent;

type StatusEnvelope = {
  channel: "status";
  revision?: number;
} & RunStatus;

type PingEnvelope = {
  channel: "ping";
  revision?: number;
};

type StreamEnvelope =
  | MutationEnvelope
  | ProgressEnvelope
  | StatusEnvelope
  | PingEnvelope;

type EventStreamManagerWindow = Window & {
  __eventStreamManager?: EventStreamManager;
};

declare global {
  interface Window {
    __eventStreamManager?: EventStreamManager;
  }
}

const HEARTBEAT_TIMEOUT_MS = 30_000;
const HEARTBEAT_CHECK_INTERVAL_MS = 5_000;
const MAX_BUFFERED_EVENTS = 1_000;
const MAX_RECOVERY_FAILURES = 5;
const RECOVERY_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

let currentController: AbortController | null = null;
let progressListeners: ProgressCallback[] = [];
let abortRequested = false;

function notifyProgress(event: AnalysisProgressStreamEvent): void {
  progressListeners.forEach((cb) => cb(event));
}

async function fetchAnalysisState(): Promise<AnalysisStateResponse> {
  const response = await fetch("/api/ai/state");
  if (!response.ok) {
    throw new Error(`State sync failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<AnalysisStateResponse>;
}

function applyAnalysisSnapshot(analysis: Analysis): void {
  const store = useEntityGraphStore.getState();
  if (store.syncAnalysisFromServer) {
    store.syncAnalysisFromServer(analysis);
  } else if (store.syncAnalysis) {
    store.syncAnalysis(analysis);
  } else {
    store.loadAnalysis(analysis, undefined);
  }
}

function applyRunStatus(runStatus: RunStatus): void {
  const store = useRunStatusStore.getState();
  abortRequested = false;
  store.setRunStatus(runStatus);
  if (runStatus.status !== "running") {
    store.clearPhaseActivityText();
  }
}

function applyProgressEvent(event: AnalysisProgressStreamEvent): void {
  const store = useRunStatusStore.getState();

  if (event.type === "phase_started") {
    store.setPhaseActivityText(i18n.t("analysis.activity.preparing"));
  } else if (event.type === "phase_completed") {
    store.clearPhaseActivityText();
  } else if (event.type === "phase_activity") {
    store.setPhaseActivityText(formatPhaseActivityNote(event));
  }

  notifyProgress(event);
}

function applyMutationEvent(event: AnalysisMutationEvent): boolean {
  const store = useEntityGraphStore.getState();

  switch (event.type) {
    case "entity_created":
      store.upsertEntityFromServer(event.entity);
      return false;
    case "entity_updated":
      store.upsertEntityFromServer(event.entity);
      return false;
    case "entity_deleted":
      store.removeEntityFromServer(event.entityId);
      return false;
    case "relationship_created":
      store.upsertRelationshipFromServer(event.relationship);
      return false;
    case "relationship_updated":
      store.upsertRelationshipFromServer(event.relationship);
      return false;
    case "relationship_deleted":
      store.removeRelationshipFromServer(event.relationshipId);
      return false;
    case "stale_marked":
      store.markStaleFromServer(event.entityIds);
      return false;
    case "state_changed":
      return true;
  }
}

function stripEnvelope(
  envelope: ProgressEnvelope | MutationEnvelope | StatusEnvelope,
): AnalysisProgressStreamEvent | AnalysisMutationEvent | RunStatus {
  const { channel: _channel, revision: _revision, ...payload } = envelope;
  return payload;
}

function applySnapshot(state: AnalysisStateResponse): void {
  abortRequested = false;
  applyAnalysisSnapshot(state.analysis);
  useRunStatusStore.getState().applySnapshot(state.runStatus);
  console.log("[analysis-client] state-recovered", {
    status: state.runStatus.status,
    runId: state.runStatus.runId,
    entities: state.analysis.entities.length,
  });
}

function getRecoveryDelayMs(failureCount: number): number {
  return (
    RECOVERY_BACKOFF_MS[Math.min(failureCount - 1, RECOVERY_BACKOFF_MS.length - 1)] ??
    30_000
  );
}

function getWindow(): EventStreamManagerWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as EventStreamManagerWindow;
}

class EventStreamManager {
  private eventSource: EventSource | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private recoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryPromise: Promise<AnalysisStateResponse> | null = null;
  private bufferedEvents: StreamEnvelope[] = [];
  private bufferOverflowed = false;
  private recoveryFailures = 0;
  private disposed = false;
  private lastPingAt = Date.now();
  private readonly handleEventSourceOpen = () => {
    if (this.disposed) {
      return;
    }

    this.lastPingAt = Date.now();
    if (this.getConnectionState() === "DISCONNECTED") {
      this.recoveryFailures = 0;
      void this.recover("eventsource-open").catch(() => {});
      return;
    }

    if (this.getConnectionState() === "CONNECTING") {
      this.setConnectionState("CONNECTED");
    }
  };
  private readonly handleEventSourceMessage = (event: Event) => {
    if (this.disposed) {
      return;
    }
    this.handleMessageEvent(String((event as MessageEvent).data ?? ""));
  };
  private readonly handleEventSourceError = () => {
    if (this.disposed || this.getConnectionState() === "RECOVERING") {
      return;
    }
    void this
      .recover("eventsource-error", { recycleEventSource: true })
      .catch(() => {});
  };

  constructor() {
    this.setConnectionState("RECOVERING");
    this.openEventSource({ preserveConnectionState: true });
    this.startHeartbeatMonitor();
    void this.recover("initial-load").catch(() => {});
  }

  hydrate(): Promise<AnalysisStateResponse> {
    if (!this.eventSource) {
      this.openEventSource({ preserveConnectionState: true });
    }
    return this.recover("manual-hydrate");
  }

  resetForTest(): void {
    this.dispose();
    this.bufferedEvents = [];
    this.bufferOverflowed = false;
    this.recoveryFailures = 0;
    this.lastPingAt = Date.now();
    this.disposed = false;
    this.recoveryPromise = null;
    this.openEventSource({ preserveConnectionState: true });
    this.startHeartbeatMonitor();
    this.setConnectionState("RECOVERING");
    void this.recover("test-reset").catch(() => {});
  }

  dispose(): void {
    this.disposed = true;
    this.clearRecoveryRetryTimer();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.detachEventSourceListeners();
    this.eventSource?.close();
    this.eventSource = null;
    this.recoveryPromise = null;
  }

  private getConnectionState(): ConnectionState {
    return useRunStatusStore.getState().connectionState;
  }

  private setConnectionState(connectionState: ConnectionState): void {
    useRunStatusStore.getState().setConnectionState(connectionState);
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.disposed || !this.eventSource) {
        return;
      }

      const connectionState = this.getConnectionState();
      if (
        connectionState !== "CONNECTED" &&
        connectionState !== "CONNECTING"
      ) {
        return;
      }

      if (Date.now() - this.lastPingAt <= HEARTBEAT_TIMEOUT_MS) {
        return;
      }

      void this
        .recover("heartbeat-timeout", { recycleEventSource: true })
        .catch(() => {});
    }, HEARTBEAT_CHECK_INTERVAL_MS);
  }

  private clearRecoveryRetryTimer(): void {
    if (!this.recoveryRetryTimer) {
      return;
    }
    clearTimeout(this.recoveryRetryTimer);
    this.recoveryRetryTimer = null;
  }

  private detachEventSourceListeners(
    eventSource: EventSource | null = this.eventSource,
  ): void {
    if (!eventSource) {
      return;
    }

    eventSource.removeEventListener("open", this.handleEventSourceOpen);
    eventSource.removeEventListener("message", this.handleEventSourceMessage);
    eventSource.removeEventListener("error", this.handleEventSourceError);
  }

  private scheduleRecoveryRetry(): void {
    if (this.disposed || this.recoveryFailures >= MAX_RECOVERY_FAILURES) {
      return;
    }

    this.clearRecoveryRetryTimer();
    const delayMs = getRecoveryDelayMs(this.recoveryFailures);
    this.recoveryRetryTimer = setTimeout(() => {
      this.recoveryRetryTimer = null;
      void this.recover("retry").catch(() => {});
    }, delayMs);
  }

  private openEventSource(options?: { preserveConnectionState?: boolean }): void {
    if (this.disposed) {
      return;
    }

    if (this.eventSource) {
      this.detachEventSourceListeners();
      this.eventSource.close();
    }
    this.lastPingAt = Date.now();
    if (!options?.preserveConnectionState) {
      this.setConnectionState("CONNECTING");
    }

    const eventSource = new EventSource("/api/ai/events");
    this.eventSource = eventSource;

    eventSource.addEventListener("open", this.handleEventSourceOpen);
    eventSource.addEventListener("message", this.handleEventSourceMessage);
    eventSource.addEventListener("error", this.handleEventSourceError);
  }

  private bufferEvent(envelope: StreamEnvelope): void {
    if (this.bufferOverflowed) {
      return;
    }

    if (this.bufferedEvents.length >= MAX_BUFFERED_EVENTS) {
      this.bufferedEvents = [];
      this.bufferOverflowed = true;
      return;
    }

    this.bufferedEvents.push(envelope);
  }

  private handleMessageEvent(raw: string): void {
    let envelope: StreamEnvelope;

    try {
      envelope = JSON.parse(raw) as StreamEnvelope;
    } catch (_error) {
      console.warn("[analysis-client] malformed-sse-json", raw.slice(0, 200));
      return;
    }

    if (envelope.channel === "ping") {
      this.lastPingAt = Date.now();
    }

    const connectionState = this.getConnectionState();
    if (
      connectionState === "RECOVERING" ||
      connectionState === "DISCONNECTED"
    ) {
      this.bufferEvent(envelope);
      return;
    }

    this.applyEnvelope(envelope);
  }

  private applyEnvelope(envelope: StreamEnvelope): void {
    switch (envelope.channel) {
      case "ping":
        this.lastPingAt = Date.now();
        return;

      case "status":
        applyRunStatus(stripEnvelope(envelope) as RunStatus);
        return;

      case "progress":
        applyProgressEvent(stripEnvelope(envelope) as AnalysisProgressStreamEvent);
        return;

      case "mutation": {
        const shouldRecover = applyMutationEvent(
          stripEnvelope(envelope) as AnalysisMutationEvent,
        );
        if (shouldRecover) {
          void this.recover("state-changed").catch(() => {});
        }
        return;
      }
    }
  }

  private async replayBufferedEvents(snapshotRevision: number): Promise<void> {
    if (this.bufferOverflowed) {
      this.bufferedEvents = [];
      this.bufferOverflowed = false;
      return;
    }

    while (this.bufferedEvents.length > 0) {
      const pendingEvents = this.bufferedEvents;
      this.bufferedEvents = [];

      for (const envelope of pendingEvents) {
        if (
          typeof envelope.revision === "number" &&
          envelope.revision <= snapshotRevision
        ) {
          continue;
        }
        this.applyEnvelope(envelope);
      }

      if (this.bufferOverflowed) {
        this.bufferedEvents = [];
        this.bufferOverflowed = false;
        return;
      }
    }
  }

  private recover(
    _reason: string,
    options?: { recycleEventSource?: boolean },
  ): Promise<AnalysisStateResponse> {
    if (this.disposed) {
      return Promise.reject(new Error("EventStreamManager disposed"));
    }

    if (options?.recycleEventSource || !this.eventSource) {
      this.setConnectionState("RECOVERING");
      this.openEventSource({ preserveConnectionState: true });
    } else {
      this.setConnectionState("RECOVERING");
    }

    this.clearRecoveryRetryTimer();

    if (this.recoveryPromise) {
      return this.recoveryPromise;
    }

    this.recoveryPromise = (async () => {
      try {
        const state = await fetchAnalysisState();
        this.recoveryFailures = 0;
        applySnapshot(state);
        await this.replayBufferedEvents(state.revision);
        this.lastPingAt = Date.now();
        this.setConnectionState("CONNECTED");
        return state;
      } catch (e) {
        this.recoveryFailures += 1;
        console.warn(
          "[analysis-client] state-recovery-failed",
          e instanceof Error ? e.message : e,
        );

        if (this.recoveryFailures >= MAX_RECOVERY_FAILURES) {
          this.setConnectionState("DISCONNECTED");
        } else {
          this.scheduleRecoveryRetry();
        }

        throw e;
      } finally {
        this.recoveryPromise = null;
      }
    })();

    return this.recoveryPromise;
  }
}

function getEventStreamManager(): EventStreamManager | null {
  const windowRef = getWindow();
  if (!windowRef) {
    return null;
  }

  if (!windowRef.__eventStreamManager) {
    windowRef.__eventStreamManager = new EventStreamManager();
  }

  return windowRef.__eventStreamManager;
}

export function onProgress(cb: ProgressCallback): () => void {
  progressListeners.push(cb);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== cb);
  };
}

export function isRunning(): boolean {
  return (
    currentController !== null ||
    (useRunStatusStore.getState().runStatus.status === "running" &&
      !abortRequested)
  );
}

export function abort(): void {
  abortRequested = true;
  const store = useRunStatusStore.getState();
  const runStatus = store.runStatus;
  if (runStatus.status === "running") {
    store.setRunStatus({
      status: "cancelled",
      kind: runStatus.kind,
      runId: runStatus.runId,
      activePhase: null,
      progress: { ...runStatus.progress },
      deferredRevalidationPending: runStatus.deferredRevalidationPending,
    });
  }
  store.clearPhaseActivityText();

  void fetch("/api/ai/abort", { method: "POST" })
    .then(async (response) => {
      if (!response.ok) return;
      await response.json().catch(() => null as AbortAnalysisResponse | null);
    })
    .catch((e) => {
      console.warn("[analysis-client] abort-endpoint-unreachable", e);
    });

  const activeController = currentController;
  currentController = null;
  activeController?.abort();
}

export async function hydrateAnalysisState(): Promise<AnalysisStateResponse | null> {
  const manager = getEventStreamManager();
  if (!manager) {
    return null;
  }

  return manager.hydrate();
}

export async function startAnalysis(
  topic: string,
  provider?: string,
  model?: string,
  runtime?: AnalysisRuntimeOverrides,
): Promise<{ runId: string }> {
  if (currentController) {
    throw new Error("Analysis already running");
  }

  getEventStreamManager();

  const controller = new AbortController();
  currentController = controller;
  abortRequested = false;

  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, provider, model, runtime }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ error: `HTTP ${response.status}` }));
      console.error("[analysis-client] start-failed", {
        status: response.status,
        error: err.error,
      });
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        `Analyze kickoff returned non-JSON content type: ${contentType || "unknown"}`,
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | { runId?: string }
      | null;
    const runId = payload?.runId?.trim();
    if (!runId) {
      throw new Error("Analyze kickoff response missing runId");
    }

    return { runId };
  } catch (error) {
    if (controller.signal.aborted) {
      return { runId: "" };
    }

    console.error(
      "[analysis-client] stream-error",
      error instanceof Error ? error.message : error,
    );
    throw error;
  } finally {
    currentController = null;
  }
}

// Entity editing via server endpoint
export async function updateEntity(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const res = await fetch("/api/ai/entity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", id, updates }),
  });
  if (!res.ok) {
    console.warn("[analysis-client] entity-update-http-error", {
      id,
      status: res.status,
    });
    return;
  }
  const result = await res.json();
  if (result.queued) {
    const store = useEntityGraphStore.getState();
    store.updateEntity(id, updates);
    return;
  }
  if (result.error) {
    console.warn("[analysis-client] entity-update-server-error", {
      id,
      error: result.error,
    });
    return;
  }
  const state = await hydrateAnalysisState();
  if (state?.analysis) {
    applyAnalysisSnapshot(state.analysis);
  }
}

export function _resetForTest(): void {
  currentController = null;
  progressListeners = [];
  abortRequested = false;
  useRunStatusStore.getState().resetForTest();
  const manager = getWindow()?.__eventStreamManager;
  manager?.dispose();
  const windowRef = getWindow();
  if (windowRef) {
    delete windowRef.__eventStreamManager;
  }
}

// Handle entity_snapshot from chat SSE stream
export function handleChatEntitySnapshot(analysis: Analysis): void {
  applyAnalysisSnapshot(analysis);
}
