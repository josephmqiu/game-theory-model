import { describe, expect, it } from "vitest";
import type { AnalysisEntity } from "@/types/entity";
import {
  layoutEntities,
  PHASE_COLUMN_X,
} from "@/services/entity/entity-layout";
import {
  ENTITY_CARD_LAYOUT,
  getEntityCardMetrics,
} from "@/services/entity/entity-card-metrics";

function makeEntity(
  overrides: Partial<AnalysisEntity> &
    Pick<AnalysisEntity, "id" | "type" | "phase">,
): AnalysisEntity {
  return {
    confidence: "medium",
    source: "ai",
    rationale: "",
    revision: 1,
    stale: false,
    data: {
      type: "fact",
      date: "",
      source: "",
      content: "",
      category: "action",
    } as AnalysisEntity["data"],
    ...overrides,
  };
}

describe("canvas entity layout — phase columns", () => {
  it("places situational-grounding entities in column 1 so facts appear at the left of the analysis flow", () => {
    const entities = [
      makeEntity({ id: "f1", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "f2", type: "fact", phase: "situational-grounding" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("f1")!.x).toBe(100);
    expect(positions.get("f2")!.x).toBe(100);
    expect(positions.get("f1")!.y).toBe(0);
    expect(positions.get("f2")!.y).toBe(
      getEntityCardMetrics("fact").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("places player-identification entities in column 2 so players appear after facts", () => {
    const entities = [
      makeEntity({ id: "p1", type: "player", phase: "player-identification" }),
      makeEntity({
        id: "o1",
        type: "objective",
        phase: "player-identification",
      }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("p1")!.x).toBe(500);
    expect(positions.get("o1")!.x).toBe(500);
    expect(positions.get("p1")!.y).toBe(0);
    expect(positions.get("o1")!.y).toBe(
      getEntityCardMetrics("player").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("places baseline-model entities in column 3 so games appear after players", () => {
    const entities = [
      makeEntity({ id: "g1", type: "game", phase: "baseline-model" }),
      makeEntity({ id: "s1", type: "strategy", phase: "baseline-model" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("g1")!.x).toBe(900);
    expect(positions.get("s1")!.x).toBe(900);
    expect(positions.get("g1")!.y).toBe(0);
    expect(positions.get("s1")!.y).toBe(
      getEntityCardMetrics("game").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("prevents entity card overlap when entities from multiple phases coexist", () => {
    const entities = [
      makeEntity({ id: "f1", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "p1", type: "player", phase: "player-identification" }),
      makeEntity({ id: "g1", type: "game", phase: "baseline-model" }),
      makeEntity({ id: "f2", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "s1", type: "strategy", phase: "baseline-model" }),
    ];

    const positions = layoutEntities(entities);

    // Each phase occupies a distinct column
    expect(positions.get("f1")!.x).toBe(100);
    expect(positions.get("f2")!.x).toBe(100);
    expect(positions.get("p1")!.x).toBe(500);
    expect(positions.get("g1")!.x).toBe(900);
    expect(positions.get("s1")!.x).toBe(900);

    // Entities in the same column are stacked without vertical overlap
    expect(positions.get("f2")!.y).toBeGreaterThanOrEqual(
      positions.get("f1")!.y + getEntityCardMetrics("fact").height,
    );
    expect(positions.get("s1")!.y).toBeGreaterThanOrEqual(
      positions.get("g1")!.y + getEntityCardMetrics("game").height,
    );
  });

  it("produces no positions for an empty analysis (no entities to layout)", () => {
    const positions = layoutEntities([]);
    expect(positions.size).toBe(0);
  });

  it("places a single entity at the top of its phase column", () => {
    const entities = [
      makeEntity({ id: "p1", type: "player", phase: "player-identification" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("p1")).toEqual({ x: 500, y: 0 });
  });
});

describe("canvas entity layout — synthesis column for analysis reports", () => {
  it("places the analysis-report entity in a dedicated synthesis column (x=3700) separate from all phase columns", () => {
    const entities = [
      makeEntity({ id: "rpt-1", type: "analysis-report", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    expect(positions.get("rpt-1")?.x).toBe(3700);
  });

  it("keeps meta-check entities in their original column when a report entity also exists", () => {
    const entities = [
      makeEntity({ id: "mc-1", type: "meta-check", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    expect(positions.get("mc-1")?.x).toBe(3300);
  });

  it("gives the report its own vertical cursor so it starts at y=0 regardless of other meta-check entities", () => {
    const entities = [
      makeEntity({ id: "mc-1", type: "meta-check", phase: "meta-check" }),
      makeEntity({ id: "rpt-1", type: "analysis-report", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    // Report starts at top of its own column, not stacked after meta-check entities
    expect(positions.get("rpt-1")?.y).toBe(0);
  });

  it("exposes the synthesis column coordinate in PHASE_COLUMN_X for auto-pan targeting", () => {
    expect(PHASE_COLUMN_X["synthesis"]).toBe(3700);
  });
});
