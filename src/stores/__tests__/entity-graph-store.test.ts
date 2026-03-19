import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { _resetForTest as resetService } from "@/services/ai/entity-graph-service";
import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";
import { V1_PHASES } from "@/types/methodology";

function makeEntity(
  overrides: Partial<AnalysisEntity> & {
    id: string;
    type: AnalysisEntity["type"];
    phase: MethodologyPhase;
  },
): AnalysisEntity {
  return {
    position: { x: 0, y: 0 },
    confidence: "medium",
    source: "ai",
    rationale: "",
    revision: 0,
    stale: false,
    data: {
      type: "fact",
      date: "2026-01-01",
      source: "test",
      content: "test fact",
      category: "action",
    },
    ...overrides,
  };
}

function makeRelationship(
  overrides: Partial<AnalysisRelationship> & {
    id: string;
    fromEntityId: string;
    toEntityId: string;
  },
): AnalysisRelationship {
  return {
    type: "depends-on",
    ...overrides,
  };
}

describe("entity-graph-store", () => {
  beforeEach(() => {
    resetService();
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
  });

  afterEach(() => {
    resetService();
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
  });

  // ── newAnalysis ──

  describe("newAnalysis", () => {
    it("creates empty analysis with topic and initializes V1 phases as pending", () => {
      useEntityGraphStore.getState().newAnalysis("US-China trade war");

      const state = useEntityGraphStore.getState();
      expect(state.analysis.topic).toBe("US-China trade war");
      expect(state.analysis.id).toBeTruthy();
      expect(state.analysis.entities).toEqual([]);
      expect(state.analysis.relationships).toEqual([]);
      expect(state.analysis.phases).toHaveLength(V1_PHASES.length);

      for (const ps of state.analysis.phases) {
        expect(V1_PHASES).toContain(ps.phase);
        expect(ps.status).toBe("pending");
        expect(ps.entityIds).toEqual([]);
      }
    });
  });

  // ── addEntities ──

  describe("addEntities", () => {
    it("adds entities, increments revision, marks dirty", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const revBefore = useEntityGraphStore.getState().revision;

      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });

      useEntityGraphStore.getState().addEntities([entity]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toHaveLength(1);
      expect(state.analysis.entities[0].id).toBe("e1");
      expect(state.revision).toBe(revBefore + 1);
      expect(state.isDirty).toBe(true);
    });

    it("adds entities with relationships", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      const e1 = makeEntity({
        id: "e1",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
      });
      const e2 = makeEntity({
        id: "e2",
        type: "objective",
        phase: "player-identification",
        data: {
          type: "objective",
          description: "Win trade",
          priority: "high",
          stability: "stable",
        },
      });
      const rel = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "has-objective",
      });

      useEntityGraphStore.getState().addEntities([e1, e2], [rel]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toHaveLength(2);
      expect(state.analysis.relationships).toHaveLength(1);
      expect(state.analysis.relationships[0].id).toBe("r1");
    });

    it("deduplicates entities by ID on add", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);
      useEntityGraphStore.getState().addEntities([entity]);

      expect(useEntityGraphStore.getState().analysis.entities).toHaveLength(1);
    });

    it("does not increment revision for empty add", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const revBefore = useEntityGraphStore.getState().revision;

      useEntityGraphStore.getState().addEntities([]);

      expect(useEntityGraphStore.getState().revision).toBe(revBefore);
    });
  });

  // ── updateEntity ──

  describe("updateEntity", () => {
    it("updates entity by ID and increments revision", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);
      const revBefore = useEntityGraphStore.getState().revision;

      useEntityGraphStore.getState().updateEntity("e1", { confidence: "high" });

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities[0].confidence).toBe("high");
      expect(state.revision).toBe(revBefore + 1);
      expect(state.isDirty).toBe(true);
    });
  });

  // ── removeEntity ──

  describe("removeEntity", () => {
    it("removes entity and cleans up relationships referencing it", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      const e1 = makeEntity({
        id: "e1",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
      });
      const e2 = makeEntity({
        id: "e2",
        type: "objective",
        phase: "player-identification",
        data: {
          type: "objective",
          description: "Win trade",
          priority: "high",
          stability: "stable",
        },
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
      });
      const r1 = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "has-objective",
      });
      const r2 = makeRelationship({
        id: "r2",
        fromEntityId: "e2",
        toEntityId: "e3",
        type: "depends-on",
      });
      const r3 = makeRelationship({
        id: "r3",
        fromEntityId: "e3",
        toEntityId: "e1",
        type: "informed-by",
      });

      useEntityGraphStore.getState().addEntities([e1, e2, e3], [r1, r2, r3]);
      const revBefore = useEntityGraphStore.getState().revision;

      useEntityGraphStore.getState().removeEntity("e2");

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toHaveLength(2);
      expect(
        state.analysis.entities.find((e) => e.id === "e2"),
      ).toBeUndefined();
      // r1 (from e1 -> e2) and r2 (from e2 -> e3) should be removed
      expect(state.analysis.relationships).toHaveLength(1);
      expect(state.analysis.relationships[0].id).toBe("r3");
      expect(state.revision).toBe(revBefore + 1);
    });
  });

  // ── addRelationships ──

  describe("addRelationships", () => {
    it("adds relationships and increments revision", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);
      const revBefore = useEntityGraphStore.getState().revision;

      const rel = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "supports",
      });
      useEntityGraphStore.getState().addRelationships([rel]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.relationships).toHaveLength(1);
      expect(state.revision).toBe(revBefore + 1);
      expect(state.isDirty).toBe(true);
    });
  });

  // ── setPhaseStatus ──

  describe("setPhaseStatus", () => {
    it("updates phase status", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      useEntityGraphStore
        .getState()
        .setPhaseStatus("situational-grounding", "running");

      const state = useEntityGraphStore.getState();
      const sg = state.analysis.phases.find(
        (p) => p.phase === "situational-grounding",
      );
      expect(sg?.status).toBe("running");
    });
  });

  // ── getPhaseEntities ──

  describe("getPhaseEntities", () => {
    it("returns entities for a specific phase", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([e1, e2, e3]);

      const result = useEntityGraphStore
        .getState()
        .getPhaseEntities("situational-grounding");
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id).sort()).toEqual(["e1", "e3"]);
    });
  });

  // ── markStale / clearStale / getStaleEntityIds ──

  describe("stale marking", () => {
    it("markStale marks specified entity IDs as stale", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);

      useEntityGraphStore.getState().markStale(["e1"]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities.find((e) => e.id === "e1")?.stale).toBe(
        true,
      );
      expect(state.analysis.entities.find((e) => e.id === "e2")?.stale).toBe(
        false,
      );
    });

    it("clearStale clears stale flag on specified IDs", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
        stale: true,
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
        stale: true,
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);

      useEntityGraphStore.getState().clearStale(["e1"]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities.find((e) => e.id === "e1")?.stale).toBe(
        false,
      );
      expect(state.analysis.entities.find((e) => e.id === "e2")?.stale).toBe(
        true,
      );
    });

    it("getStaleEntityIds returns all entity IDs with stale=true", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
        stale: true,
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
        stale: true,
      });
      useEntityGraphStore.getState().addEntities([e1, e2, e3]);

      const staleIds = useEntityGraphStore.getState().getStaleEntityIds();
      expect(staleIds.sort()).toEqual(["e1", "e3"]);
    });
  });

  // ── getDownstreamEntityIds ──

  describe("getDownstreamEntityIds", () => {
    it("returns transitively reachable entity IDs via downstream relationships", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      // e1 --depends-on--> e2 --produces--> e3
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
      });
      const r1 = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "depends-on",
      });
      const r2 = makeRelationship({
        id: "r2",
        fromEntityId: "e2",
        toEntityId: "e3",
        type: "produces",
      });

      useEntityGraphStore.getState().addEntities([e1, e2, e3], [r1, r2]);

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds("e1");
      expect(result.sort()).toEqual(["e2", "e3"]);
    });

    it("does not follow non-downstream relationships", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      // e1 --supports--> e2 (evidence, not downstream)
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      const r1 = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "supports",
      });

      useEntityGraphStore.getState().addEntities([e1, e2], [r1]);

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds("e1");
      expect(result).toEqual([]);
    });

    it("handles cycles without infinite loop", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      // e1 -> e2 -> e3 -> e1 (cycle)
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
      });
      const r1 = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "depends-on",
      });
      const r2 = makeRelationship({
        id: "r2",
        fromEntityId: "e2",
        toEntityId: "e3",
        type: "depends-on",
      });
      const r3 = makeRelationship({
        id: "r3",
        fromEntityId: "e3",
        toEntityId: "e1",
        type: "depends-on",
      });

      useEntityGraphStore.getState().addEntities([e1, e2, e3], [r1, r2, r3]);

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds("e1");
      expect(result.sort()).toEqual(["e2", "e3"]);
    });
  });

  // ── File reference tracking ──

  describe("file reference tracking", () => {
    it("setFileReference updates file metadata", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      useEntityGraphStore.getState().setFileReference({
        fileName: "analysis.gta2",
        filePath: "/tmp/analysis.gta2",
      });

      const state = useEntityGraphStore.getState();
      expect(state.fileName).toBe("analysis.gta2");
      expect(state.filePath).toBe("/tmp/analysis.gta2");
    });

    it("commitSave updates file reference and clears dirty", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);
      expect(useEntityGraphStore.getState().isDirty).toBe(true);

      useEntityGraphStore.getState().commitSave({
        fileName: "analysis.gta2",
        filePath: "/tmp/analysis.gta2",
      });

      const state = useEntityGraphStore.getState();
      expect(state.fileName).toBe("analysis.gta2");
      expect(state.filePath).toBe("/tmp/analysis.gta2");
      expect(state.isDirty).toBe(false);
    });

    it("markDirty sets isDirty to true", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      expect(useEntityGraphStore.getState().isDirty).toBe(false);

      useEntityGraphStore.getState().markDirty();

      expect(useEntityGraphStore.getState().isDirty).toBe(true);
    });
  });

  // ── loadAnalysis ──

  describe("loadAnalysis", () => {
    it("loads an analysis with source and clears dirty", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      useEntityGraphStore.getState().markDirty();

      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      const analysis = {
        ...useEntityGraphStore.getState().analysis,
        topic: "loaded topic",
        entities: [entity],
      };

      useEntityGraphStore.getState().loadAnalysis(analysis, {
        fileName: "loaded.gta2",
        filePath: "/tmp/loaded.gta2",
      });

      const state = useEntityGraphStore.getState();
      expect(state.analysis.topic).toBe("loaded topic");
      expect(state.analysis.entities).toHaveLength(1);
      expect(state.fileName).toBe("loaded.gta2");
      expect(state.isDirty).toBe(false);
    });
  });
});
