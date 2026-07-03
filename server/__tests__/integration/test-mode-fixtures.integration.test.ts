import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUNNABLE_PHASES } from "../../../shared/types/methodology";
import { resetAllServices } from "../../__test-utils__/fixtures";
import * as orchestrator from "../../agents/analysis-agent";
import { runPhase } from "../../services/analysis-service";
import * as entityGraph from "../../services/entity-graph-service";
import { commitPhaseSnapshot } from "../../services/revision-diff";
import * as runtimeStatus from "../../services/runtime-status";

describe("test-mode fixture ladder integration", () => {
  beforeEach(async () => {
    vi.stubEnv("GAME_THEORY_ANALYSIS_TEST_MODE", "1");
    await resetAllServices();
    entityGraph.newAnalysis("Fixture ladder topic");
  });

  afterEach(async () => {
    const runPromise = orchestrator._getRunPromise();
    if (runPromise) await runPromise;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("runs and commits all runnable phases with test-mode fixtures", async () => {
    let priorContext: string | undefined;
    const appliedPhases: string[] = [];

    for (const phase of RUNNABLE_PHASES) {
      const result = await runPhase(phase, "Steel trade war", {
        priorEntities: priorContext,
        runId: "test-mode-fixture-ladder",
      });
      const validationMessage = result.success
        ? phase
        : `${phase}: ${result.error}`;
      expect(result.success, validationMessage).toBe(true);
      expect(result.entities.length, `entities from ${phase}`).toBeGreaterThan(
        0,
      );

      const commitResult = commitPhaseSnapshot({
        phase,
        runId: "test-mode-fixture-ladder",
        entities: result.entities,
        relationships: result.relationships,
      });

      expect(commitResult.status, `commit ${phase}`).toBe("applied");
      appliedPhases.push(phase);

      const phaseEntities = entityGraph.getEntitiesByPhase(phase);
      expect(phaseEntities.length, `committed ${phase}`).toBe(
        result.entities.length,
      );

      const analysis = entityGraph.getAnalysis();
      priorContext = JSON.stringify(
        analysis.entities.map((entity) => ({
          id: entity.id,
          type: entity.type,
          phase: entity.phase,
          data: entity.data,
        })),
      );
    }

    expect(appliedPhases).toEqual(RUNNABLE_PHASES);

    const analysis = entityGraph.getAnalysis();
    for (const phase of RUNNABLE_PHASES) {
      expect(
        analysis.entities.some((entity) => entity.phase === phase),
        `final graph has ${phase}`,
      ).toBe(true);
    }

    const entityIds = new Set(analysis.entities.map((entity) => entity.id));
    for (const relationship of analysis.relationships) {
      expect(
        entityIds.has(relationship.fromEntityId),
        `dangling from ${relationship.fromEntityId}`,
      ).toBe(true);
      expect(
        entityIds.has(relationship.toEntityId),
        `dangling to ${relationship.toEntityId}`,
      ).toBe(true);
    }
  });

  it("runFull completes the full fixture ladder and synthesis in test mode", async () => {
    const events: string[] = [];
    const unsubscribe = orchestrator.onProgress((event) => {
      events.push(event.type);
    });

    await orchestrator.runFull(
      "Steel trade war",
      "anthropic",
      undefined,
      undefined,
      { activePhases: [...RUNNABLE_PHASES] },
    );

    const runPromise = orchestrator._getRunPromise();
    expect(runPromise).not.toBeNull();
    await runPromise;
    unsubscribe();

    expect(events).toContain("analysis_completed");
    expect(events).toContain("synthesis_completed");
    expect(events).not.toContain("analysis_failed");
    expect(runtimeStatus.getSnapshot().status).toBe("idle");

    const analysis = entityGraph.getAnalysis();
    for (const phase of RUNNABLE_PHASES) {
      expect(
        analysis.entities.some((entity) => entity.phase === phase),
        `runFull graph has ${phase}`,
      ).toBe(true);
    }

    const report = analysis.entities.find(
      (entity) => entity.type === "analysis-report",
    );
    expect(report).toBeDefined();
  });
});
