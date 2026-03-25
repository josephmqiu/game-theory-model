import { CommandId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { decideAnalysisCommand } from "./analysis-decider.ts";
import { projectAnalysisEvent } from "./analysis-projector.ts";
import {
  createEmptyAnalysisSlice,
  AnalysisRunId,
  AnalysisEntityId,
  AnalysisRelationshipId,
  type AnalysisCommand,
  type AnalysisReadModelSlice,
} from "./analysis-schemas.ts";
import type { OrchestrationEvent } from "@t3tools/contracts";

// ── helpers ──

const asRunId = (v: string) => AnalysisRunId.makeUnsafe(v);
const asEntityId = (v: string) => AnalysisEntityId.makeUnsafe(v);
const asRelId = (v: string) => AnalysisRelationshipId.makeUnsafe(v);

const now = new Date().toISOString();
const emptySlice = createEmptyAnalysisSlice();

async function decide(
  command: AnalysisCommand,
  analysis: AnalysisReadModelSlice,
) {
  return Effect.runPromise(decideAnalysisCommand({ command, analysis }));
}

async function decideAndFail(
  command: AnalysisCommand,
  analysis: AnalysisReadModelSlice,
) {
  return Effect.runPromise(
    decideAnalysisCommand({ command, analysis }).pipe(Effect.flip),
  );
}

function applyEvent(
  slice: AnalysisReadModelSlice,
  result:
    | Omit<OrchestrationEvent, "sequence">
    | ReadonlyArray<Omit<OrchestrationEvent, "sequence">>,
): AnalysisReadModelSlice {
  const events = Array.isArray(result) ? result : [result];
  let current = slice;
  for (const evt of events) {
    current = projectAnalysisEvent(current, {
      ...evt,
      sequence: 1,
    } as OrchestrationEvent);
  }
  return current;
}

/** Run a start command and return the updated slice with the runId */
async function startAnalysis(
  slice: AnalysisReadModelSlice = emptySlice,
): Promise<{
  slice: AnalysisReadModelSlice;
  runId: string;
}> {
  const result = await decide(
    {
      type: "analysis.start",
      commandId: CommandId.makeUnsafe("cmd-start"),
      topic: "Test Topic",
      provider: "claude",
      model: "opus",
      createdAt: now,
    },
    slice,
  );
  const evt = Array.isArray(result) ? result[0] : result;
  const runId = (evt.payload as { runId: string }).runId;
  return { slice: applyEvent(slice, result), runId };
}

/** Start analysis + begin first phase */
async function startWithPhase(
  phase: string = "situational-grounding",
): Promise<{ slice: AnalysisReadModelSlice; runId: string }> {
  const { slice, runId } = await startAnalysis();
  const beginResult = await decide(
    {
      type: "analysis.phase.begin",
      commandId: CommandId.makeUnsafe("cmd-phase-begin"),
      runId: asRunId(runId),
      phase: phase as AnalysisCommand["type"] extends string ? any : never,
      createdAt: now,
    } as AnalysisCommand,
    slice,
  );
  return { slice: applyEvent(slice, beginResult), runId };
}

// ── tests ──

describe("analysis decider", () => {
  describe("analysis.start", () => {
    it("succeeds when no active analysis", async () => {
      const result = await decide(
        {
          type: "analysis.start",
          commandId: CommandId.makeUnsafe("cmd-start-1"),
          topic: "Trade War Analysis",
          provider: "claude",
          model: "opus",
          createdAt: now,
        },
        emptySlice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.started");
      const payload = evt.payload as {
        runId: string;
        topic: string;
        phases: string[];
      };
      expect(payload.topic).toBe("Trade War Analysis");
      expect(payload.phases).toHaveLength(9);
      expect(payload.runId).toBeTruthy();
    });

    it("rejected when analysis already running", async () => {
      const { slice } = await startAnalysis();

      const error = await decideAndFail(
        {
          type: "analysis.start",
          commandId: CommandId.makeUnsafe("cmd-start-2"),
          topic: "Another Analysis",
          provider: "claude",
          model: "opus",
          createdAt: now,
        },
        slice,
      );

      expect(error.commandType).toBe("analysis.start");
      expect(error.detail).toContain("already running");
    });
  });

  describe("analysis.phase.begin", () => {
    it("succeeds for first phase when analysis running", async () => {
      const { slice, runId } = await startAnalysis();

      const result = await decide(
        {
          type: "analysis.phase.begin",
          commandId: CommandId.makeUnsafe("cmd-phase-1"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          createdAt: now,
        },
        slice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.phase.began");
      expect((evt.payload as { phase: string }).phase).toBe(
        "situational-grounding",
      );
    });

    it("rejected when previous phase not completed", async () => {
      const { slice, runId } = await startAnalysis();

      const error = await decideAndFail(
        {
          type: "analysis.phase.begin",
          commandId: CommandId.makeUnsafe("cmd-phase-2"),
          runId: asRunId(runId),
          phase: "player-identification",
          createdAt: now,
        },
        slice,
      );

      expect(error.detail).toContain("situational-grounding");
      expect(error.detail).toContain("completed");
    });
  });

  describe("analysis.entity.create", () => {
    it("succeeds during active phase", async () => {
      const { slice, runId } = await startWithPhase();

      const result = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-entity-create"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("entity-1"),
          entityType: "fact",
          entityData: { content: "Trade deficit widened" },
          confidence: "high",
          rationale: "Based on Q1 data",
          source: "ai",
          createdAt: now,
        },
        slice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.entity.created");
      expect((evt.payload as { entityId: string }).entityId).toBe("entity-1");
    });

    it("rejected when no phase active", async () => {
      const { slice, runId } = await startAnalysis();

      const error = await decideAndFail(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-entity-create-2"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("entity-2"),
          entityType: "fact",
          entityData: {},
          confidence: "medium",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        slice,
      );

      expect(error.detail).toContain("No phase is currently active");
    });
  });

  describe("analysis.entity.delete", () => {
    it("rejected for source=human entities", async () => {
      const { slice: startedSlice, runId } = await startWithPhase();

      // Create a human entity
      const createResult = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-entity-human"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("human-entity"),
          entityType: "fact",
          entityData: { content: "User provided fact" },
          confidence: "high",
          rationale: "User input",
          source: "human",
          createdAt: now,
        },
        startedSlice,
      );
      const sliceWithEntity = applyEvent(startedSlice, createResult);

      const error = await decideAndFail(
        {
          type: "analysis.entity.delete",
          commandId: CommandId.makeUnsafe("cmd-entity-delete-human"),
          runId: asRunId(runId),
          entityId: asEntityId("human-entity"),
          createdAt: now,
        },
        sliceWithEntity,
      );

      expect(error.detail).toContain("human");
      expect(error.detail).toContain("cannot be deleted");
    });

    it("succeeds for source=ai entities", async () => {
      const { slice: startedSlice, runId } = await startWithPhase();

      // Create an AI entity
      const createResult = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-entity-ai"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("ai-entity"),
          entityType: "fact",
          entityData: { content: "AI derived fact" },
          confidence: "medium",
          rationale: "Derived",
          source: "ai",
          createdAt: now,
        },
        startedSlice,
      );
      const sliceWithEntity = applyEvent(startedSlice, createResult);

      const result = await decide(
        {
          type: "analysis.entity.delete",
          commandId: CommandId.makeUnsafe("cmd-entity-delete-ai"),
          runId: asRunId(runId),
          entityId: asEntityId("ai-entity"),
          createdAt: now,
        },
        sliceWithEntity,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.entity.deleted");
    });
  });

  describe("analysis.rollback", () => {
    it("removes correct entities from phases after target", async () => {
      const { slice: s1, runId } = await startWithPhase();

      // Create entity in phase 1
      const e1Result = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-e1"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("e-phase1"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, e1Result);

      // Complete phase 1
      const p1Complete = await decide(
        {
          type: "analysis.phase.complete",
          commandId: CommandId.makeUnsafe("cmd-p1-complete"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          createdAt: now,
        },
        s2,
      );
      const s3 = applyEvent(s2, p1Complete);

      // Begin phase 2
      const p2Begin = await decide(
        {
          type: "analysis.phase.begin",
          commandId: CommandId.makeUnsafe("cmd-p2-begin"),
          runId: asRunId(runId),
          phase: "player-identification",
          createdAt: now,
        },
        s3,
      );
      const s4 = applyEvent(s3, p2Begin);

      // Create entity in phase 2
      const e2Result = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-e2"),
          runId: asRunId(runId),
          phase: "player-identification",
          entityId: asEntityId("e-phase2"),
          entityType: "player",
          entityData: {},
          confidence: "medium",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s4,
      );
      const s5 = applyEvent(s4, e2Result);

      expect(s5.entities).toHaveLength(2);

      // Rollback to phase 1
      const rollbackResult = await decide(
        {
          type: "analysis.rollback",
          commandId: CommandId.makeUnsafe("cmd-rollback"),
          runId: asRunId(runId),
          toPhase: "situational-grounding",
          createdAt: now,
        },
        s5,
      );

      const evt = Array.isArray(rollbackResult)
        ? rollbackResult[0]
        : rollbackResult;
      expect(evt.type).toBe("analysis.rolled-back");
      const payload = evt.payload as {
        entitiesRemoved: string[];
        relationshipsRemoved: string[];
      };
      expect(payload.entitiesRemoved).toContain("e-phase2");
      expect(payload.entitiesRemoved).not.toContain("e-phase1");

      // Verify projector applies rollback correctly
      const s6 = applyEvent(s5, rollbackResult);
      expect(s6.entities).toHaveLength(1);
      expect(s6.entities[0]!.entityId).toBe("e-phase1");
      expect(s6.currentPhase).toBe("situational-grounding");
    });
  });

  describe("analysis.complete", () => {
    it("transitions to completed status", async () => {
      const { slice, runId } = await startAnalysis();

      const result = await decide(
        {
          type: "analysis.complete",
          commandId: CommandId.makeUnsafe("cmd-complete"),
          runId: asRunId(runId),
          createdAt: now,
        },
        slice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.completed");
      const payload = evt.payload as { summary: { entityCount: number } };
      expect(payload.summary.entityCount).toBe(0);

      const final = applyEvent(slice, result);
      expect(final.status).toBe("completed");
      expect(final.activeRunId).toBe(runId);
    });

    it("rejected when not running", async () => {
      const error = await decideAndFail(
        {
          type: "analysis.complete",
          commandId: CommandId.makeUnsafe("cmd-complete-idle"),
          runId: asRunId("nonexistent"),
          createdAt: now,
        },
        emptySlice,
      );

      expect(error.detail).toContain("No analysis is currently running");
    });
  });

  describe("analysis.abort", () => {
    it("aborts a running analysis", async () => {
      const { slice, runId } = await startAnalysis();

      const result = await decide(
        {
          type: "analysis.abort",
          commandId: CommandId.makeUnsafe("cmd-abort"),
          runId: asRunId(runId),
          createdAt: now,
        },
        slice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.aborted");

      const final = applyEvent(slice, result);
      expect(final.status).toBe("aborted");
    });
  });

  describe("analysis.relationship.create", () => {
    it("succeeds when both entities exist", async () => {
      const { slice: s1, runId } = await startWithPhase();

      // Create two entities
      const e1 = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-rel-e1"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("from-entity"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, e1);

      const e2 = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-rel-e2"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("to-entity"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s2,
      );
      const s3 = applyEvent(s2, e2);

      // Create relationship
      const result = await decide(
        {
          type: "analysis.relationship.create",
          commandId: CommandId.makeUnsafe("cmd-rel-create"),
          runId: asRunId(runId),
          relationshipId: asRelId("rel-1"),
          fromEntityId: asEntityId("from-entity"),
          toEntityId: asEntityId("to-entity"),
          relationshipType: "supports",
          source: "ai",
          createdAt: now,
        },
        s3,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.relationship.created");

      const s4 = applyEvent(s3, result);
      expect(s4.relationships).toHaveLength(1);
      expect(s4.relationships[0]!.type).toBe("supports");
    });

    it("rejected when from entity missing", async () => {
      const { slice, runId } = await startWithPhase();

      const error = await decideAndFail(
        {
          type: "analysis.relationship.create",
          commandId: CommandId.makeUnsafe("cmd-rel-fail"),
          runId: asRunId(runId),
          relationshipId: asRelId("rel-fail"),
          fromEntityId: asEntityId("missing"),
          toEntityId: asEntityId("also-missing"),
          relationshipType: "supports",
          source: "ai",
          createdAt: now,
        },
        slice,
      );

      expect(error.detail).toContain("From entity");
      expect(error.detail).toContain("does not exist");
    });
  });

  describe("analysis.entity.create duplicate check", () => {
    it("rejected when entityId already exists", async () => {
      const { slice: s1, runId } = await startWithPhase();

      // Create an entity
      const createResult = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-dup-e1"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("dup-entity"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, createResult);

      // Try to create the same entityId again
      const error = await decideAndFail(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-dup-e2"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("dup-entity"),
          entityType: "fact",
          entityData: {},
          confidence: "medium",
          rationale: "duplicate",
          source: "ai",
          createdAt: now,
        },
        s2,
      );

      expect(error.detail).toContain("already exists");
    });
  });

  describe("analysis.entity.update", () => {
    it("succeeds for existing entity", async () => {
      const { slice: s1, runId } = await startWithPhase();

      const createResult = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-upd-create"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("upd-entity"),
          entityType: "fact",
          entityData: { content: "original" },
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, createResult);

      const result = await decide(
        {
          type: "analysis.entity.update",
          commandId: CommandId.makeUnsafe("cmd-upd"),
          runId: asRunId(runId),
          entityId: asEntityId("upd-entity"),
          updates: { content: "updated" },
          createdAt: now,
        },
        s2,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.entity.updated");
    });

    it("rejected when entity does not exist", async () => {
      const { slice, runId } = await startWithPhase();

      const error = await decideAndFail(
        {
          type: "analysis.entity.update",
          commandId: CommandId.makeUnsafe("cmd-upd-missing"),
          runId: asRunId(runId),
          entityId: asEntityId("nonexistent"),
          updates: {},
          createdAt: now,
        },
        slice,
      );

      expect(error.detail).toContain("does not exist");
    });
  });

  describe("analysis.loopback", () => {
    it("records loopback trigger with correct target phase", async () => {
      const { slice, runId } = await startWithPhase();

      const result = await decide(
        {
          type: "analysis.loopback",
          commandId: CommandId.makeUnsafe("cmd-loopback"),
          runId: asRunId(runId),
          triggerType: "confidence-drop",
          justification: "Low confidence on baseline model",
          createdAt: now,
        },
        slice,
      );

      const evt = Array.isArray(result) ? result[0] : result;
      expect(evt.type).toBe("analysis.loopback.recorded");
      const payload = evt.payload as {
        targetPhase: string;
        triggerType: string;
      };
      expect(payload.triggerType).toBe("confidence-drop");
      expect(payload.targetPhase).toBe("baseline-model");

      const updated = applyEvent(slice, result);
      expect(updated.loopbackTriggers).toHaveLength(1);
      expect(updated.loopbackTriggers[0]!.targetPhase).toBe("baseline-model");
    });
  });

  describe("analysis.phase.complete invariants", () => {
    it("rejected when completing wrong phase", async () => {
      const { slice, runId } = await startWithPhase();

      const error = await decideAndFail(
        {
          type: "analysis.phase.complete",
          commandId: CommandId.makeUnsafe("cmd-wrong-phase"),
          runId: asRunId(runId),
          phase: "player-identification",
          createdAt: now,
        },
        slice,
      );

      expect(error.detail).toContain("not the current active phase");
    });
  });

  describe("analysis.rollback preserves human entities", () => {
    it("does not remove source=human entities during rollback", async () => {
      const { slice: s1, runId } = await startWithPhase();

      // Create AI entity in phase 1
      const aiEntity = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-rb-ai"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("ai-e1"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, aiEntity);

      // Complete phase 1
      const p1c = await decide(
        {
          type: "analysis.phase.complete",
          commandId: CommandId.makeUnsafe("cmd-rb-p1c"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          createdAt: now,
        },
        s2,
      );
      const s3 = applyEvent(s2, p1c);

      // Begin phase 2
      const p2b = await decide(
        {
          type: "analysis.phase.begin",
          commandId: CommandId.makeUnsafe("cmd-rb-p2b"),
          runId: asRunId(runId),
          phase: "player-identification",
          createdAt: now,
        },
        s3,
      );
      const s4 = applyEvent(s3, p2b);

      // Create human entity in phase 2
      const humanEntity = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-rb-human"),
          runId: asRunId(runId),
          phase: "player-identification",
          entityId: asEntityId("human-e2"),
          entityType: "player",
          entityData: {},
          confidence: "high",
          rationale: "User provided",
          source: "human",
          createdAt: now,
        },
        s4,
      );
      const s5 = applyEvent(s4, humanEntity);

      // Create AI entity in phase 2
      const aiEntity2 = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-rb-ai2"),
          runId: asRunId(runId),
          phase: "player-identification",
          entityId: asEntityId("ai-e2"),
          entityType: "player",
          entityData: {},
          confidence: "medium",
          rationale: "derived",
          source: "ai",
          createdAt: now,
        },
        s5,
      );
      const s6 = applyEvent(s5, aiEntity2);

      expect(s6.entities).toHaveLength(3);

      // Rollback to phase 1 — should remove AI phase-2 entities but keep human ones
      const rollback = await decide(
        {
          type: "analysis.rollback",
          commandId: CommandId.makeUnsafe("cmd-rb-rollback"),
          runId: asRunId(runId),
          toPhase: "situational-grounding",
          createdAt: now,
        },
        s6,
      );

      const evt = Array.isArray(rollback) ? rollback[0] : rollback;
      const payload = evt.payload as {
        entitiesRemoved: string[];
      };
      // AI entity in phase 2 should be removed
      expect(payload.entitiesRemoved).toContain("ai-e2");
      // Human entity in phase 2 should NOT be removed
      expect(payload.entitiesRemoved).not.toContain("human-e2");

      const s7 = applyEvent(s6, rollback);
      // Phase-1 AI entity + phase-2 human entity remain
      expect(s7.entities).toHaveLength(2);
      expect(s7.entities.map((e) => e.entityId)).toContain("ai-e1");
      expect(s7.entities.map((e) => e.entityId)).toContain("human-e2");
    });
  });

  describe("analysis.abort status check", () => {
    it("rejected when analysis is already completed", async () => {
      const { slice, runId } = await startAnalysis();

      // Complete the analysis
      const completeResult = await decide(
        {
          type: "analysis.complete",
          commandId: CommandId.makeUnsafe("cmd-abort-complete"),
          runId: asRunId(runId),
          createdAt: now,
        },
        slice,
      );
      const completedSlice = applyEvent(slice, completeResult);

      const error = await decideAndFail(
        {
          type: "analysis.abort",
          commandId: CommandId.makeUnsafe("cmd-abort-after-complete"),
          runId: asRunId(runId),
          createdAt: now,
        },
        completedSlice,
      );

      expect(error.detail).toContain("running or aborting");
    });
  });

  describe("analysis projector", () => {
    it("ignores non-analysis events", () => {
      const result = projectAnalysisEvent(emptySlice, {
        sequence: 1,
        eventId: "evt-1" as any,
        aggregateKind: "thread" as any,
        aggregateId: "thread-1" as any,
        type: "thread.created" as any,
        occurredAt: now,
        commandId: null,
        causationEventId: null,
        correlationId: null,
        metadata: {},
        payload: {} as any,
      });

      expect(result).toBe(emptySlice);
    });

    it("tracks entity count through create/delete cycle", async () => {
      const { slice: s1, runId } = await startWithPhase();

      // Create entity
      const createResult = await decide(
        {
          type: "analysis.entity.create",
          commandId: CommandId.makeUnsafe("cmd-track-create"),
          runId: asRunId(runId),
          phase: "situational-grounding",
          entityId: asEntityId("tracked-entity"),
          entityType: "fact",
          entityData: {},
          confidence: "high",
          rationale: "test",
          source: "ai",
          createdAt: now,
        },
        s1,
      );
      const s2 = applyEvent(s1, createResult);
      expect(s2.entities).toHaveLength(1);

      // Delete entity
      const deleteResult = await decide(
        {
          type: "analysis.entity.delete",
          commandId: CommandId.makeUnsafe("cmd-track-delete"),
          runId: asRunId(runId),
          entityId: asEntityId("tracked-entity"),
          createdAt: now,
        },
        s2,
      );
      const s3 = applyEvent(s2, deleteResult);
      expect(s3.entities).toHaveLength(0);
    });
  });
});
