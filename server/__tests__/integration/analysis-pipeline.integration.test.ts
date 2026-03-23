/**
 * Integration tests: analysis-service → revision-diff → entity-graph-service.
 *
 * Only the AI adapter is mocked. Everything else runs real:
 * - Zod validation in analysis-service
 * - Entity diffing in revision-diff
 * - Entity storage in entity-graph-service
 * - Runtime status tracking
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetAllServices,
  makeFactOutput,
  getPhaseFixture,
} from "../../__test-utils__/fixtures";
import { createMockRunAnalysisPhase } from "../../__test-utils__/mock-adapter";

// ── Mock ONLY the AI adapters ──

const mockRunAnalysisPhase = createMockRunAnalysisPhase();

vi.mock("../../services/ai/claude-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) =>
    mockRunAnalysisPhase(...(args as [string, string, string, Record<string, unknown>, unknown])),
}));

vi.mock("../../services/ai/codex-adapter", () => ({
  runAnalysisPhase: (...args: unknown[]) =>
    mockRunAnalysisPhase(...(args as [string, string, string, Record<string, unknown>, unknown])),
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

// ── Real imports (loaded after mocks) ──

const { runPhase } = await import("../../services/analysis-service");
const { commitPhaseSnapshot } = await import("../../services/revision-diff");
const entityGraph = await import("../../services/entity-graph-service");

// ── Tests ──

describe("analysis pipeline integration", () => {
  beforeEach(() => {
    resetAllServices();
    entityGraph.newAnalysis("Integration test topic");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("single phase produces entities in the entity graph", async () => {
    const result = await runPhase("situational-grounding", "Steel trade war");

    expect(result.success).toBe(true);
    expect(result.entities.length).toBeGreaterThan(0);

    // Commit to graph
    const commitResult = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "test-run-1",
      entities: result.entities,
      relationships: result.relationships,
    });

    expect(commitResult.status).toBe("applied");

    // Verify entities landed in the graph
    const graphEntities = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    expect(graphEntities.length).toBe(result.entities.length);

    // Verify relationships resolve to real entity IDs
    const analysis = entityGraph.getAnalysis();
    const entityIds = new Set(analysis.entities.map((e) => e.id));
    for (const rel of analysis.relationships) {
      expect(entityIds.has(rel.fromEntityId)).toBe(true);
      expect(entityIds.has(rel.toEntityId)).toBe(true);
    }
  });

  it("two sequential phases with prior context coexist in graph", async () => {
    // Phase 1
    const result1 = await runPhase(
      "situational-grounding",
      "Steel trade war",
    );
    expect(result1.success).toBe(true);
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "test-run-1",
      entities: result1.entities,
      relationships: result1.relationships,
    });

    // Build prior context (as the orchestrator does)
    const phase1Entities = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    const priorContext = JSON.stringify(
      phase1Entities.map((e) => ({ id: e.id, type: e.type, data: e.data })),
    );

    // Phase 2 with prior context
    const result2 = await runPhase(
      "player-identification",
      "Steel trade war",
      { priorEntities: priorContext },
    );
    expect(result2.success).toBe(true);
    commitPhaseSnapshot({
      phase: "player-identification",
      runId: "test-run-1",
      entities: result2.entities,
      relationships: result2.relationships,
    });

    // Both phases' entities should coexist
    const allEntities = entityGraph.getAnalysis().entities;
    const phase1Count = allEntities.filter(
      (e) => e.phase === "situational-grounding",
    ).length;
    const phase2Count = allEntities.filter(
      (e) => e.phase === "player-identification",
    ).length;

    expect(phase1Count).toBe(result1.entities.length);
    expect(phase2Count).toBe(result2.entities.length);
  });

  it("re-run preserves user-edited entities", async () => {
    // Initial run
    const result1 = await runPhase(
      "situational-grounding",
      "Steel trade war",
    );
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "test-run-1",
      entities: result1.entities,
      relationships: result1.relationships,
    });

    const entities = entityGraph.getEntitiesByPhase("situational-grounding");
    expect(entities.length).toBeGreaterThan(0);

    // Mark one entity as user-edited
    const targetEntity = entities[0];
    entityGraph.updateEntity(
      targetEntity.id,
      { rationale: "User's custom rationale" },
      { source: "user-edited", runId: "user" },
    );

    // Re-run the same phase (different run)
    const result2 = await runPhase(
      "situational-grounding",
      "Steel trade war",
    );
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "test-run-2",
      entities: result2.entities,
      relationships: result2.relationships,
    });

    // User-edited entity should survive
    const analysis = entityGraph.getAnalysis();
    const userEntity = analysis.entities.find(
      (e) => e.id === targetEntity.id,
    );
    expect(userEntity).toBeDefined();
    expect(userEntity!.rationale).toBe("User's custom rationale");
    expect(userEntity!.provenance?.source).toBe("user-edited");
  });

  it("truncation detection returns retry_required", async () => {
    // Seed graph with many entities
    const manyFacts = Array.from({ length: 6 }, (_, i) =>
      makeFactOutput({ ref: `fact-${i + 1}`, content: `Fact ${i + 1}` }),
    );
    commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "seed-run",
      entities: manyFacts as any,
      relationships: [],
    });

    const seeded = entityGraph.getEntitiesByPhase("situational-grounding");
    expect(seeded.length).toBe(6);

    // Commit with only 2 entities (< 50% of original 6) triggers truncation detection
    const truncatedEntities = [
      makeFactOutput({ ref: "fact-1", content: "Fact 1" }),
      makeFactOutput({ ref: "fact-2", content: "Fact 2" }),
    ];

    const result = commitPhaseSnapshot({
      phase: "situational-grounding",
      runId: "test-run-2",
      entities: truncatedEntities as any,
      relationships: [],
    });

    expect(result.status).toBe("retry_required");
    if (result.status === "retry_required") {
      expect(result.originalAiEntityCount).toBe(6);
      expect(result.returnedAiEntityCount).toBe(2);
    }
  });

  it("Zod validation rejects malformed entity data", async () => {
    // Create a custom mock that returns an entity missing required fields
    const badMock = vi.fn().mockResolvedValue({
      entities: [
        {
          id: null,
          ref: "bad-fact",
          type: "fact",
          phase: "situational-grounding",
          data: {
            type: "fact",
            // Missing required fields: date, source, content, category
          },
          confidence: "high",
          rationale: "test",
        },
      ],
      relationships: [],
    });

    // Temporarily override the mock
    const origModule = await import("../../services/ai/claude-adapter");
    const origFn = origModule.runAnalysisPhase;
    (origModule as any).runAnalysisPhase = badMock;

    try {
      const result = await runPhase(
        "situational-grounding",
        "Bad data test",
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    } finally {
      (origModule as any).runAnalysisPhase = origFn;
    }
  });

  it("full 3-phase pipeline with graph verification", async () => {
    const phases = [
      "situational-grounding",
      "player-identification",
      "baseline-model",
    ] as const;
    let priorContext: string | undefined;

    for (const phase of phases) {
      const result = await runPhase(phase, "Steel trade war", {
        priorEntities: priorContext,
      });
      expect(result.success).toBe(true);

      const commitResult = commitPhaseSnapshot({
        phase,
        runId: "test-run-1",
        entities: result.entities,
        relationships: result.relationships,
      });
      expect(commitResult.status).toBe("applied");

      // Build prior context for next phase
      const phaseEntities = entityGraph.getEntitiesByPhase(phase);
      priorContext = JSON.stringify(
        phaseEntities.map((e) => ({ id: e.id, type: e.type, data: e.data })),
      );
    }

    // Verify final graph state
    const analysis = entityGraph.getAnalysis();
    const entityIds = new Set(analysis.entities.map((e) => e.id));

    // All phases have entities
    for (const phase of phases) {
      const phaseEntities = analysis.entities.filter(
        (e) => e.phase === phase,
      );
      const expectedFixture = getPhaseFixture(phase);
      expect(phaseEntities.length).toBe(expectedFixture.entities.length);
    }

    // All relationships have valid endpoints
    for (const rel of analysis.relationships) {
      expect(entityIds.has(rel.fromEntityId)).toBe(true);
      expect(entityIds.has(rel.toEntityId)).toBe(true);
    }
  });
});
