// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
} from "@/types/entity";
import type { AnalysisStateResponse, RunStatus } from "../../../../shared/types/api";
import { createValidationRuntimeError } from "../../../../shared/types/runtime-error";

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readyState = 0;
  closed = false;
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static reset(): void {
    MockEventSource.instances = [];
  }

  static latest(): MockEventSource {
    const latest = MockEventSource.instances.at(-1);
    if (!latest) {
      throw new Error("No EventSource instance");
    }
    return latest;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  emitOpen(): void {
    this.readyState = 1;
    this.listeners.get("open")?.forEach((listener) => listener({}));
  }

  emitMessage(payload: unknown): void {
    this.listeners.get("message")?.forEach((listener) =>
      listener({
        data: typeof payload === "string" ? payload : JSON.stringify(payload),
      }),
    );
  }

  emitError(): void {
    this.listeners.get("error")?.forEach((listener) => listener({}));
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeEntity(id: string): AnalysisEntity {
  return {
    id,
    type: "fact",
    phase: "situational-grounding",
    confidence: "medium",
    source: "ai",
    rationale: "",
    revision: 1,
    stale: false,
    data: {
      type: "fact",
      date: "2026-03-20",
      source: "test",
      content: `fact-${id}`,
      category: "action",
    },
    provenance: {
      source: "phase-derived",
      runId: "run-1",
      timestamp: 123,
    },
  };
}

function makeRelationship(
  id: string,
  fromEntityId: string,
  toEntityId: string,
): AnalysisRelationship {
  return {
    id,
    type: "supports",
    fromEntityId,
    toEntityId,
  };
}

function makeAnalysis(entities: AnalysisEntity[] = []): Analysis {
  return {
    id: "analysis-1",
    name: "Topic",
    topic: "Topic",
    entities,
    relationships: [],
    phases: [
      {
        phase: "situational-grounding",
        status: entities.length > 0 ? "complete" : "pending",
        entityIds: entities.map((entity) => entity.id),
      },
      {
        phase: "player-identification",
        status: "pending",
        entityIds: [],
      },
      {
        phase: "baseline-model",
        status: "pending",
        entityIds: [],
      },
    ],
  };
}

function makeRunStatus(overrides: Partial<RunStatus> = {}): RunStatus {
  return {
    status: "idle",
    kind: null,
    runId: null,
    activePhase: null,
    progress: { completed: 0, total: 9 },
    deferredRevalidationPending: false,
    ...overrides,
  };
}

function stateResponse(
  analysis: Analysis,
  runStatus: RunStatus,
  revision: number,
): Response {
  return new Response(
    JSON.stringify({
      analysis,
      runStatus,
      revision,
    } satisfies AnalysisStateResponse),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
}

async function waitFor(assertion: () => void, attempts = 20): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flushMicrotasks();
    }
  }

  throw lastError;
}

async function loadModules() {
  const entityGraphStore = await import("@/stores/entity-graph-store");
  const runStatusStore = await import("@/stores/run-status-store");
  const client = await import("../analysis-client");

  client._resetForTest();
  entityGraphStore.useEntityGraphStore.getState().newAnalysis("");
  runStatusStore.useRunStatusStore.getState().resetForTest();

  return {
    client,
    useEntityGraphStore: entityGraphStore.useEntityGraphStore,
    useRunStatusStore: runStatusStore.useRunStatusStore,
  };
}

describe("analysis-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockEventSource.reset();
    globalThis.EventSource =
      MockEventSource as unknown as typeof globalThis.EventSource;
    globalThis.fetch = originalFetch;
  });

  afterEach(async () => {
    try {
      const client = await import("../analysis-client");
      client._resetForTest();
    } catch {
      // Ignore module reset races when the client was never imported.
    }

    globalThis.fetch = originalFetch;
    if (originalEventSource) {
      globalThis.EventSource = originalEventSource;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).EventSource;
    }
    MockEventSource.reset();
    vi.useRealTimers();
  });

  it("buffers live events during initial recovery and replays newer revisions after the snapshot", async () => {
    const entity = makeEntity("entity-buffered");
    const relationship = makeRelationship("rel-1", entity.id, entity.id);
    const stateRequest = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        return stateRequest.promise;
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    const hydratePromise = client.hydrateAnalysisState();
    const source = MockEventSource.latest();

    source.emitMessage({
      channel: "mutation",
      revision: 2,
      type: "entity_created",
      entity,
    });
    source.emitMessage({
      channel: "mutation",
      revision: 3,
      type: "relationship_created",
      relationship,
    });
    source.emitMessage({
      channel: "progress",
      revision: 4,
      type: "phase_activity",
      phase: "situational-grounding",
      runId: "run-1",
      kind: "note",
      message: "Researching evidence.",
    });

    stateRequest.resolve(
      stateResponse(
        makeAnalysis(),
        makeRunStatus({
          status: "running",
          kind: "analysis",
          runId: "run-1",
          activePhase: "situational-grounding",
        }),
        1,
      ),
    );

    await hydratePromise;

    const state = useEntityGraphStore.getState();
    expect(state.analysis.entities).toEqual([entity]);
    expect(state.analysis.relationships).toEqual([relationship]);
    expect(useRunStatusStore.getState().phaseActivityText).toBe(
      "Researching evidence.",
    );
    expect(useRunStatusStore.getState().connectionState).toBe("CONNECTED");
  });

  it("routes status and progress events through the run-status store and legacy listeners", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        return Promise.resolve(
          stateResponse(makeAnalysis(), makeRunStatus(), 1),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useRunStatusStore } = await loadModules();
    const events: string[] = [];
    const unsubscribe = client.onProgress((event) => {
      events.push(event.type);
    });

    await client.hydrateAnalysisState();

    const source = MockEventSource.latest();
    source.emitOpen();
    source.emitMessage({
      channel: "status",
      revision: 2,
      ...makeRunStatus({
        status: "running",
        kind: "analysis",
        runId: "run-progress",
        activePhase: "situational-grounding",
      }),
    });
    source.emitMessage({
      channel: "progress",
      revision: 3,
      type: "phase_started",
      phase: "situational-grounding",
      runId: "run-progress",
    });
    source.emitMessage({
      channel: "progress",
      revision: 4,
      type: "phase_activity",
      phase: "situational-grounding",
      runId: "run-progress",
      kind: "note",
      message: "Researching evidence.",
    });
    source.emitMessage({
      channel: "progress",
      revision: 5,
      type: "phase_completed",
      phase: "situational-grounding",
      runId: "run-progress",
      summary: {
        entitiesCreated: 0,
        relationshipsCreated: 0,
        entitiesUpdated: 0,
        durationMs: 10,
      },
    });

    unsubscribe();

    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "running",
      kind: "analysis",
      runId: "run-progress",
      activePhase: "situational-grounding",
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBeNull();
    expect(events).toEqual([
      "phase_started",
      "phase_activity",
      "phase_completed",
    ]);
  });

  it("formats WebSearch phase activity using the streamed query", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        return Promise.resolve(
          stateResponse(makeAnalysis(), makeRunStatus(), 1),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();

    const source = MockEventSource.latest();
    source.emitOpen();
    source.emitMessage({
      channel: "progress",
      revision: 2,
      type: "phase_activity",
      phase: "situational-grounding",
      runId: "run-progress",
      kind: "web-search",
      message: "Using WebSearch",
      query: "US China tariff history 2025",
    });

    expect(useRunStatusStore.getState().phaseActivityText).toBe(
      "Using WebSearch: US China tariff history 2025",
    );
  });

  it("re-syncs from /api/ai/state when a state_changed mutation arrives", async () => {
    const entity = makeEntity("entity-state-sync");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        const callCount = fetchMock.mock.calls.filter(
          ([value]) => value === "/api/ai/state",
        ).length;
        return Promise.resolve(
          callCount === 1
            ? stateResponse(makeAnalysis(), makeRunStatus(), 1)
            : stateResponse(
                makeAnalysis([entity]),
                makeRunStatus({
                  status: "failed",
                  kind: "analysis",
                  runId: "run-2",
                  failedPhase: "situational-grounding",
                  failure: createValidationRuntimeError("Validation failed", {
                    provider: "claude",
                    retryable: false,
                  }),
                }),
                5,
              ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    await client.hydrateAnalysisState();

    const source = MockEventSource.latest();
    source.emitMessage({
      channel: "progress",
      revision: 2,
      type: "phase_activity",
      phase: "situational-grounding",
      runId: "run-2",
      kind: "note",
      message: "Researching evidence.",
    });
    source.emitMessage({
      channel: "mutation",
      revision: 3,
      type: "state_changed",
    });

    await waitFor(() => {
      expect(useEntityGraphStore.getState().analysis.entities).toEqual([entity]);
    });

    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "failed",
      failedPhase: "situational-grounding",
      failure: expect.objectContaining({ tag: "validation" }),
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBeNull();
  });

  it("recycles the EventSource and recovers on heartbeat timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        const callCount = fetchMock.mock.calls.filter(
          ([value]) => value === "/api/ai/state",
        ).length;
        return Promise.resolve(
          callCount === 1
            ? stateResponse(
                makeAnalysis(),
                makeRunStatus({
                  status: "running",
                  kind: "analysis",
                  runId: "run-heartbeat",
                }),
                1,
              )
            : stateResponse(
                makeAnalysis([makeEntity("entity-recovered")]),
                makeRunStatus(),
                2,
              ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();
    const firstSource = MockEventSource.latest();
    firstSource.emitOpen();

    vi.setSystemTime(Date.now() + 31_000);
    await advanceTimersByTimeAsync(31_000);
    await vi.runOnlyPendingTimersAsync();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(2);
    });

    expect(firstSource.closed).toBe(true);
    expect(firstSource.listenerCount("open")).toBe(0);
    expect(firstSource.listenerCount("message")).toBe(0);
    expect(firstSource.listenerCount("error")).toBe(0);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/state");
    expect(useRunStatusStore.getState().connectionState).toBe("CONNECTED");
  });

  it("includes full runtime overrides in the analyze request body when provided", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/analyze") {
        return Promise.resolve(
          new Response(JSON.stringify({ runId: "run-runtime" }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (input === "/api/ai/state") {
        return Promise.resolve(stateResponse(makeAnalysis(), makeRunStatus(), 1));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client } = await loadModules();

    await expect(
      client.startAnalysis("Topic", "openai", "gpt-5.4", {
        webSearch: false,
        effortLevel: "thorough",
        activePhases: ["situational-grounding", "scenarios"],
      }),
    ).resolves.toEqual({ runId: "run-runtime" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          topic: "Topic",
          provider: "openai",
          model: "gpt-5.4",
          runtime: {
            webSearch: false,
            effortLevel: "thorough",
            activePhases: ["situational-grounding", "scenarios"],
          },
        }),
      }),
    );
  });

  it("rejects non-JSON analyze responses", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/analyze") {
        return Promise.resolve(
          new Response("accepted", {
            status: 202,
            headers: { "Content-Type": "text/plain" },
          }),
        );
      }
      if (input === "/api/ai/state") {
        return Promise.resolve(stateResponse(makeAnalysis(), makeRunStatus(), 1));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client } = await loadModules();

    await expect(client.startAnalysis("Topic")).rejects.toThrow(
      /non-JSON|runId/i,
    );
  });

  it("sends a best-effort abort request and marks local running state as cancelled", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        return Promise.resolve(
          stateResponse(
            makeAnalysis(),
            makeRunStatus({
              status: "running",
              kind: "analysis",
              runId: "run-4",
              activePhase: "situational-grounding",
            }),
            1,
          ),
        );
      }
      if (input === "/api/ai/abort") {
        return Promise.resolve(
          new Response(JSON.stringify({ aborted: true }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();
    expect(client.isRunning()).toBe(true);

    useRunStatusStore.getState().setPhaseActivityText("Working");
    client.abort();
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenLastCalledWith("/api/ai/abort", {
      method: "POST",
    });
    expect(client.isRunning()).toBe(false);
    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "cancelled",
      kind: "analysis",
      runId: "run-4",
      activePhase: null,
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBeNull();
  });

  it("leaves revalidation runs untouched when abort cannot stop them server-side", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        return Promise.resolve(
          stateResponse(
            makeAnalysis(),
            makeRunStatus({
              status: "running",
              kind: "revalidation",
              runId: "run-revalidation",
              activePhase: "player-identification",
            }),
            1,
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();
    useRunStatusStore.getState().setPhaseActivityText("Still revalidating");

    client.abort();
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.isRunning()).toBe(true);
    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "running",
      kind: "revalidation",
      runId: "run-revalidation",
      activePhase: "player-identification",
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBe(
      "Still revalidating",
    );
  });

  it("keeps retrying recovery after hitting the disconnected threshold", async () => {
    vi.useFakeTimers();
    const recoveredEntity = makeEntity("entity-recovered-after-disconnect");
    let stateAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input === "/api/ai/state") {
        stateAttempts += 1;
        if (stateAttempts <= 5) {
          return Promise.reject(new Error(`state failed ${stateAttempts}`));
        }
        return Promise.resolve(
          stateResponse(makeAnalysis([recoveredEntity]), makeRunStatus(), 6),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    await expect(client.hydrateAnalysisState()).rejects.toThrow("state failed 1");

    for (const delayMs of [1_000, 2_000, 4_000, 8_000]) {
      await advanceTimersByTimeAsync(delayMs);
      await flushMicrotasks();
    }

    expect(useRunStatusStore.getState().connectionState).toBe("DISCONNECTED");

    await advanceTimersByTimeAsync(16_000);
    await flushMicrotasks();

    await waitFor(() => {
      expect(useRunStatusStore.getState().connectionState).toBe("CONNECTED");
      expect(useEntityGraphStore.getState().analysis.entities).toEqual([
        recoveredEntity,
      ]);
    });
  });
});
