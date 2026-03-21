import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Analysis, AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { AnalysisStateResponse } from "../../../../shared/types/api";

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
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies mutation events incrementally during analysis", async () => {
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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

  it("re-syncs from /api/ai/state when a state_changed mutation arrives", async () => {
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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
            progress: { completed: 1, total: 3 },
          },
        } satisfies AnalysisStateResponse),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");

    useEntityGraphStore.getState().newAnalysis("Topic");
    await client.startAnalysis("Topic");
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/state");
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([entity]);
  });

  it("hydrates and polls /api/ai/state while a recovered run is still active", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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
              progress: { completed: 0, total: 3 },
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
              progress: { completed: 1, total: 3 },
            },
          } satisfies AnalysisStateResponse),
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const { useEntityGraphStore } = await import("@/stores/entity-graph-store");
    const client = await import("../analysis-client");

    await client.hydrateAnalysisState({ enableRecoveryPolling: true });
    expect(client.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(2_000);
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.isRunning()).toBe(false);
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([
      recoveredEntity,
    ]);
  });

  it("sends a best-effort abort request and clears local running state", async () => {
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            analysis: makeAnalysis(),
            runStatus: {
              status: "running",
              runId: "run-4",
              activePhase: "situational-grounding",
              progress: { completed: 0, total: 3 },
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

    await client.hydrateAnalysisState({ enableRecoveryPolling: false });
    expect(client.isRunning()).toBe(true);

    client.abort();
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenLastCalledWith("/api/ai/abort", {
      method: "POST",
    });
    expect(client.isRunning()).toBe(false);
  });
});
