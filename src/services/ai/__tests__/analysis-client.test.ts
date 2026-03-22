import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis, AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { AnalysisStateResponse } from "../../../../shared/types/api";

const originalFetch = globalThis.fetch;

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
        status: "pending",
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

function sseResponse(events: unknown[]): Response {
  const body = `${events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("")}`;
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("analysis-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("applies mutation events incrementally during analysis", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const entity = makeEntity("entity-1");
    const relationship = makeRelationship("rel-1", entity.id, entity.id);

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-1" },
        { channel: "progress", type: "phase_started", phase: "situational-grounding", runId: "run-1" },
        { channel: "mutation", type: "entity_created", entity },
        { channel: "mutation", type: "relationship_created", relationship },
        {
          channel: "progress",
          type: "phase_completed",
          phase: "situational-grounding",
          runId: "run-1",
          summary: {
            entitiesCreated: 1,
            relationshipsCreated: 1,
            entitiesUpdated: 0,
            durationMs: 10,
          },
        },
        { channel: "progress", type: "analysis_completed", runId: "run-1" },
        { type: "done" },
      ]),
    );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");
    client._resetForTest();

    useEntityGraphStore.getState().newAnalysis("Topic");
    await client.startAnalysis("Topic");

    const state = useEntityGraphStore.getState();
    expect(state.analysis.entities).toEqual([entity]);
    expect(state.analysis.relationships).toEqual([relationship]);
    expect(state.layout[entity.id]).toEqual({ x: 100, y: 0, pinned: false });
    expect(
      state.analysis.phases.find((phase) => phase.phase === "situational-grounding")
        ?.status,
    ).toBe("complete");
  });

  it("forwards phase activity progress events without affecting completion flow", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-activity" },
        {
          channel: "progress",
          type: "phase_started",
          phase: "situational-grounding",
          runId: "run-activity",
        },
        {
          channel: "progress",
          type: "phase_activity",
          phase: "situational-grounding",
          runId: "run-activity",
          kind: "researching",
          message: "Researching evidence.",
        },
        {
          channel: "progress",
          type: "phase_completed",
          phase: "situational-grounding",
          runId: "run-activity",
          summary: {
            entitiesCreated: 0,
            relationshipsCreated: 0,
            entitiesUpdated: 0,
            durationMs: 10,
          },
        },
        {
          channel: "progress",
          type: "analysis_completed",
          runId: "run-activity",
        },
        { type: "done" },
      ]),
    );

    const events: Array<{ type: string }> = [];
    const client = await import("../analysis-client");
    client._resetForTest();
    const unsubscribe = client.onProgress((event) => {
      events.push(event);
    });

    await client.startAnalysis("Topic");
    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "phase_activity",
          kind: "researching",
          message: "Researching evidence.",
        }),
      ]),
    );
  });

  it("includes full runtime overrides in the analyze request body when provided", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-runtime" },
        { channel: "progress", type: "analysis_completed", runId: "run-runtime" },
        { type: "done" },
      ]),
    );

    const client = await import("../analysis-client");
    client._resetForTest();

    await client.startAnalysis("Topic", "openai", "gpt-5.4", {
      webSearch: false,
      effortLevel: "thorough",
      activePhases: ["situational-grounding", "scenarios"],
    });

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

  it("omits runtime from the analyze request body when not provided", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-no-runtime" },
        {
          channel: "progress",
          type: "analysis_completed",
          runId: "run-no-runtime",
        },
        { type: "done" },
      ]),
    );

    const client = await import("../analysis-client");
    client._resetForTest();

    await client.startAnalysis("Topic");

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      topic: "Topic",
    });
  });

  it("upserts later runnable phases from SSE progress events", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-late-phase" },
        {
          channel: "progress",
          type: "phase_started",
          phase: "meta-check",
          runId: "run-late-phase",
        },
        {
          channel: "progress",
          type: "phase_completed",
          phase: "meta-check",
          runId: "run-late-phase",
          summary: {
            entitiesCreated: 0,
            relationshipsCreated: 0,
            entitiesUpdated: 0,
            durationMs: 10,
          },
        },
        {
          channel: "progress",
          type: "analysis_completed",
          runId: "run-late-phase",
        },
        { type: "done" },
      ]),
    );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");
    client._resetForTest();

    useEntityGraphStore.getState().newAnalysis("Topic");
    await client.startAnalysis("Topic");

    const state = useEntityGraphStore.getState();
    expect(
      state.analysis.phases.find((phase) => phase.phase === "meta-check")
        ?.status,
    ).toBe("complete");
  });

  it("re-syncs from /api/ai/state when a state_changed mutation arrives", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const entity = makeEntity("entity-state-sync");

    fetchMock.mockResolvedValueOnce(
      sseResponse([
        { channel: "started", runId: "run-2" },
        { channel: "mutation", type: "state_changed" },
        { channel: "progress", type: "analysis_completed", runId: "run-2" },
        { type: "done" },
      ]),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          analysis: makeAnalysis([entity]),
          runStatus: {
            status: "idle",
            runId: null,
            activePhase: null,
            progress: { completed: 1, total: 9 },
          },
        } satisfies AnalysisStateResponse),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");
    client._resetForTest();

    useEntityGraphStore.getState().newAnalysis("Topic");
    await client.startAnalysis("Topic");
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/state");
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([entity]);
  });

  it("hydrates and polls /api/ai/state while a recovered run is still active", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const recoveredEntity = makeEntity("entity-recovered");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis(),
            runStatus: {
              status: "running",
              runId: "run-3",
              activePhase: "situational-grounding",
              progress: { completed: 0, total: 9 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis([recoveredEntity]),
            runStatus: {
              status: "idle",
              runId: null,
              activePhase: null,
              progress: { completed: 1, total: 9 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");
    client._resetForTest();

    await client.hydrateAnalysisState({ enableRecoveryPolling: true });
    expect(client.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.isRunning()).toBe(false);
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([
      recoveredEntity,
    ]);
  });

  it("recovers from /api/ai/state when the SSE stream ends before terminal progress", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const recoveredEntity = makeEntity("entity-after-stream-end");

    fetchMock
      .mockResolvedValueOnce(
        sseResponse([
          { channel: "started", runId: "run-stream-end" },
          {
            channel: "progress",
            type: "phase_started",
            phase: "situational-grounding",
            runId: "run-stream-end",
          },
          { type: "done" },
        ]),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis(),
            runStatus: {
              status: "running",
              runId: "run-stream-end",
              activePhase: "situational-grounding",
              progress: { completed: 0, total: 9 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis([recoveredEntity]),
            runStatus: {
              status: "idle",
              runId: null,
              activePhase: null,
              progress: { completed: 1, total: 9 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");
    client._resetForTest();

    useEntityGraphStore.getState().newAnalysis("Topic");
    await client.startAnalysis("Topic");

    expect(client.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(4_000);

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/ai/state");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/ai/state");
    expect(client.isRunning()).toBe(false);
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([
      recoveredEntity,
    ]);
  });

  it("sends a best-effort abort request and clears local running state", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis(),
            runStatus: {
              status: "running",
              runId: "run-4",
              activePhase: "situational-grounding",
              progress: { completed: 0, total: 9 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ aborted: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = await import("../analysis-client");
    client._resetForTest();

    await client.hydrateAnalysisState({ enableRecoveryPolling: false });
    expect(client.isRunning()).toBe(true);

    client.abort();
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenLastCalledWith("/api/ai/abort", {
      method: "POST",
    });
    expect(client.isRunning()).toBe(false);
  });

  it("does not start recovery polling after an explicit abort", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (input === "/api/ai/analyze") {
          return new Promise((_, reject) => {
            const signal = init?.signal;
            if (!(signal instanceof AbortSignal)) {
              reject(new Error("missing signal"));
              return;
            }
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          });
        }

        if (input === "/api/ai/abort") {
          return Promise.resolve(
            new Response(JSON.stringify({ aborted: true }), {
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = await import("../analysis-client");
    client._resetForTest();

    const analysisPromise = client.startAnalysis("Topic");
    await flushMicrotasks();
    expect(client.isRunning()).toBe(true);

    client.abort();

    await expect(analysisPromise).resolves.toEqual({ runId: "" });
    await vi.advanceTimersByTimeAsync(4_000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/ai/abort", {
      method: "POST",
    });
    expect(client.isRunning()).toBe(false);
  });
});
