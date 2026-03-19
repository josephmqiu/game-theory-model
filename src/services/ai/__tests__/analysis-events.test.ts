import { describe, it, expect } from "vitest";
import type {
  PhaseSummary,
  AnalysisProgressEvent,
  AnalysisMutationEvent,
  AnalysisEvent,
} from "../analysis-events";
import { isProgressEvent, isMutationEvent } from "../analysis-events";
import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityProvenance,
} from "@/types/entity";

// ── Fixtures ──

const provenance: EntityProvenance = {
  source: "phase-derived",
  runId: "run-1",
  phase: "situational-grounding",
  timestamp: Date.now(),
};

const entity: AnalysisEntity = {
  id: "e-1",
  type: "fact",
  phase: "situational-grounding",
  data: {
    type: "fact",
    date: "2026-03-19",
    source: "test",
    content: "A fact",
    category: "action",
  },
  position: { x: 0, y: 0 },
  confidence: "high",
  source: "ai",
  provenance,
  rationale: "test rationale",
  revision: 1,
  stale: false,
};

const relationship: AnalysisRelationship = {
  id: "r-1",
  type: "supports",
  fromEntityId: "e-1",
  toEntityId: "e-2",
};

// ── Tests ──

describe("PhaseSummary", () => {
  it("has required numeric fields", () => {
    const summary: PhaseSummary = {
      entitiesCreated: 5,
      relationshipsCreated: 3,
      entitiesUpdated: 1,
      durationMs: 1234,
    };
    expect(summary.entitiesCreated).toBe(5);
    expect(summary.relationshipsCreated).toBe(3);
    expect(summary.entitiesUpdated).toBe(1);
    expect(summary.durationMs).toBe(1234);
  });
});

describe("AnalysisProgressEvent", () => {
  it("represents phase_started", () => {
    const event: AnalysisProgressEvent = {
      type: "phase_started",
      phase: "situational-grounding",
      runId: "run-1",
    };
    expect(event.type).toBe("phase_started");
    expect(event.phase).toBe("situational-grounding");
    expect(event.runId).toBe("run-1");
  });

  it("represents phase_completed with PhaseSummary", () => {
    const summary: PhaseSummary = {
      entitiesCreated: 10,
      relationshipsCreated: 5,
      entitiesUpdated: 0,
      durationMs: 5000,
    };
    const event: AnalysisProgressEvent = {
      type: "phase_completed",
      phase: "player-identification",
      runId: "run-2",
      summary,
    };
    expect(event.type).toBe("phase_completed");
    expect(event.summary).toBe(summary);
  });

  it("represents analysis_completed", () => {
    const event: AnalysisProgressEvent = {
      type: "analysis_completed",
      runId: "run-3",
    };
    expect(event.type).toBe("analysis_completed");
    expect(event.runId).toBe("run-3");
  });

  it("represents analysis_failed", () => {
    const event: AnalysisProgressEvent = {
      type: "analysis_failed",
      runId: "run-4",
      error: "timeout after 30s",
    };
    expect(event.type).toBe("analysis_failed");
    expect(event.error).toBe("timeout after 30s");
  });
});

describe("AnalysisMutationEvent", () => {
  it("represents entity_created", () => {
    const event: AnalysisMutationEvent = {
      type: "entity_created",
      entity,
    };
    expect(event.type).toBe("entity_created");
    expect(event.entity.id).toBe("e-1");
  });

  it("represents relationship_created", () => {
    const event: AnalysisMutationEvent = {
      type: "relationship_created",
      relationship,
    };
    expect(event.type).toBe("relationship_created");
    expect(event.relationship.id).toBe("r-1");
  });

  it("represents entity_updated with EntityProvenance (not string)", () => {
    const previousProvenance: EntityProvenance = {
      source: "phase-derived",
      runId: "run-0",
      phase: "situational-grounding",
      timestamp: Date.now() - 10_000,
    };
    const event: AnalysisMutationEvent = {
      type: "entity_updated",
      entity,
      previousProvenance,
    };
    expect(event.type).toBe("entity_updated");
    // previousProvenance is a full EntityProvenance object, not a string
    expect(typeof event.previousProvenance).toBe("object");
    expect(event.previousProvenance.source).toBe("phase-derived");
    expect(event.previousProvenance.runId).toBe("run-0");
    expect(event.previousProvenance.timestamp).toBeTypeOf("number");
  });

  it("represents relationship_updated", () => {
    const event: AnalysisMutationEvent = {
      type: "relationship_updated",
      relationship,
    };
    expect(event.type).toBe("relationship_updated");
    expect(event.relationship.id).toBe("r-1");
  });

  it("represents stale_marked", () => {
    const event: AnalysisMutationEvent = {
      type: "stale_marked",
      entityIds: ["e-1", "e-2", "e-3"],
    };
    expect(event.type).toBe("stale_marked");
    expect(event.entityIds).toHaveLength(3);
  });
});

describe("type guards", () => {
  const progressEvents: AnalysisEvent[] = [
    { type: "phase_started", phase: "situational-grounding", runId: "r" },
    {
      type: "phase_completed",
      phase: "situational-grounding",
      runId: "r",
      summary: {
        entitiesCreated: 0,
        relationshipsCreated: 0,
        entitiesUpdated: 0,
        durationMs: 0,
      },
    },
    { type: "analysis_completed", runId: "r" },
    { type: "analysis_failed", runId: "r", error: "fail" },
  ];

  const mutationEvents: AnalysisEvent[] = [
    { type: "entity_created", entity },
    { type: "relationship_created", relationship },
    { type: "entity_updated", entity, previousProvenance: provenance },
    { type: "relationship_updated", relationship },
    { type: "stale_marked", entityIds: ["e-1"] },
  ];

  it("isProgressEvent returns true for all progress variants", () => {
    for (const event of progressEvents) {
      expect(isProgressEvent(event)).toBe(true);
    }
  });

  it("isProgressEvent returns false for all mutation variants", () => {
    for (const event of mutationEvents) {
      expect(isProgressEvent(event)).toBe(false);
    }
  });

  it("isMutationEvent returns true for all mutation variants", () => {
    for (const event of mutationEvents) {
      expect(isMutationEvent(event)).toBe(true);
    }
  });

  it("isMutationEvent returns false for all progress variants", () => {
    for (const event of progressEvents) {
      expect(isMutationEvent(event)).toBe(false);
    }
  });
});

describe("AnalysisEvent union", () => {
  it("accepts both progress and mutation events", () => {
    const events: AnalysisEvent[] = [
      { type: "phase_started", phase: "baseline-model", runId: "r" },
      { type: "entity_created", entity },
      { type: "relationship_updated", relationship },
      { type: "stale_marked", entityIds: [] },
      { type: "analysis_completed", runId: "r" },
    ];
    // All assignable to AnalysisEvent[]
    expect(events).toHaveLength(5);
    // Verify mixed array can be partitioned by guards
    const progress = events.filter(isProgressEvent);
    const mutations = events.filter(isMutationEvent);
    expect(progress).toHaveLength(2);
    expect(mutations).toHaveLength(3);
    expect(progress.length + mutations.length).toBe(events.length);
  });
});
