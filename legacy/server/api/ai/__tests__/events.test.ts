import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutationListeners = new Set<(event: Record<string, unknown>) => void>();
const statusListeners = new Set<(event: Record<string, unknown>) => void>();
const orchestratorListeners = new Set<
  (event: Record<string, unknown>) => void
>();
const revalidationListeners = new Set<
  (event: Record<string, unknown>) => void
>();

let currentRevision = 0;

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
}));

vi.mock("../../../services/entity-graph-service", () => ({
  onMutation: (callback: (event: Record<string, unknown>) => void) => {
    mutationListeners.add(callback);
    return () => mutationListeners.delete(callback);
  },
}));

vi.mock("../../../services/runtime-status", () => ({
  getRevision: () => currentRevision,
  onStatusChange: (callback: (event: Record<string, unknown>) => void) => {
    statusListeners.add(callback);
    return () => statusListeners.delete(callback);
  },
}));

vi.mock("../../../agents/analysis-agent", () => ({
  onProgress: (callback: (event: Record<string, unknown>) => void) => {
    orchestratorListeners.add(callback);
    return () => orchestratorListeners.delete(callback);
  },
}));

vi.mock("../../../services/revalidation-service", () => ({
  onProgress: (callback: (event: Record<string, unknown>) => void) => {
    revalidationListeners.add(callback);
    return () => revalidationListeners.delete(callback);
  },
}));

class FakeServerResponse extends EventEmitter {
  headers: Record<string, string> | null = null;
  chunks: string[] = [];

  writeHead(_statusCode: number, headers: Record<string, string>): void {
    this.headers = headers;
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  close(): void {
    this.emit("close");
  }
}

function createEvent() {
  const res = new FakeServerResponse();
  return {
    event: {
      node: {
        res,
      },
    },
    res,
  };
}

function parseEvents(chunks: string[]): Array<Record<string, unknown>> {
  return chunks
    .join("")
    .split("\n\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("data: "))
    .map((entry) => JSON.parse(entry.slice(6)) as Record<string, unknown>);
}

function emitMutation(
  revision: number,
  event: Record<string, unknown>,
): void {
  currentRevision = revision;
  for (const listener of mutationListeners) {
    listener(event);
  }
}

function emitOrchestratorProgress(
  revision: number,
  event: Record<string, unknown>,
): void {
  currentRevision = revision;
  for (const listener of orchestratorListeners) {
    listener(event);
  }
}

function emitRevalidationProgress(
  revision: number,
  event: Record<string, unknown>,
): void {
  currentRevision = revision;
  for (const listener of revalidationListeners) {
    listener(event);
  }
}

describe("/api/ai/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRevision = 0;
    mutationListeners.clear();
    statusListeners.clear();
    orchestratorListeners.clear();
    revalidationListeners.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("streams mutation events with the current revision", async () => {
    const { event, res } = createEvent();
    const route = (await import("../events.get")).default;

    const pending = route(event as never);

    emitMutation(4, {
      type: "entity_created",
      entity: {
        id: "entity-1",
      },
    });

    res.close();
    await pending;

    expect(res.headers).toEqual({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    expect(parseEvents(res.chunks)).toEqual([
      {
        channel: "mutation",
        revision: 4,
        type: "entity_created",
        entity: {
          id: "entity-1",
        },
      },
    ]);
  });

  it("streams non-terminal progress from both runtimes and filters terminal events", async () => {
    const { event, res } = createEvent();
    const route = (await import("../events.get")).default;

    const pending = route(event as never);

    emitOrchestratorProgress(7, {
      type: "phase_started",
      phase: "situational-grounding",
      runId: "run-1",
    });
    emitRevalidationProgress(8, {
      type: "phase_activity",
      phase: "assumptions",
      runId: "reval-1",
      kind: "note",
      message: "Revalidating assumptions",
    });
    emitOrchestratorProgress(9, {
      type: "analysis_completed",
      runId: "run-1",
    });
    emitRevalidationProgress(10, {
      type: "analysis_failed",
      runId: "reval-1",
      error: "should not stream",
    });

    res.close();
    await pending;

    expect(parseEvents(res.chunks)).toEqual([
      {
        channel: "progress",
        revision: 7,
        type: "phase_started",
        phase: "situational-grounding",
        runId: "run-1",
      },
      {
        channel: "progress",
        revision: 8,
        type: "phase_activity",
        phase: "assumptions",
        runId: "reval-1",
        kind: "note",
        message: "Revalidating assumptions",
      },
    ]);
  });
});
