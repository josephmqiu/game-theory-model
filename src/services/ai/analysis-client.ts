// src/services/ai/analysis-client.ts
// Renderer-side analysis client. Communicates with server via HTTP/SSE ONLY.
// NEVER imports Node.js modules or server-side services.

import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { AnalysisProgressEvent } from "./analysis-events";
import type { Analysis } from "@/types/entity";

type ProgressCallback = (event: AnalysisProgressEvent) => void;

let currentController: AbortController | null = null;
let progressListeners: ProgressCallback[] = [];

export function onProgress(cb: ProgressCallback): () => void {
  progressListeners.push(cb);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== cb);
  };
}

export function isRunning(): boolean {
  return currentController !== null;
}

export function abort(): void {
  currentController?.abort();
  currentController = null;
}

export async function startAnalysis(
  topic: string,
  provider?: string,
  model?: string,
): Promise<{ runId: string }> {
  if (currentController) throw new Error("Analysis already running");

  const controller = new AbortController();
  currentController = controller;
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, provider, model }),
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
          } else if (event.channel === "progress") {
            // Update phase statuses in real-time
            const store = useEntityGraphStore.getState();
            if (event.type === "phase_started") {
              store.setPhaseStatusLocal(event.phase, "running");
            } else if (event.type === "phase_completed") {
              store.setPhaseStatusLocal(event.phase, "complete");
            }
            progressListeners.forEach((cb) => cb(event));
          } else if (event.channel === "snapshot") {
            // Full state sync
            if (event.analysis) {
              const store = useEntityGraphStore.getState();
              if (store.syncAnalysis) {
                store.syncAnalysis(event.analysis);
              } else {
                store.loadAnalysis(event.analysis);
              }
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
  // Re-fetch full state to sync
  const stateRes = await fetch("/api/ai/entity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get" }),
  });
  const data = await stateRes.json();
  if (data.analysis) {
    const store = useEntityGraphStore.getState();
    if (store.syncAnalysis) store.syncAnalysis(data.analysis);
    else store.loadAnalysis(data.analysis);
  }
}

// Handle entity_snapshot from chat SSE stream
export function handleChatEntitySnapshot(analysis: Analysis): void {
  const store = useEntityGraphStore.getState();
  if (store.syncAnalysis) store.syncAnalysis(analysis);
  else store.loadAnalysis(analysis);
}
