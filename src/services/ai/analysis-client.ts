// src/services/ai/analysis-client.ts
// Renderer-side analysis client. Communicates with server via HTTP and receives
// real-time events through the workspace-runtime WebSocket transport.
// NEVER imports Node.js modules or server-side services.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { useRunStatusStore } from "@/stores/run-status-store";
import type {
  AbortAnalysisResponse,
  AnalysisStateResponse,
  RunStatus,
} from "../../../shared/types/api";
import type {
  AnalysisMutationEvent,
  AnalysisPhaseActivityKind,
  AnalysisProgressEvent,
} from "../../../shared/types/events";
import type {
  WorkspaceRuntimeBootstrapEnvelope,
  WorkspaceRuntimePushEnvelope,
} from "../../../shared/types/workspace-runtime";
import type { Analysis } from "../../../shared/types/entity";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import type { AIProviderType } from "@/types/agent-settings";
import i18n from "@/i18n";
import { getEntityCardMetrics } from "@/services/entity/entity-card-metrics";
import { formatPhaseActivityNote } from "./phase-activity-format";
import { workspaceRuntimeClient } from "./workspace-runtime-client";

export interface AnalysisPhaseActivityEvent {
  type: "phase_activity";
  phase: string;
  runId: string;
  kind: AnalysisPhaseActivityKind;
  message: string;
  toolName?: string;
  query?: string;
}

export type AnalysisProgressStreamEvent =
  | AnalysisProgressEvent
  | AnalysisPhaseActivityEvent;

type ProgressCallback = (event: AnalysisProgressStreamEvent) => void;

let currentController: AbortController | null = null;
let progressListeners: ProgressCallback[] = [];
let abortRequested = false;
let unsubscribeWs: (() => void) | null = null;
let hydrated = false;

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
  } else if (event.type === "synthesis_started") {
    store.setPhaseActivityText(
      i18n.t("analysis.activity.synthesizing", "Synthesizing report..."),
    );
  } else if (event.type === "synthesis_completed") {
    store.clearPhaseActivityText();
    panToReportEntity();
  }

  notifyProgress(event);
}

/**
 * After synthesis completes, find the analysis-report entity and
 * pan the canvas viewport to center on it.
 */
function panToReportEntity(): void {
  const graphStore = useEntityGraphStore.getState();
  const reportEntity = graphStore.analysis.entities.find(
    (e) => e.type === "analysis-report",
  );
  if (!reportEntity) return;

  const layoutEntry = graphStore.layout[reportEntity.id];
  if (!layoutEntry) return;

  const canvasStore = useCanvasStore.getState();
  const { zoom } = canvasStore.viewport;

  // Center the viewport on the report entity's position.
  // setPan expects the negative scene offset (screen = scene * zoom + pan).
  // We target the center of the card (offset by half-width / half-height).
  const metrics = getEntityCardMetrics("analysis-report");
  const cardWidth = metrics.width;
  const cardHeight = metrics.height;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;

  const targetX = -(layoutEntry.x + cardWidth / 2) * zoom + viewportWidth / 2;
  const targetY = -(layoutEntry.y + cardHeight / 2) * zoom + viewportHeight / 2;

  canvasStore.setPan(targetX, targetY);
  canvasStore.setFocusedEntityId(reportEntity.id);
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

// ── WebSocket transport integration ──

function handleWsPush(envelope: WorkspaceRuntimePushEnvelope): void {
  if (!hydrated) {
    return;
  }

  switch (envelope.channel) {
    case "analysis-mutation": {
      const typed =
        envelope as WorkspaceRuntimePushEnvelope<"analysis-mutation">;
      const shouldRecover = applyMutationEvent(typed.payload.event);
      if (shouldRecover) {
        void recoverFromStateChange();
      }
      return;
    }
    case "analysis-status": {
      const typed = envelope as WorkspaceRuntimePushEnvelope<"analysis-status">;
      applyRunStatus(typed.payload.runStatus);
      return;
    }
    case "analysis-progress": {
      const typed =
        envelope as WorkspaceRuntimePushEnvelope<"analysis-progress">;
      applyProgressEvent(typed.payload.event as AnalysisProgressStreamEvent);
      return;
    }
  }
}

async function recoverFromStateChange(): Promise<void> {
  try {
    const state = await fetchAnalysisState();
    applySnapshot(state);
  } catch (e) {
    console.warn(
      "[analysis-client] state-recovery-failed",
      e instanceof Error ? e.message : e,
    );
  }
}

function handleWsEnvelope(
  envelope: WorkspaceRuntimeBootstrapEnvelope | WorkspaceRuntimePushEnvelope,
): void {
  if (envelope.type === "bootstrap" && hydrated) {
    // WebSocket reconnected — re-hydrate analysis state from the server.
    useRunStatusStore.getState().setConnectionState("RECOVERING");
    void recoverFromStateChange().then(() => {
      useRunStatusStore.getState().setConnectionState("CONNECTED");
    });
    return;
  }

  if (envelope.type === "push") {
    handleWsPush(envelope);
  }
}

function ensureWsSubscription(): void {
  if (unsubscribeWs) {
    return;
  }
  unsubscribeWs = workspaceRuntimeClient.subscribe(handleWsEnvelope);
}

// ── Public API ──

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
  const store = useRunStatusStore.getState();
  const runStatus = store.runStatus;
  const shouldAbortRunningAnalysis =
    runStatus.status === "running" && runStatus.kind === "analysis";
  const shouldAbortKickoffRequest = currentController !== null;

  if (!shouldAbortRunningAnalysis && !shouldAbortKickoffRequest) {
    return;
  }

  abortRequested = true;
  if (shouldAbortRunningAnalysis) {
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

  if (shouldAbortRunningAnalysis) {
    void fetch("/api/ai/abort", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) return;
        await response.json().catch(() => null as AbortAnalysisResponse | null);
      })
      .catch((e) => {
        console.warn("[analysis-client] abort-endpoint-unreachable", e);
      });
  }

  const activeController = currentController;
  currentController = null;
  activeController?.abort();
}

export async function hydrateAnalysisState(): Promise<AnalysisStateResponse | null> {
  if (typeof window === "undefined") {
    return null;
  }

  ensureWsSubscription();
  useRunStatusStore.getState().setConnectionState("RECOVERING");

  try {
    const state = await fetchAnalysisState();
    applySnapshot(state);
    hydrated = true;
    useRunStatusStore.getState().setConnectionState("CONNECTED");
    return state;
  } catch (e) {
    console.warn(
      "[analysis-client] hydration-failed",
      e instanceof Error ? e.message : e,
    );
    useRunStatusStore.getState().setConnectionState("DISCONNECTED");
    return null;
  }
}

export async function startAnalysis(
  topic: string,
  provider?: AIProviderType,
  model?: string,
  runtime?: AnalysisRuntimeOverrides,
): Promise<{ runId: string }> {
  if (currentController) {
    throw new Error("Analysis already running");
  }

  ensureWsSubscription();

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

    const payload = (await response.json().catch(() => null)) as {
      runId?: string;
    } | null;
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
  hydrated = false;
  if (unsubscribeWs) {
    unsubscribeWs();
    unsubscribeWs = null;
  }
  useRunStatusStore.getState().resetForTest();
}
