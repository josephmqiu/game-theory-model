// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Analysis,
  AnalysisEntity,
  AnalysisRelationship,
} from "@/types/entity";
import type {
  AnalysisStateResponse,
  RunStatus,
} from "../../../../shared/types/api";
import type {
  WorkspaceRuntimeBootstrapEnvelope,
  WorkspaceRuntimePushEnvelope,
} from "../../../../shared/types/workspace-runtime";
import { createValidationRuntimeError } from "../../../../shared/types/runtime-error";

const originalFetch = globalThis.fetch;

// Mock workspace-runtime-client — capture the subscribe listener so tests can
// simulate WebSocket push and bootstrap events.

type RuntimeListener = (
  envelope: WorkspaceRuntimeBootstrapEnvelope | WorkspaceRuntimePushEnvelope,
) => void;

let wsListener: RuntimeListener | null = null;
const unsubscribeSpy = vi.fn(() => {
  wsListener = null;
});
const sendRequestMock = vi.fn();

vi.mock("../workspace-runtime-client", () => ({
  workspaceRuntimeClient: {
    subscribe: (listener: RuntimeListener) => {
      wsListener = listener;
      return unsubscribeSpy;
    },
    sendRequest: (...args: unknown[]) => sendRequestMock(...args),
    getDiagnostics: () => [],
    resetForTest: vi.fn(),
  },
}));

function emitWsPush(envelope: WorkspaceRuntimePushEnvelope): void {
  if (!wsListener) {
    throw new Error(
      "No WS listener registered — call hydrateAnalysisState first",
    );
  }
  wsListener(envelope);
}

function emitWsBootstrap(): void {
  if (!wsListener) {
    throw new Error(
      "No WS listener registered — call hydrateAnalysisState first",
    );
  }
  wsListener({
    type: "bootstrap",
    payload: {
      workspaceId: "ws-1",
      threads: [],
      activeThreadDetail: null,
      latestRun: null,
      latestPhaseTurns: [],
      topicRevisions: {},
      serverConnectionId: "conn-1",
    },
  } satisfies WorkspaceRuntimeBootstrapEnvelope);
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

function createAnalysisStateResponse(
  analysis: Analysis,
  runStatus: RunStatus,
  revision: number,
): AnalysisStateResponse {
  return {
    analysis,
    runStatus,
    revision,
  };
}

function mockAnalysisStateResponses(...responses: AnalysisStateResponse[]): void {
  sendRequestMock.mockImplementation(async (kind: string, payload: unknown) => {
    if (kind !== "analysis.state.get") {
      throw new Error(`Unexpected request kind: ${kind}`);
    }

    expect(payload).toEqual({ workspaceId: "ws-1" });

    const next = responses.shift();
    if (!next) {
      throw new Error("No mocked analysis.state.get response remaining");
    }

    return next;
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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
  const threadStore = await import("@/stores/thread-store");
  const client = await import("../analysis-client");

  client._resetForTest();
  entityGraphStore.useEntityGraphStore.getState().newAnalysis("");
  runStatusStore.useRunStatusStore.getState().resetForTest();
  threadStore.useThreadStore.setState({
    workspaceId: "ws-1",
    activeThreadId: undefined,
    activeThreadDetail: null,
    threads: [],
    latestRun: null,
    latestPhaseTurns: [],
    pendingTurn: null,
    pendingInteractions: [],
    activeInteractionIndex: 0,
    isLoading: false,
    isCreating: false,
    isDeleting: false,
    error: undefined,
  });

  return {
    client,
    useEntityGraphStore: entityGraphStore.useEntityGraphStore,
    useRunStatusStore: runStatusStore.useRunStatusStore,
  };
}

describe("analysis-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    wsListener = null;
    unsubscribeSpy.mockClear();
    sendRequestMock.mockReset();
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
    wsListener = null;
  });

  it("drops WS events before hydration and applies events after", async () => {
    const entity = makeEntity("entity-after-hydrate");
    const relationship = makeRelationship("rel-1", entity.id, entity.id);
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
    );

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    await client.hydrateAnalysisState();
    expect(useRunStatusStore.getState().connectionState).toBe("CONNECTED");

    // Events after hydration should be applied
    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 2,
      scope: { workspaceId: "ws-1" },
      event: { kind: "analysis.mutation", event: { type: "entity_created", entity } },
    });
    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 3,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.mutation",
        event: { type: "relationship_created", relationship },
      },
    });

    const state = useEntityGraphStore.getState();
    expect(state.analysis.entities).toEqual([entity]);
    expect(state.analysis.relationships).toEqual([relationship]);
  });

  it("routes status and progress events through the run-status store and legacy listeners", async () => {
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
    );

    const { client, useRunStatusStore } = await loadModules();
    const events: string[] = [];
    const unsubscribe = client.onProgress((event) => {
      events.push(event.type);
    });

    await client.hydrateAnalysisState();

    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 2,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.status",
        runStatus: makeRunStatus({
          status: "running",
          kind: "analysis",
          runId: "run-progress",
          activePhase: "situational-grounding",
        }),
      },
    });
    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 3,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.progress",
        event: {
          type: "phase_started",
          phase: "situational-grounding",
          runId: "run-progress",
        },
      },
    });
    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 4,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.progress",
        event: {
          type: "phase_activity",
          phase: "situational-grounding",
          runId: "run-progress",
          kind: "note",
          message: "Researching evidence.",
        },
      },
    });
    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 5,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.progress",
        event: {
          type: "phase_completed",
          phase: "situational-grounding",
          runId: "run-progress",
          summary: {
            entitiesCreated: 0,
            relationshipsCreated: 0,
            entitiesUpdated: 0,
            durationMs: 10,
          },
        },
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
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
    );

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();

    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 2,
      scope: { workspaceId: "ws-1" },
      event: {
        kind: "analysis.progress",
        event: {
          type: "phase_activity",
          phase: "situational-grounding",
          runId: "run-progress",
          kind: "web-search",
          message: "Using WebSearch",
          query: "US China tariff history 2025",
        },
      },
    });

    expect(useRunStatusStore.getState().phaseActivityText).toBe(
      "Using WebSearch: US China tariff history 2025",
    );
  });

  it("re-syncs from analysis.state.get when a state_changed mutation arrives", async () => {
    const entity = makeEntity("entity-state-sync");
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
      createAnalysisStateResponse(
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

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    await client.hydrateAnalysisState();

    emitWsPush({
      type: "push",
      topic: "analysis",
      revision: 3,
      scope: { workspaceId: "ws-1" },
      event: { kind: "analysis.mutation", event: { type: "state_changed" } },
    });

    await waitFor(() => {
      expect(useEntityGraphStore.getState().analysis.entities).toEqual([
        entity,
      ]);
    });

    expect(useRunStatusStore.getState().runStatus).toMatchObject({
      status: "failed",
      failedPhase: "situational-grounding",
      failure: expect.objectContaining({ tag: "validation" }),
    });
    expect(useRunStatusStore.getState().phaseActivityText).toBeNull();
  });

  it("re-hydrates analysis state on WS reconnect (bootstrap event)", async () => {
    const entity = makeEntity("entity-reconnect");
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
      createAnalysisStateResponse(makeAnalysis([entity]), makeRunStatus(), 2),
    );

    const { client, useEntityGraphStore, useRunStatusStore } =
      await loadModules();

    await client.hydrateAnalysisState();
    expect(useEntityGraphStore.getState().analysis.entities).toEqual([]);

    // Simulate WS reconnect
    emitWsBootstrap();

    await waitFor(() => {
      expect(useEntityGraphStore.getState().analysis.entities).toEqual([
        entity,
      ]);
    });
    expect(useRunStatusStore.getState().connectionState).toBe("CONNECTED");
  });

  it("includes full runtime overrides in the analyze request body when provided", async () => {
    sendRequestMock.mockResolvedValueOnce({ runId: "run-runtime" });

    const { client } = await loadModules();

    await expect(
      client.startAnalysis("Topic", "codex", "gpt-5.4", {
        webSearch: false,
        effortLevel: "thorough",
        activePhases: ["situational-grounding", "scenarios"],
      }),
    ).resolves.toEqual({ runId: "run-runtime" });

    expect(sendRequestMock).toHaveBeenCalledWith(
      "analysis.start",
      expect.objectContaining({
        workspaceId: "ws-1",
        topic: "Topic",
        provider: "codex",
        model: "gpt-5.4",
        runtime: {
          webSearch: false,
          effortLevel: "thorough",
          activePhases: ["situational-grounding", "scenarios"],
        },
      }),
    );
  });

  it("rejects analyze responses without a runId", async () => {
    sendRequestMock.mockResolvedValueOnce({});

    const { client } = await loadModules();

    await expect(client.startAnalysis("Topic")).rejects.toThrow(/runId/i);
  });

  it("sends a best-effort abort request and marks local running state as cancelled", async () => {
    const hydrationResponse = createAnalysisStateResponse(
      makeAnalysis(),
      makeRunStatus({
        status: "running",
        kind: "analysis",
        runId: "run-4",
        activePhase: "situational-grounding",
      }),
      1,
    );
    sendRequestMock.mockImplementation(async (kind: string, payload: unknown) => {
      if (kind === "analysis.state.get") {
        expect(payload).toEqual({ workspaceId: "ws-1" });
        return hydrationResponse;
      }
      if (kind === "analysis.abort") {
        expect(payload).toEqual({ workspaceId: "ws-1" });
        return { aborted: true };
      }
      throw new Error(`Unexpected request kind: ${kind}`);
    });

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();
    expect(client.isRunning()).toBe(true);

    useRunStatusStore.getState().setPhaseActivityText("Working");
    client.abort();
    await flushMicrotasks();

    expect(sendRequestMock).toHaveBeenLastCalledWith("analysis.abort", {
      workspaceId: "ws-1",
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
    mockAnalysisStateResponses(
      createAnalysisStateResponse(
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

    const { client, useRunStatusStore } = await loadModules();

    await client.hydrateAnalysisState();
    useRunStatusStore.getState().setPhaseActivityText("Still revalidating");

    client.abort();
    await flushMicrotasks();

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

  it("cleans up WS subscription on _resetForTest", async () => {
    mockAnalysisStateResponses(
      createAnalysisStateResponse(makeAnalysis(), makeRunStatus(), 1),
    );

    const { client } = await loadModules();
    await client.hydrateAnalysisState();
    expect(wsListener).not.toBeNull();

    client._resetForTest();
    expect(unsubscribeSpy).toHaveBeenCalled();
  });
});
