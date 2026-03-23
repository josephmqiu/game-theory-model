/**
 * Integration tests: revalidation-service → entity-graph-service → runtime-status.
 *
 * Tests the revalidation state management and deferred invalidation.
 * Only the AI adapter is mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAllServices, makeFactOutput } from "../../__test-utils__/fixtures";

// Mock AI adapter
vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
  }),
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: vi.fn().mockResolvedValue({
    entities: [],
    relationships: [],
  }),
}));

// Suppress logger output
vi.mock("../../utils/ai-logger", () => ({
  createRunLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
    entries: () => [],
  }),
  timer: () => ({ elapsed: () => 0 }),
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

// ── Real imports ──

const entityGraph = await import("../../services/entity-graph-service");
const runtimeStatus = await import("../../services/runtime-status");
const revalidationService = await import(
  "../../services/revalidation-service"
);
const { commitPhaseSnapshot } = await import("../../services/revision-diff");

describe("revalidation integration", () => {
  beforeEach(() => {
    resetAllServices();
    entityGraph.newAnalysis("Revalidation test");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("markStale on entity makes it available for revalidation", () => {
    // Seed graph with entities
    const entities = [
      makeFactOutput({ ref: "fact-1", content: "Fact 1" }),
      makeFactOutput({ ref: "fact-2", content: "Fact 2" }),
    ];
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "seed-run",
      entities: entities as any,
      relationships: [],
    });

    const graphEntities = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    expect(graphEntities.length).toBe(2);

    // Mark one entity as stale
    const entityId = graphEntities[0].id;
    entityGraph.markStale([entityId]);

    // Verify stale tracking
    const staleIds = entityGraph.getStaleEntityIds();
    expect(staleIds).toContain(entityId);
  });

  it("deferRevalidation queues stale IDs during active analysis", () => {
    // Simulate an active analysis run
    runtimeStatus.acquireRun("analysis", "run-1", { totalPhases: 3 });

    // Defer revalidation during the run
    runtimeStatus.deferRevalidation(["entity-1", "entity-2"]);

    // Should be deferred, not pending
    const snapshot = runtimeStatus.getSnapshot();
    expect(snapshot.deferredRevalidationPending).toBe(false);

    // Deferred IDs should be stored
    expect(runtimeStatus.hasDeferredRevalidationIds()).toBe(true);
    expect(runtimeStatus.getDeferredRevalidationIds()).toEqual(
      expect.arrayContaining(["entity-1", "entity-2"]),
    );
  });

  it("consumeDeferredRevalidationIds returns and clears IDs", () => {
    runtimeStatus.acquireRun("analysis", "run-1", { totalPhases: 1 });
    runtimeStatus.deferRevalidation(["entity-1", "entity-2"]);
    runtimeStatus.releaseRun("run-1", "completed");

    // Consume the deferred IDs
    const consumed = runtimeStatus.consumeDeferredRevalidationIds();
    expect(consumed).toEqual(
      expect.arrayContaining(["entity-1", "entity-2"]),
    );

    // Should be cleared after consumption
    expect(runtimeStatus.getDeferredRevalidationIds()).toEqual([]);
    expect(runtimeStatus.hasDeferredRevalidationIds()).toBe(false);
  });

  it("getDownstreamEntityIds returns BFS traversal of related entities", () => {
    // Create entities first without relationships
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "seed-run",
      entities: [
        makeFactOutput({ ref: "fact-1", content: "Root fact" }),
        makeFactOutput({ ref: "fact-2", content: "Downstream fact" }),
      ] as any,
      relationships: [
        {
          id: "rel-1",
          type: "depends-on" as const, // "downstream" category — BFS traverses these
          fromEntityId: "fact-1", // refs resolved by commitPhaseSnapshot
          toEntityId: "fact-2",
        },
      ],
    });

    const graphEntities = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    expect(graphEntities.length).toBe(2);

    // Find entities by content
    const rootEntity = graphEntities.find(
      (e) => (e.data as any).content === "Root fact",
    );
    const downstreamEntity = graphEntities.find(
      (e) => (e.data as any).content === "Downstream fact",
    );
    expect(rootEntity).toBeDefined();
    expect(downstreamEntity).toBeDefined();

    // Verify relationship was created
    const analysis = entityGraph.getAnalysis();
    expect(analysis.relationships.length).toBe(1);
    expect(analysis.relationships[0].fromEntityId).toBe(rootEntity!.id);
    expect(analysis.relationships[0].toEntityId).toBe(downstreamEntity!.id);

    // Get downstream from root
    const downstream = entityGraph.getDownstreamEntityIds(rootEntity!.id);
    expect(downstream).toContain(downstreamEntity!.id);
  });

  it("runtime-status tracks revalidation run lifecycle", () => {
    // Acquire a revalidation run
    const acquired = runtimeStatus.acquireRun("revalidation", "reval-1", {
      totalPhases: 2,
    });
    expect(acquired).toBe(true);

    const snapshot = runtimeStatus.getSnapshot();
    expect(snapshot.status).toBe("running");
    expect(snapshot.kind).toBe("revalidation");
    expect(snapshot.runId).toBe("reval-1");
    expect(snapshot.progress.total).toBe(2);

    // Complete the run
    runtimeStatus.releaseRun("reval-1", "completed");
    const final = runtimeStatus.getSnapshot();
    expect(final.status).toBe("idle");
  });

  it("dismiss clears terminal status", () => {
    // Create a failed run
    runtimeStatus.acquireRun("analysis", "run-1", { totalPhases: 1 });
    runtimeStatus.releaseRun("run-1", "failed", {
      failedPhase: "situational-grounding",
      failureMessage: "Test failure",
    });

    expect(runtimeStatus.getSnapshot().status).toBe("failed");

    // Dismiss it
    const dismissResult = runtimeStatus.dismiss("run-1");
    expect(dismissResult).toEqual(
      expect.objectContaining({ dismissed: true }),
    );

    const snapshot = runtimeStatus.getSnapshot();
    expect(snapshot.status).toBe("idle");
  });
});
