import { describe, it, expect, beforeEach } from "vitest";
import type { AnalysisMutationEvent } from "../../../shared/types/events";
import {
  newAnalysis,
  loadAnalysis,
  getAnalysis,
  createEntity,
  createRelationship,
  updateEntity,
  updateRelationship,
  getEntitiesByPhase,
  getRelationships,
  markStale,
  clearStale,
  getStaleEntityIds,
  getDownstreamEntityIds,
  removeEntity,
  removeRelationship,
  removePhaseEntities,
  setPhaseStatus,
  getIsDirty,
  getRevision,
  getFileName,
  getFilePath,
  commitSave,
  markDirty,
  onMutation,
  _resetForTest,
} from "../entity-graph-service";

// ── Fixtures ──

function makeFactData() {
  return {
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: "A fact",
      category: "action" as const,
    },
    confidence: "high" as const,
    rationale: "test rationale",
    revision: 1,
    stale: false,
  };
}

function makePlayerData() {
  return {
    type: "player" as const,
    phase: "player-identification" as const,
    data: {
      type: "player" as const,
      name: "USA",
      playerType: "primary" as const,
      knowledge: [],
    },
    confidence: "high" as const,
    rationale: "primary actor",
    revision: 1,
    stale: false,
  };
}

const defaultProvenance = {
  source: "phase-derived" as const,
  runId: "run-1",
  phase: "situational-grounding",
};

// ── Setup ──

beforeEach(() => {
  _resetForTest();
});

// ── Tests ──

describe("newAnalysis", () => {
  it("creates empty analysis with V1_PHASES", () => {
    newAnalysis("US-China trade war");
    const a = getAnalysis();
    expect(a.topic).toBe("US-China trade war");
    expect(a.name).toBe("US-China trade war");
    expect(a.entities).toEqual([]);
    expect(a.relationships).toEqual([]);
    expect(a.phases).toHaveLength(3);
    expect(a.phases.map((p) => p.phase)).toEqual([
      "situational-grounding",
      "player-identification",
      "baseline-model",
    ]);
    expect(a.phases.every((p) => p.status === "pending")).toBe(true);
  });
});

describe("createEntity", () => {
  it("stamps provenance with source and timestamp", () => {
    newAnalysis("test");
    const before = Date.now();
    const entity = createEntity(makeFactData(), defaultProvenance);
    const after = Date.now();

    expect(entity.provenance).toBeDefined();
    expect(entity.provenance!.source).toBe("phase-derived");
    expect(entity.provenance!.runId).toBe("run-1");
    expect(entity.provenance!.phase).toBe("situational-grounding");
    expect(entity.provenance!.timestamp).toBeGreaterThanOrEqual(before);
    expect(entity.provenance!.timestamp).toBeLessThanOrEqual(after);
  });

  it("generates a unique ID via nanoid", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    expect(e1.id).toBeTruthy();
    expect(e2.id).toBeTruthy();
    expect(e1.id).not.toBe(e2.id);
  });

  it("adds entity to the analysis", () => {
    newAnalysis("test");
    createEntity(makeFactData(), defaultProvenance);
    expect(getAnalysis().entities).toHaveLength(1);
  });

  it("deduplicates by ID (same entity not added twice)", () => {
    newAnalysis("test");
    // Since each call generates a new ID, two calls always produce two entities
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makeFactData(), defaultProvenance);
    expect(getAnalysis().entities).toHaveLength(2);
  });
});

describe("updateEntity", () => {
  it("chains previousOrigin from existing provenance", () => {
    newAnalysis("test");
    const entity = createEntity(makeFactData(), defaultProvenance);
    const originalProvenance = entity.provenance!;

    const updated = updateEntity(
      entity.id,
      { rationale: "updated rationale" },
      { source: "user-edited" },
    );

    expect(updated).not.toBeNull();
    expect(updated!.rationale).toBe("updated rationale");
    expect(updated!.provenance!.source).toBe("user-edited");
    expect(updated!.provenance!.previousOrigin).toEqual(originalProvenance);
  });

  it("returns null for nonexistent ID", () => {
    newAnalysis("test");
    const result = updateEntity(
      "nonexistent-id",
      { rationale: "nope" },
      { source: "user-edited" },
    );
    expect(result).toBeNull();
  });

  it("preserves the original entity ID", () => {
    newAnalysis("test");
    const entity = createEntity(makeFactData(), defaultProvenance);
    const updated = updateEntity(
      entity.id,
      { rationale: "changed" },
      { source: "user-edited" },
    );
    expect(updated!.id).toBe(entity.id);
  });

  it("marks downstream dependents as stale after update", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);

    // e1 -> e2 (downstream: depends-on)
    createRelationship({
      type: "depends-on",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });
    // e2 -> e3 (downstream: derived-from)
    createRelationship({
      type: "derived-from",
      fromEntityId: e2.id,
      toEntityId: e3.id,
    });

    // Initially no entities are stale
    expect(getStaleEntityIds()).toHaveLength(0);

    // Update e1 — should propagate stale to e2 and e3
    updateEntity(e1.id, { rationale: "changed" }, { source: "user-edited" });

    const staleIds = getStaleEntityIds();
    expect(staleIds).toContain(e2.id);
    expect(staleIds).toContain(e3.id);
    // e1 itself should NOT be marked stale
    expect(staleIds).not.toContain(e1.id);
  });
});

describe("createRelationship", () => {
  it("validates entity IDs exist (throws on missing fromEntityId)", () => {
    newAnalysis("test");
    const entity = createEntity(makeFactData(), defaultProvenance);

    expect(() =>
      createRelationship({
        type: "supports",
        fromEntityId: "nonexistent",
        toEntityId: entity.id,
      }),
    ).toThrow('fromEntityId "nonexistent" does not exist');
  });

  it("validates entity IDs exist (throws on missing toEntityId)", () => {
    newAnalysis("test");
    const entity = createEntity(makeFactData(), defaultProvenance);

    expect(() =>
      createRelationship({
        type: "supports",
        fromEntityId: entity.id,
        toEntityId: "nonexistent",
      }),
    ).toThrow('toEntityId "nonexistent" does not exist');
  });

  it("creates a relationship between existing entities", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    expect(rel.id).toBeTruthy();
    expect(rel.type).toBe("supports");
    expect(rel.fromEntityId).toBe(e1.id);
    expect(rel.toEntityId).toBe(e2.id);
    expect(getAnalysis().relationships).toHaveLength(1);
  });
});

describe("getEntitiesByPhase", () => {
  it("filters correctly", () => {
    newAnalysis("test");
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    expect(getEntitiesByPhase("situational-grounding")).toHaveLength(2);
    expect(getEntitiesByPhase("player-identification")).toHaveLength(1);
    expect(getEntitiesByPhase("baseline-model")).toHaveLength(0);
  });
});

describe("getRelationships", () => {
  it("filters by type", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });
    createRelationship({
      type: "contradicts",
      fromEntityId: e2.id,
      toEntityId: e3.id,
    });

    expect(getRelationships({ type: "supports" })).toHaveLength(1);
    expect(getRelationships({ type: "contradicts" })).toHaveLength(1);
    expect(getRelationships({ type: "depends-on" })).toHaveLength(0);
  });

  it("filters by entityId (matches from or to)", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });
    createRelationship({
      type: "contradicts",
      fromEntityId: e2.id,
      toEntityId: e3.id,
    });

    // e2 is involved in both relationships
    expect(getRelationships({ entityId: e2.id })).toHaveLength(2);
    // e1 only in one
    expect(getRelationships({ entityId: e1.id })).toHaveLength(1);
  });

  it("returns all when no filters", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    expect(getRelationships()).toHaveLength(1);
  });
});

describe("markStale + getStaleEntityIds", () => {
  it("marks entities as stale and retrieves stale IDs", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    createEntity(makeFactData(), defaultProvenance);

    markStale([e1.id, e2.id]);

    const staleIds = getStaleEntityIds();
    expect(staleIds).toHaveLength(2);
    expect(staleIds).toContain(e1.id);
    expect(staleIds).toContain(e2.id);
  });

  it("clearStale removes stale flag", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    markStale([e1.id]);
    expect(getStaleEntityIds()).toHaveLength(1);

    clearStale([e1.id]);
    expect(getStaleEntityIds()).toHaveLength(0);
  });
});

describe("removePhaseEntities", () => {
  it("removes all entities for a phase", () => {
    newAnalysis("test");
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makeFactData(), defaultProvenance);
    createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    removePhaseEntities("situational-grounding");

    expect(getAnalysis().entities).toHaveLength(1);
    expect(getAnalysis().entities[0].phase).toBe("player-identification");
  });

  it("only removes entities with matching runId when runId provided", () => {
    newAnalysis("test");
    createEntity(makeFactData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "situational-grounding",
    });
    createEntity(makeFactData(), {
      source: "phase-derived",
      runId: "run-2",
      phase: "situational-grounding",
    });

    removePhaseEntities("situational-grounding", "run-1");

    const remaining = getAnalysis().entities;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].provenance!.runId).toBe("run-2");
  });

  it("also removes relationships referencing removed entities", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makePlayerData(), {
      source: "phase-derived",
      runId: "run-1",
      phase: "player-identification",
    });

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    removePhaseEntities("situational-grounding");

    expect(getAnalysis().relationships).toHaveLength(0);
  });
});

describe("getDownstreamEntityIds", () => {
  it("follows downstream relationships via BFS", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const e3 = createEntity(makeFactData(), defaultProvenance);
    const e4 = createEntity(makeFactData(), defaultProvenance);

    // e1 -> e2 (downstream: depends-on)
    createRelationship({
      type: "depends-on",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });
    // e2 -> e3 (downstream: derived-from)
    createRelationship({
      type: "derived-from",
      fromEntityId: e2.id,
      toEntityId: e3.id,
    });
    // e1 -> e4 (structural: links — should NOT be traversed)
    createRelationship({
      type: "links",
      fromEntityId: e1.id,
      toEntityId: e4.id,
    });

    const downstream = getDownstreamEntityIds(e1.id);
    expect(downstream).toContain(e2.id);
    expect(downstream).toContain(e3.id);
    expect(downstream).not.toContain(e4.id);
    expect(downstream).not.toContain(e1.id); // excludes source
  });

  it("returns empty array when no downstream entities", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    expect(getDownstreamEntityIds(e1.id)).toEqual([]);
  });
});

describe("dirty tracking", () => {
  it("mutations set isDirty = true", () => {
    newAnalysis("test");
    expect(getIsDirty()).toBe(false);

    createEntity(makeFactData(), defaultProvenance);
    expect(getIsDirty()).toBe(true);
  });

  it("commitSave sets isDirty to false", () => {
    newAnalysis("test");
    createEntity(makeFactData(), defaultProvenance);
    expect(getIsDirty()).toBe(true);

    commitSave({ fileName: "test.json" });
    expect(getIsDirty()).toBe(false);
    expect(getFileName()).toBe("test.json");
  });

  it("markDirty sets isDirty to true", () => {
    newAnalysis("test");
    expect(getIsDirty()).toBe(false);

    markDirty();
    expect(getIsDirty()).toBe(true);
  });

  it("revision increments on mutations", () => {
    newAnalysis("test");
    const rev0 = getRevision();

    createEntity(makeFactData(), defaultProvenance);
    expect(getRevision()).toBeGreaterThan(rev0);

    const rev1 = getRevision();
    createEntity(makeFactData(), defaultProvenance);
    expect(getRevision()).toBeGreaterThan(rev1);
  });
});

describe("setPhaseStatus", () => {
  it("updates the status for a phase", () => {
    newAnalysis("test");
    setPhaseStatus("situational-grounding", "running");

    const phase = getAnalysis().phases.find(
      (p) => p.phase === "situational-grounding",
    );
    expect(phase!.status).toBe("running");
  });
});

describe("loadAnalysis", () => {
  it("loads an existing analysis", () => {
    const analysis = {
      id: "loaded-id",
      name: "Loaded",
      topic: "loaded topic",
      entities: [],
      relationships: [],
      phases: [
        {
          phase: "situational-grounding" as const,
          status: "complete" as const,
          entityIds: [],
        },
      ],
    };

    loadAnalysis(analysis, {
      fileName: "loaded.json",
      filePath: "/tmp/loaded.json",
    });

    const a = getAnalysis();
    expect(a.id).toBe("loaded-id");
    expect(a.topic).toBe("loaded topic");
    expect(getFileName()).toBe("loaded.json");
    expect(getFilePath()).toBe("/tmp/loaded.json");
    expect(getIsDirty()).toBe(false);
  });
});

describe("updateRelationship", () => {
  it("updates an existing relationship", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const updated = updateRelationship(rel.id, { type: "contradicts" });
    expect(updated).not.toBeNull();
    expect(updated!.type).toBe("contradicts");
    expect(updated!.id).toBe(rel.id);
  });

  it("returns null for nonexistent relationship", () => {
    newAnalysis("test");
    expect(updateRelationship("nonexistent", { type: "links" })).toBeNull();
  });
});

describe("onMutation", () => {
  it("callback receives entity_created events", () => {
    newAnalysis("test");
    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    createEntity(makeFactData(), defaultProvenance);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("entity_created");
    if (events[0].type === "entity_created") {
      expect(events[0].entity.provenance!.source).toBe("phase-derived");
    }

    unsub();
  });

  it("callback receives entity_updated events with previousProvenance", () => {
    newAnalysis("test");
    const entity = createEntity(makeFactData(), defaultProvenance);
    const originalProvenance = entity.provenance!;

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    updateEntity(
      entity.id,
      { rationale: "updated" },
      { source: "user-edited" },
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("entity_updated");
    if (events[0].type === "entity_updated") {
      expect(events[0].previousProvenance).toEqual(originalProvenance);
      expect(events[0].entity.provenance!.source).toBe("user-edited");
    }

    unsub();
  });

  it("callback receives relationship_created events", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("relationship_created");

    unsub();
  });

  it("callback receives entity_deleted and cascade relationship_deleted events", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    expect(removeEntity(e1.id)).toBe(true);

    expect(events).toEqual([
      { type: "entity_deleted", entityId: e1.id },
      { type: "relationship_deleted", relationshipId: rel.id },
    ]);

    unsub();
  });

  it("callback receives stale_marked events", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    markStale([e1.id]);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("stale_marked");
    if (events[0].type === "stale_marked") {
      expect(events[0].entityIds).toEqual([e1.id]);
    }

    unsub();
  });

  it("callback receives relationship_updated events", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    updateRelationship(rel.id, { type: "contradicts" });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("relationship_updated");
    if (events[0].type === "relationship_updated") {
      expect(events[0].relationship.id).toBe(rel.id);
      expect(events[0].relationship.type).toBe("contradicts");
    }

    unsub();
  });

  it("callback receives relationship_deleted events for explicit removal", () => {
    newAnalysis("test");
    const e1 = createEntity(makeFactData(), defaultProvenance);
    const e2 = createEntity(makeFactData(), defaultProvenance);
    const rel = createRelationship({
      type: "supports",
      fromEntityId: e1.id,
      toEntityId: e2.id,
    });

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    expect(removeRelationship(rel.id)).toBe(true);

    expect(events).toEqual([
      { type: "relationship_deleted", relationshipId: rel.id },
    ]);

    unsub();
  });

  it("callback receives state_changed from setPhaseStatus", () => {
    newAnalysis("test");
    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    setPhaseStatus("situational-grounding", "running");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("state_changed");

    unsub();
  });

  it("callback receives state_changed from removePhaseEntities", () => {
    newAnalysis("test");
    createEntity(makeFactData(), defaultProvenance);

    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    removePhaseEntities("situational-grounding");

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("state_changed");

    unsub();
  });

  it("unsubscribe stops receiving events", () => {
    newAnalysis("test");
    const events: AnalysisMutationEvent[] = [];
    const unsub = onMutation((event) => events.push(event));

    createEntity(makeFactData(), defaultProvenance);
    expect(events).toHaveLength(1);

    unsub();

    createEntity(makeFactData(), defaultProvenance);
    expect(events).toHaveLength(1); // no new events after unsub
  });
});
