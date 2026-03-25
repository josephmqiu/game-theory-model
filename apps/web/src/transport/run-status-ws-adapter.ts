// transport/run-status-ws-adapter.ts
// Thin adapter that listens to WebSocket analysis lifecycle events and
// maps them to run-status-store mutations. No business logic lives here.
//
// Usage: call `bindRunStatusAdapter()` once at app startup after
// `initWsTransport()`. Returns an unbind function for cleanup.

import { useRunStatusStore } from "@/stores/run-status-store";
import {
  ANALYSIS_CHANNELS,
  getWsTransport,
  type AnalysisStartedPayload,
  type AnalysisPhaseCompletedPayload,
  type AnalysisCompletedPayload,
  type AnalysisAbortedPayload,
} from "./ws-client";

/**
 * Bind WebSocket push channels to run-status-store mutations.
 * Returns a cleanup function that removes all subscriptions.
 */
export function bindRunStatusAdapter(): () => void {
  const transport = getWsTransport();
  const unsubs: Array<() => void> = [];

  // ── Analysis started ───────────────────────────────────────────────
  unsubs.push(
    transport.on(ANALYSIS_CHANNELS.started, (data: AnalysisStartedPayload) => {
      useRunStatusStore.getState().setRunStatus({
        status: "running",
        kind: "analysis",
        runId: data.runId,
        activePhase: null,
        progress: { completed: 0, total: 9 },
        deferredRevalidationPending: false,
      });
      useRunStatusStore.getState().setConnectionState("CONNECTED");
    }),
  );

  // ── Phase completed ────────────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.phaseCompleted,
      (data: AnalysisPhaseCompletedPayload) => {
        const store = useRunStatusStore.getState();
        const current = store.runStatus;

        // Only update if we are tracking this run
        if (current.runId !== data.runId) return;

        store.setRunStatus({
          ...current,
          activePhase: data.phase,
          progress: {
            ...current.progress,
            completed: current.progress.completed + 1,
          },
        });
        store.clearPhaseActivityText();
      },
    ),
  );

  // ── Analysis completed ─────────────────────────────────────────────
  unsubs.push(
    transport.on(
      ANALYSIS_CHANNELS.completed,
      (data: AnalysisCompletedPayload) => {
        const store = useRunStatusStore.getState();
        const current = store.runStatus;

        store.setRunStatus({
          status: "idle",
          kind: current.kind,
          runId: data.runId,
          activePhase: null,
          progress: {
            completed: current.progress.total,
            total: current.progress.total,
          },
          deferredRevalidationPending: false,
        });
        store.clearPhaseActivityText();
      },
    ),
  );

  // ── Analysis aborted ───────────────────────────────────────────────
  unsubs.push(
    transport.on(ANALYSIS_CHANNELS.aborted, (data: AnalysisAbortedPayload) => {
      const store = useRunStatusStore.getState();
      const current = store.runStatus;

      store.setRunStatus({
        status: "cancelled",
        kind: current.kind,
        runId: data.runId,
        activePhase: null,
        progress: current.progress,
        deferredRevalidationPending: false,
      });
      store.clearPhaseActivityText();
    }),
  );

  // ── Cleanup ────────────────────────────────────────────────────────
  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
