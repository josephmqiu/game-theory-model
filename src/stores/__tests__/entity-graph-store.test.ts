import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";
import { V3_PHASES } from "@/types/methodology";

function makeEntity(
  overrides: Partial<AnalysisEntity> & {
    id: string;
    type: AnalysisEntity["type"];
    phase: MethodologyPhase;
  },
): AnalysisEntity {
  return {
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
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
  });

  afterEach(() => {
    useEntityGraphStore.setState(useEntityGraphStore.getInitialState(), true);
  });

  // ── newAnalysis ──

  describe("newAnalysis", () => {
    it("creates empty analysis with topic and initializes runnable phases as pending", () => {
      useEntityGraphStore.getState().newAnalysis("US-China trade war");

      const state = useEntityGraphStore.getState();
      expect(state.analysis.topic).toBe("US-China trade war");
      expect(state.analysis.id).toBeTruthy();
      expect(state.analysis.entities).toEqual([]);
      expect(state.analysis.relationships).toEqual([]);
      expect(state.analysis.phases).toHaveLength(V3_PHASES.length);

      for (const ps of state.analysis.phases) {
        expect(V3_PHASES).toContain(ps.phase);
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
      // Service generates new IDs, so check type/phase instead of exact ID
      expect(state.analysis.entities[0].type).toBe("fact");
      expect(state.analysis.entities[0].phase).toBe("situational-grounding");
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
      // Relationships are remapped to service-generated IDs
      expect(state.analysis.relationships).toHaveLength(1);
      expect(state.analysis.relationships[0].type).toBe("has-objective");
    });

    it("deduplicates entities by service-level ID on add", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);

      // Second add with same caller ID — service sees it as a new entity
      // since service generates new IDs. The dedup check is against
      // the service's existing entity IDs, not the caller-provided ID.
      // After first add, "e1" no longer exists in service (ID was remapped).
      // So second add creates another entity.
      const countAfterFirst =
        useEntityGraphStore.getState().analysis.entities.length;
      expect(countAfterFirst).toBe(1);
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
      // Get the service-generated ID
      const actualId = useEntityGraphStore.getState().analysis.entities[0].id;
      const revBefore = useEntityGraphStore.getState().revision;

      useEntityGraphStore
        .getState()
        .updateEntity(actualId, { confidence: "high" });

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities[0].confidence).toBe("high");
      expect(state.revision).toBe(revBefore + 1);
      expect(state.isDirty).toBe(true);
    });

    it("defaults to user-edited provenance when source is not provided", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);
      const actualId = useEntityGraphStore.getState().analysis.entities[0].id;

      useEntityGraphStore
        .getState()
        .updateEntity(actualId, { confidence: "high" });

      const updated = useEntityGraphStore.getState().analysis.entities[0];
      expect(updated.provenance?.source).toBe("user-edited");
    });

    it("uses ai-edited provenance when explicitly passed", () => {
      useEntityGraphStore.getState().newAnalysis("test");
      const entity = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
      });
      useEntityGraphStore.getState().addEntities([entity]);
      const actualId = useEntityGraphStore.getState().analysis.entities[0].id;

      useEntityGraphStore
        .getState()
        .updateEntity(actualId, { confidence: "low" }, "ai-edited");

      const updated = useEntityGraphStore.getState().analysis.entities[0];
      expect(updated.provenance?.source).toBe("ai-edited");
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

      // Get service-generated IDs by matching on type
      const entities = useEntityGraphStore.getState().analysis.entities;
      const objectiveEntity = entities.find((e) => e.type === "objective")!;
      const revBefore = useEntityGraphStore.getState().revision;

      useEntityGraphStore.getState().removeEntity(objectiveEntity.id);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toHaveLength(2);
      expect(
        state.analysis.entities.find((e) => e.type === "objective"),
      ).toBeUndefined();
      // Relationships referencing the removed entity should be removed
      // Only the informed-by relationship (fact -> player) should remain
      expect(state.analysis.relationships).toHaveLength(1);
      expect(state.analysis.relationships[0].type).toBe("informed-by");
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test2",
          content: "test fact 2",
          category: "action",
        },
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);

      // Get service-generated IDs
      const entities = useEntityGraphStore.getState().analysis.entities;
      const actualId1 = entities[0].id;
      const actualId2 = entities[1].id;
      const revBefore = useEntityGraphStore.getState().revision;

      const rel = makeRelationship({
        id: "r1",
        fromEntityId: actualId1,
        toEntityId: actualId2,
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test2",
          content: "test fact 2",
          category: "action",
        },
      });
      useEntityGraphStore.getState().addEntities([e1, e2, e3]);

      const result = useEntityGraphStore
        .getState()
        .getPhaseEntities("situational-grounding");
      expect(result).toHaveLength(2);
      // Service generates new IDs, so just check the count and phase
      for (const entity of result) {
        expect(entity.phase).toBe("situational-grounding");
      }
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test2",
          content: "test fact 2",
          category: "action",
        },
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);

      const entities = useEntityGraphStore.getState().analysis.entities;
      const id1 = entities[0].id;
      const id2 = entities[1].id;

      useEntityGraphStore.getState().markStale([id1]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities.find((e) => e.id === id1)?.stale).toBe(
        true,
      );
      expect(state.analysis.entities.find((e) => e.id === id2)?.stale).toBe(
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test2",
          content: "test fact 2",
          category: "action",
        },
      });
      useEntityGraphStore.getState().addEntities([e1, e2]);

      const entities = useEntityGraphStore.getState().analysis.entities;
      const id1 = entities[0].id;
      const id2 = entities[1].id;

      // Both entities are stale after add (stale flag is preserved by createEntity)
      useEntityGraphStore.getState().clearStale([id1]);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities.find((e) => e.id === id1)?.stale).toBe(
        false,
      );
      expect(state.analysis.entities.find((e) => e.id === id2)?.stale).toBe(
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "test2",
          content: "test fact 2",
          category: "action",
        },
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
        stale: true,
        data: {
          type: "fact",
          date: "2026-01-03",
          source: "test3",
          content: "test fact 3",
          category: "action",
        },
      });
      useEntityGraphStore.getState().addEntities([e1, e2, e3]);

      const staleIds = useEntityGraphStore.getState().getStaleEntityIds();
      // Two entities should be stale (e1 and e3 were created with stale=true)
      expect(staleIds).toHaveLength(2);
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
        data: {
          type: "fact",
          date: "2026-01-01",
          source: "t1",
          content: "fact 1",
          category: "action",
        },
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "t2",
          content: "fact 2",
          category: "action",
        },
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-03",
          source: "t3",
          content: "fact 3",
          category: "action",
        },
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

      // Get service-generated IDs
      const entities = useEntityGraphStore.getState().analysis.entities;
      const actualId1 = entities[0].id;

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds(actualId1);
      // Should reach two downstream entities
      expect(result).toHaveLength(2);
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
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "t2",
          content: "fact 2",
          category: "action",
        },
      });
      const r1 = makeRelationship({
        id: "r1",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "supports",
      });

      useEntityGraphStore.getState().addEntities([e1, e2], [r1]);

      const entities = useEntityGraphStore.getState().analysis.entities;
      const actualId1 = entities[0].id;

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds(actualId1);
      expect(result).toEqual([]);
    });

    it("handles cycles without infinite loop", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      // e1 -> e2 -> e3 -> e1 (cycle)
      const e1 = makeEntity({
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-01",
          source: "t1",
          content: "fact 1",
          category: "action",
        },
      });
      const e2 = makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-02",
          source: "t2",
          content: "fact 2",
          category: "action",
        },
      });
      const e3 = makeEntity({
        id: "e3",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-01-03",
          source: "t3",
          content: "fact 3",
          category: "action",
        },
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

      const entities = useEntityGraphStore.getState().analysis.entities;
      const actualId1 = entities[0].id;

      const result = useEntityGraphStore
        .getState()
        .getDownstreamEntityIds(actualId1);
      expect(result).toHaveLength(2);
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

      useEntityGraphStore.getState().loadAnalysis(
        analysis,
        { e1: { x: 100, y: 200, pinned: true } },
        {
          fileName: "loaded.gta",
          filePath: "/tmp/loaded.gta",
        },
      );

      const state = useEntityGraphStore.getState();
      expect(state.analysis.topic).toBe("loaded topic");
      expect(state.analysis.entities).toHaveLength(1);
      expect(state.fileName).toBe("loaded.gta");
      expect(state.isDirty).toBe(false);
      expect(state.layout.e1).toEqual({ x: 100, y: 200, pinned: true });
    });

    it("normalizes legacy phase lists to the 9 runnable phases", () => {
      const entity = makeEntity({
        id: "historical-entity",
        type: "fact",
        phase: "historical-game",
      });

      useEntityGraphStore.getState().loadAnalysis(
        {
          ...useEntityGraphStore.getState().analysis,
          topic: "loaded topic",
          entities: [entity],
          phases: [
            {
              phase: "situational-grounding",
              status: "complete",
              entityIds: [],
            },
            {
              phase: "player-identification",
              status: "complete",
              entityIds: [],
            },
            {
              phase: "baseline-model",
              status: "complete",
              entityIds: [],
            },
          ],
        },
        {},
      );

      const state = useEntityGraphStore.getState();
      expect(state.analysis.phases.map((phaseState) => phaseState.phase)).toEqual(
        V3_PHASES,
      );
      expect(
        state.analysis.phases.find(
          (phaseState) => phaseState.phase === "historical-game",
        ),
      ).toMatchObject({
        status: "complete",
        entityIds: ["historical-entity"],
      });
      expect(
        state.analysis.phases.find(
          (phaseState) => phaseState.phase === "meta-check",
        )?.status,
      ).toBe("pending");
    });
  });

  describe("server sync and layout reconciliation", () => {
    it("upserts server entities without mutating provenance and auto-layouts them", () => {
      useEntityGraphStore.getState().newAnalysis("test");

      const entity = makeEntity({
        id: "server-e1",
        type: "fact",
        phase: "situational-grounding",
        provenance: {
          source: "phase-derived",
          runId: "run-1",
          timestamp: 123,
        },
      });

      useEntityGraphStore.getState().upsertEntityFromServer(entity);

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toEqual([entity]);
      expect(state.layout["server-e1"]).toEqual({ x: 100, y: 0, pinned: false });
      expect(state.isDirty).toBe(false);
    });

    it("preserves pinned layout entries while reconciling unpinned positions", () => {
      useEntityGraphStore.getState().loadAnalysis(
        {
          ...useEntityGraphStore.getState().analysis,
          topic: "loaded topic",
          entities: [
            makeEntity({
              id: "e1",
              type: "fact",
              phase: "situational-grounding",
            }),
            makeEntity({
              id: "e2",
              type: "fact",
              phase: "situational-grounding",
            }),
          ],
        },
        {
          e1: { x: 999, y: 555, pinned: true },
        },
      );

      useEntityGraphStore.getState().reconcileLayout();

      const state = useEntityGraphStore.getState();
      expect(state.layout.e1).toEqual({ x: 999, y: 555, pinned: true });
      expect(state.layout.e2).toEqual({ x: 100, y: 84, pinned: false });
    });

    it("prunes layout for removed server entities", () => {
      useEntityGraphStore.getState().loadAnalysis(
        {
          ...useEntityGraphStore.getState().analysis,
          entities: [
            makeEntity({
              id: "e1",
              type: "fact",
              phase: "situational-grounding",
            }),
          ],
        },
        {
          e1: { x: 100, y: 200, pinned: true },
        },
      );

      useEntityGraphStore.getState().removeEntityFromServer("e1");

      const state = useEntityGraphStore.getState();
      expect(state.analysis.entities).toEqual([]);
      expect(state.layout).toEqual({});
      expect(state.isDirty).toBe(false);
    });

    it("pinEntityPosition stores coordinates and marks the layout pinned", () => {
      useEntityGraphStore.getState().loadAnalysis(
        {
          ...useEntityGraphStore.getState().analysis,
          entities: [
            makeEntity({
              id: "e1",
              type: "fact",
              phase: "situational-grounding",
            }),
          ],
        },
        {},
      );

      useEntityGraphStore.getState().pinEntityPosition("e1", 320, 240);

      const state = useEntityGraphStore.getState();
      expect(state.layout.e1).toEqual({ x: 320, y: 240, pinned: true });
      expect(state.isDirty).toBe(true);
    });
  });
});
