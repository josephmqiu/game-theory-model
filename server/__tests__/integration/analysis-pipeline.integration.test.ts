/**
 * Integration tests: entity graph operations via revision-diff transactions.
 *
 * Tests that the entity graph correctly handles multi-phase entity creation,
 * user-edited entity preservation, and phase transactions.
 *
 * Note: runPhase() is a thin wrapper that delegates to runPhaseWithTools(),
 * which uses the Agent SDK. The orchestrator-pipeline integration tests
 * cover the full end-to-end flow. These tests focus on the entity graph
 * and revision-diff behavior directly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import {
  resetAllServices,
  PHASE_FIXTURES,
} from "../../__test-utils__/fixtures";

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
const revisionDiff = await import("../../services/revision-diff");

/**
 * Simulate what tool handlers do during a phase: create entities and
 * relationships in the entity graph within a revision-diff transaction.
 */
function simulatePhaseExecution(
  phase: MethodologyPhase,
  runId: string,
): { entitiesCreated: number; relationshipsCreated: number } {
  const fixture = PHASE_FIXTURES[phase];
  if (!fixture) return { entitiesCreated: 0, relationshipsCreated: 0 };

  for (const entity of fixture.entities) {
    entityGraph.createEntity(
      {
        type: (entity as any).type,
        phase,
        data: (entity as any).data,
        confidence: (entity as any).confidence,
        rationale: (entity as any).rationale,
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId, phase },
    );
  }

  // Create relationships with resolved entity IDs
  const graphEntities = entityGraph.getEntitiesByPhase(phase);
  for (const rel of fixture.relationships) {
    const fromIdx = fixture.entities.findIndex(
      (e: any) => e.ref === (rel as any).fromEntityId,
    );
    const toIdx = fixture.entities.findIndex(
      (e: any) => e.ref === (rel as any).toEntityId,
    );
    if (
      fromIdx >= 0 &&
      toIdx >= 0 &&
      graphEntities[fromIdx] &&
      graphEntities[toIdx]
    ) {
      entityGraph.createRelationship(
        {
          type: (rel as any).type,
          fromEntityId: graphEntities[fromIdx].id,
          toEntityId: graphEntities[toIdx].id,
        },
        { source: "phase-derived", runId, phase },
      );
    }
  }

  return {
    entitiesCreated: fixture.entities.length,
    relationshipsCreated: fixture.relationships.length,
  };
}

// ── Tests ──

describe("analysis pipeline integration", () => {
  beforeEach(async () => {
    await resetAllServices();
    entityGraph.newAnalysis("Integration test topic");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("single phase produces entities in the entity graph via transaction", () => {
    const runId = "test-run-1";
    revisionDiff.beginPhaseTransaction("situational-grounding", runId);
    simulatePhaseExecution("situational-grounding", runId);
    revisionDiff.commitPhaseTransaction();

    const graphEntities = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    const fixture = PHASE_FIXTURES["situational-grounding"]!;
    expect(graphEntities.length).toBe(fixture.entities.length);

    // Verify relationships resolve to real entity IDs
    const analysis = entityGraph.getAnalysis();
    const entityIds = new Set(analysis.entities.map((e) => e.id));
    for (const rel of analysis.relationships) {
      expect(entityIds.has(rel.fromEntityId)).toBe(true);
      expect(entityIds.has(rel.toEntityId)).toBe(true);
    }
  });

  it("two sequential phases with prior context coexist in graph", () => {
    const runId = "test-run-1";

    revisionDiff.beginPhaseTransaction("situational-grounding", runId);
    simulatePhaseExecution("situational-grounding", runId);
    revisionDiff.commitPhaseTransaction();

    revisionDiff.beginPhaseTransaction("player-identification", runId);
    simulatePhaseExecution("player-identification", runId);
    revisionDiff.commitPhaseTransaction();

    const allEntities = entityGraph.getAnalysis().entities;
    const phase1Count = allEntities.filter(
      (e) => e.phase === "situational-grounding",
    ).length;
    const phase2Count = allEntities.filter(
      (e) => e.phase === "player-identification",
    ).length;

    expect(phase1Count).toBe(
      PHASE_FIXTURES["situational-grounding"]!.entities.length,
    );
    expect(phase2Count).toBe(
      PHASE_FIXTURES["player-identification"]!.entities.length,
    );
  });

  it("re-run preserves user-edited entities", () => {
    const runId = "test-run-1";

    // First run
    revisionDiff.beginPhaseTransaction("situational-grounding", runId);
    simulatePhaseExecution("situational-grounding", runId);
    revisionDiff.commitPhaseTransaction();

    const entities = entityGraph.getEntitiesByPhase("situational-grounding");
    expect(entities.length).toBeGreaterThan(0);

    // Mark one entity as user-edited
    const targetEntity = entities[0];
    entityGraph.updateEntity(
      targetEntity.id,
      { rationale: "User's custom rationale" },
      { source: "user-edited", runId: "user" },
    );

    // Re-run the same phase (new transaction)
    revisionDiff.beginPhaseTransaction("situational-grounding", "test-run-2");
    simulatePhaseExecution("situational-grounding", "test-run-2");
    revisionDiff.commitPhaseTransaction();

    // User-edited entity should survive
    const analysis = entityGraph.getAnalysis();
    const userEntity = analysis.entities.find((e) => e.id === targetEntity.id);
    expect(userEntity).toBeDefined();
    expect(userEntity!.rationale).toBe("User's custom rationale");
    expect(userEntity!.provenance?.source).toBe("user-edited");
  });

  it("rollback reverts entities created during transaction", () => {
    const runId = "test-run-1";

    revisionDiff.beginPhaseTransaction("situational-grounding", runId);
    simulatePhaseExecution("situational-grounding", runId);

    // Entities exist before rollback
    const beforeRollback = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    expect(beforeRollback.length).toBeGreaterThan(0);

    revisionDiff.rollbackPhaseTransaction();

    // After rollback, entities created in this transaction should be removed
    const afterRollback = entityGraph.getEntitiesByPhase(
      "situational-grounding",
    );
    expect(afterRollback.length).toBe(0);
  });

  it("full 3-phase pipeline with graph verification", () => {
    const phases = [
      "situational-grounding",
      "player-identification",
      "baseline-model",
    ] as const;
    const runId = "test-run-1";

    for (const phase of phases) {
      revisionDiff.beginPhaseTransaction(phase, runId);
      simulatePhaseExecution(phase, runId);
      revisionDiff.commitPhaseTransaction();
    }

    // Verify final graph state
    const analysis = entityGraph.getAnalysis();
    const entityIds = new Set(analysis.entities.map((e) => e.id));

    for (const phase of phases) {
      const phaseEntities = analysis.entities.filter((e) => e.phase === phase);
      const expectedFixture = PHASE_FIXTURES[phase]!;
      expect(phaseEntities.length).toBe(expectedFixture.entities.length);
    }

    for (const rel of analysis.relationships) {
      expect(entityIds.has(rel.fromEntityId)).toBe(true);
      expect(entityIds.has(rel.toEntityId)).toBe(true);
    }
  });
});
