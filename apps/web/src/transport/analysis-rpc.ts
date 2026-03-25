// transport/analysis-rpc.ts
// WebSocket RPC wrappers for analysis commands.
// Replaces the legacy HTTP/SSE analysis-client functions.
//
// These functions call through the WsTransport RPC mechanism instead
// of fetch() / EventSource. Push events (entity mutations, run status)
// are handled by the adapters in entity-graph-ws-adapter.ts and
// run-status-ws-adapter.ts.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useRunStatusStore } from "@/stores/run-status-store";
import type { AnalysisStateResponse } from "@/types/api";
import type { AnalysisProgressEvent } from "@/types/events";
import type { Analysis } from "@/types/entity";
import type { AnalysisRuntimeOverrides } from "@/types/analysis-runtime";
import { getWsTransport, ANALYSIS_CHANNELS } from "./ws-client";
import type {
  AnalysisPhaseCompletedPayload,
  AnalysisStartedPayload,
} from "./ws-client";
import i18n from "@/i18n";
import { formatPhaseActivityNote } from "@/services/ai/phase-activity-format";

// ── Types ────────────────────────────────────────────────────────────

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

// ── RPC method names ─────────────────────────────────────────────────
// These must match the server-side WebSocket handler method names.

const ANALYSIS_RPC = {
  startAnalysis: "analysis.start",
  abortAnalysis: "analysis.abort",
  getState: "analysis.getState",
  updateEntity: "analysis.updateEntity",
} as const;

// ── Internal state ───────────────────────────────────────────────────

let currentController: AbortController | null = null;
let progressListeners: Array<(event: AnalysisProgressStreamEvent) => void> = [];
let abortRequested = false;

function notifyProgress(event: AnalysisProgressStreamEvent): void {
  for (const cb of progressListeners) {
    cb(event);
  }
}

// ── Progress event adapter ───────────────────────────────────────────
// Subscribe to WS push channels that map to progress events and
// forward them to the legacy progress callback interface. This is bound
// once from initTransportLayer, not per-call.

let progressAdapterBound = false;

export function bindProgressAdapter(): () => void {
  if (progressAdapterBound) {
    return () => {};
  }
  progressAdapterBound = true;

  const transport = getWsTransport();
  const unsubs: Array<() => void> = [];

  // Phase completed -> progress event
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.phaseCompleted,
      (data: AnalysisPhaseCompletedPayload) => {
        const event: AnalysisProgressStreamEvent = {
          type: "phase_completed",
          phase: data.phase,
          runId: data.runId,
          summary: data.summary ?? {
            entitiesCreated: 0,
            relationshipsCreated: 0,
            entitiesUpdated: 0,
            durationMs: 0,
          },
        };
        applyProgressEvent(event);
      },
    ),
  );

  // Analysis started -> progress event
  unsubs.push(
    transport.on(ANALYSIS_CHANNELS.started, (data: AnalysisStartedPayload) => {
      const event: AnalysisProgressStreamEvent = {
        type: "phase_started",
        phase: "initialization",
        runId: data.runId,
      };
      applyProgressEvent(event);
    }),
  );

  return () => {
    progressAdapterBound = false;
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

// ── Store update helpers ─────────────────────────────────────────────

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

// ── Public API ───────────────────────────────────────────────────────

/**
 * Subscribe to analysis progress events.
 * Returns an unsubscribe function.
 */
export function onAnalysisProgress(
  cb: (event: AnalysisProgressStreamEvent) => void,
): () => void {
  progressListeners.push(cb);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== cb);
  };
}

/**
 * Check whether an analysis is currently running.
 */
export function isAnalysisRunning(): boolean {
  return (
    currentController !== null ||
    (useRunStatusStore.getState().runStatus.status === "running" &&
      !abortRequested)
  );
}

/**
 * Abort the currently running analysis.
 */
export function abortAnalysis(): void {
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

  // Send abort command via WebSocket (fire-and-forget)
  if (shouldAbortRunningAnalysis) {
    const transport = getWsTransport();
    transport.send(ANALYSIS_RPC.abortAnalysis);
  }

  const activeController = currentController;
  currentController = null;
  activeController?.abort();
}

/**
 * Hydrate analysis state from the server.
 * Returns the full state snapshot or null if unavailable.
 */
export async function hydrateAnalysisState(): Promise<AnalysisStateResponse | null> {
  try {
    const transport = getWsTransport();
    const state = await transport.rpc<AnalysisStateResponse>(
      ANALYSIS_RPC.getState,
    );

    if (!state) return null;

    abortRequested = false;
    applyAnalysisSnapshot(state.analysis);
    useRunStatusStore.getState().applySnapshot(state.runStatus);

    console.log("[analysis-rpc] state-hydrated", {
      status: state.runStatus.status,
      runId: state.runStatus.runId,
      entities: state.analysis.entities.length,
    });

    useRunStatusStore.getState().setConnectionState("CONNECTED");
    return state;
  } catch (err) {
    console.warn(
      "[analysis-rpc] hydrate-failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Start a new analysis run.
 */
export async function startAnalysis(
  topic: string,
  provider?: string,
  model?: string,
  runtime?: AnalysisRuntimeOverrides,
): Promise<{ runId: string }> {
  if (currentController) {
    throw new Error("Analysis already running");
  }

  const controller = new AbortController();
  currentController = controller;
  abortRequested = false;

  try {
    const transport = getWsTransport();
    const result = await transport.rpc<{ runId: string }>(
      ANALYSIS_RPC.startAnalysis,
      { topic, provider, model, runtime },
    );

    const runId = result?.runId?.trim();
    if (!runId) {
      throw new Error("Start analysis response missing runId");
    }

    return { runId };
  } catch (error) {
    if (controller.signal.aborted) {
      return { runId: "" };
    }

    console.error(
      "[analysis-rpc] start-failed",
      error instanceof Error ? error.message : error,
    );
    throw error;
  } finally {
    currentController = null;
  }
}

/**
 * Update an entity on the server during an active analysis.
 */
export async function updateEntity(
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  try {
    const transport = getWsTransport();
    const result = await transport.rpc<{
      queued?: boolean;
      error?: string;
    }>(ANALYSIS_RPC.updateEntity, { id, updates });

    if (result?.queued) {
      useEntityGraphStore.getState().updateEntity(id, updates);
      return;
    }

    if (result?.error) {
      console.warn("[analysis-rpc] entity-update-server-error", {
        id,
        error: result.error,
      });
      return;
    }

    // Refresh state after server-side update
    const state = await hydrateAnalysisState();
    if (state?.analysis) {
      applyAnalysisSnapshot(state.analysis);
    }
  } catch (err) {
    console.warn(
      "[analysis-rpc] entity-update-failed",
      id,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Handle entity snapshot from chat SSE stream.
 * Applies the analysis snapshot to the entity graph store.
 */
export function handleChatEntitySnapshot(analysis: Analysis): void {
  applyAnalysisSnapshot(analysis);
}

/**
 * Reset internal state for tests.
 */
export function _resetForTest(): void {
  currentController = null;
  progressListeners = [];
  abortRequested = false;
  progressAdapterBound = false;
  useRunStatusStore.getState().resetForTest();
}
