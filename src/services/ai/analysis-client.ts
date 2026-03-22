// src/services/ai/analysis-client.ts
// Renderer-side analysis client. Communicates with server via HTTP/SSE ONLY.
// NEVER imports Node.js modules or server-side services.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
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
import { V3_PHASES } from "@/types/methodology";

type ProgressCallback = (event: AnalysisProgressEvent) => void;

const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;
const RECOVERY_POLL_INTERVAL_MS = 2_000;

let currentController: AbortController | null = null;
let progressListeners: ProgressCallback[] = [];
let currentRunStatus: RunStatus = {
  status: "idle",
  runId: null,
  activePhase: null,
  progress: {
    completed: 0,
    total: V3_PHASES.length,
  },
};
let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryRequest: Promise<AnalysisStateResponse> | null = null;

function setRunStatus(runStatus: RunStatus): void {
  currentRunStatus = runStatus;
}

function clearRecoveryTimer(): void {
  if (!recoveryTimer) return;
  clearTimeout(recoveryTimer);
  recoveryTimer = null;
}

function scheduleRecoveryPolling(): void {
  clearRecoveryTimer();
  if (currentController || currentRunStatus.status !== "running") {
    return;
  }

  recoveryTimer = setTimeout(() => {
    void hydrateAnalysisState({ enableRecoveryPolling: true });
  }, RECOVERY_POLL_INTERVAL_MS);
}

function stopRecoveryPolling(): void {
  clearRecoveryTimer();
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

async function applyMutationEvent(event: AnalysisMutationEvent): Promise<void> {
  const store = useEntityGraphStore.getState();

  switch (event.type) {
    case "entity_created":
      store.upsertEntityFromServer(event.entity);
      return;
    case "entity_updated":
      store.upsertEntityFromServer(event.entity);
      return;
    case "entity_deleted":
      store.removeEntityFromServer(event.entityId);
      return;
    case "relationship_created":
      store.upsertRelationshipFromServer(event.relationship);
      return;
    case "relationship_updated":
      store.upsertRelationshipFromServer(event.relationship);
      return;
    case "relationship_deleted":
      store.removeRelationshipFromServer(event.relationshipId);
      return;
    case "stale_marked":
      store.markStaleFromServer(event.entityIds);
      return;
    case "state_changed":
      await hydrateAnalysisState({
        enableRecoveryPolling: !currentController,
      });
      return;
  }
}

function notifyProgress(event: AnalysisProgressEvent): void {
  progressListeners.forEach((cb) => cb(event));
}

function updateRunStatusFromProgress(event: AnalysisProgressEvent): void {
  if (event.type === "phase_started") {
    setRunStatus({
      status: "running",
      runId: event.runId,
      activePhase: event.phase as RunStatus["activePhase"],
      progress: {
        completed: currentRunStatus.progress.completed,
        total: currentRunStatus.progress.total,
      },
    });
    return;
  }

  if (event.type === "phase_completed") {
    setRunStatus({
      status: "running",
      runId: event.runId,
      activePhase: null,
      progress: {
        completed: Math.min(
          currentRunStatus.progress.completed + 1,
          currentRunStatus.progress.total,
        ),
        total: currentRunStatus.progress.total,
      },
    });
    return;
  }

  if (event.type === "analysis_completed" || event.type === "analysis_failed") {
    setRunStatus({
      status: "idle",
      runId: null,
      activePhase: null,
      progress: {
        completed: currentRunStatus.progress.completed,
        total: currentRunStatus.progress.total,
      },
    });
  }
}

export function onProgress(cb: ProgressCallback): () => void {
  progressListeners.push(cb);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== cb);
  };
}

export function isRunning(): boolean {
  return currentController !== null || currentRunStatus.status === "running";
}

export function abort(): void {
  stopRecoveryPolling();
  setRunStatus({
    status: "idle",
    runId: null,
    activePhase: null,
    progress: {
      completed: 0,
      total: currentRunStatus.progress.total,
    },
  });

  void fetch("/api/ai/abort", { method: "POST" })
    .then(async (response) => {
      if (!response.ok) return;
      await response.json().catch(() => null as AbortAnalysisResponse | null);
    })
    .catch(() => {
      // Best effort only — local abort still happens below.
    });

  currentController?.abort();
  currentController = null;
}

export async function hydrateAnalysisState(options?: {
  enableRecoveryPolling?: boolean;
}): Promise<AnalysisStateResponse | null> {
  if (recoveryRequest) {
    return null;
  }

  recoveryRequest = (async () => {
    const state = await fetchAnalysisState();
    applyAnalysisSnapshot(state.analysis);
    setRunStatus(state.runStatus);

    if (options?.enableRecoveryPolling && state.runStatus.status === "running") {
      scheduleRecoveryPolling();
    } else {
      stopRecoveryPolling();
    }

    return state;
  })()
    .finally(() => {
      recoveryRequest = null;
    });

  return recoveryRequest;
}

export async function startAnalysis(
  topic: string,
  provider?: string,
  model?: string,
  runtime?: AnalysisRuntimeOverrides,
): Promise<{ runId: string }> {
  if (currentController) throw new Error("Analysis already running");

  stopRecoveryPolling();

  const controller = new AbortController();
  currentController = controller;
  setRunStatus({
    status: "running",
    runId: null,
    activePhase: null,
    progress: {
      completed: 0,
      total: V3_PHASES.length,
    },
  });
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

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
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    let runId = "";
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const event = JSON.parse(raw);
          if (event.type === "done" || event.type === "ping") continue;

          if (event.channel === "started") {
            runId = event.runId;
            setRunStatus({
              ...currentRunStatus,
              status: "running",
              runId,
            });
          } else if (event.channel === "progress") {
            const store = useEntityGraphStore.getState();
            if (event.type === "phase_started") {
              store.setPhaseStatusLocal(event.phase, "running");
            } else if (event.type === "phase_completed") {
              store.setPhaseStatusLocal(event.phase, "complete");
            } else if (event.type === "analysis_failed") {
              for (const phaseState of store.analysis.phases) {
                if (phaseState.status === "running") {
                  store.setPhaseStatusLocal(phaseState.phase, "failed");
                }
              }
            }

            updateRunStatusFromProgress(event as AnalysisProgressEvent);
            notifyProgress(event as AnalysisProgressEvent);
          } else if (event.channel === "mutation") {
            await applyMutationEvent(event as AnalysisMutationEvent);
          } else if (event.channel === "snapshot") {
            if (event.analysis) {
              applyAnalysisSnapshot(event.analysis);
            }
          } else if (event.channel === "error") {
            throw new Error(event.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    return { runId };
  } catch (error) {
    if (controller.signal.aborted) return { runId: "" };
    throw error;
  } finally {
    clearTimeout(timeout);
    currentController = null;

    if (currentRunStatus.status === "running" && !controller.signal.aborted) {
      scheduleRecoveryPolling();
    } else {
      stopRecoveryPolling();
    }
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
  if (!res.ok) return;
  const result = await res.json();
  if (result.queued) {
    const store = useEntityGraphStore.getState();
    store.updateEntity(id, updates);
    return;
  }
  if (result.error) return;
  const state = await hydrateAnalysisState();
  if (state?.analysis) {
    applyAnalysisSnapshot(state.analysis);
  }
}

export function _resetForTest(): void {
  stopRecoveryPolling();
  currentController = null;
  progressListeners = [];
  currentRunStatus = {
    status: "idle",
    runId: null,
    activePhase: null,
    progress: {
      completed: 0,
      total: V3_PHASES.length,
    },
  };
  recoveryRequest = null;
}

// Handle entity_snapshot from chat SSE stream
export function handleChatEntitySnapshot(analysis: Analysis): void {
  applyAnalysisSnapshot(analysis);
}
