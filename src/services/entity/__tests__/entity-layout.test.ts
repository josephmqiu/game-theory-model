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

describe("entity layout", () => {
  it("positions Phase 1 (fact) entities in the left column", () => {
    const entities = [
      makeEntity({ id: "f1", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "f2", type: "fact", phase: "situational-grounding" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("f1")!.x).toBe(100);
    expect(positions.get("f2")!.x).toBe(100);
    // Stacked vertically with shared card height + shared gap
    expect(positions.get("f1")!.y).toBe(0);
    expect(positions.get("f2")!.y).toBe(
      getEntityCardMetrics("fact").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("positions Phase 2 (player/objective) entities in the center column", () => {
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
    // Player card height + shared gap
    expect(positions.get("p1")!.y).toBe(0);
    expect(positions.get("o1")!.y).toBe(
      getEntityCardMetrics("player").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("positions Phase 3 (game/strategy) entities in the right column", () => {
    const entities = [
      makeEntity({ id: "g1", type: "game", phase: "baseline-model" }),
      makeEntity({ id: "s1", type: "strategy", phase: "baseline-model" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("g1")!.x).toBe(900);
    expect(positions.get("s1")!.x).toBe(900);
    // Game card height + shared gap
    expect(positions.get("g1")!.y).toBe(0);
    expect(positions.get("s1")!.y).toBe(
      getEntityCardMetrics("game").height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  });

  it("assigns non-overlapping positions across mixed phases", () => {
    const entities = [
      makeEntity({ id: "f1", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "p1", type: "player", phase: "player-identification" }),
      makeEntity({ id: "g1", type: "game", phase: "baseline-model" }),
      makeEntity({ id: "f2", type: "fact", phase: "situational-grounding" }),
      makeEntity({ id: "s1", type: "strategy", phase: "baseline-model" }),
    ];

    const positions = layoutEntities(entities);

    // Correct columns
    expect(positions.get("f1")!.x).toBe(100);
    expect(positions.get("f2")!.x).toBe(100);
    expect(positions.get("p1")!.x).toBe(500);
    expect(positions.get("g1")!.x).toBe(900);
    expect(positions.get("s1")!.x).toBe(900);

    // No vertical overlaps within same column
    // Phase 1: f1 at y=0, f2 starts after fact height + shared gap
    expect(positions.get("f2")!.y).toBeGreaterThanOrEqual(
      positions.get("f1")!.y + getEntityCardMetrics("fact").height,
    );
    // Phase 3: g1 at y=0, s1 starts after game height + shared gap
    expect(positions.get("s1")!.y).toBeGreaterThanOrEqual(
      positions.get("g1")!.y + getEntityCardMetrics("game").height,
    );
  });

  it("returns empty map for empty entity array", () => {
    const positions = layoutEntities([]);

    expect(positions.size).toBe(0);
  });

  it("positions a single entity at column start", () => {
    const entities = [
      makeEntity({ id: "p1", type: "player", phase: "player-identification" }),
    ];

    const positions = layoutEntities(entities);

    expect(positions.get("p1")).toEqual({ x: 500, y: 0 });
  });
});

describe("layoutEntities — synthesis column", () => {
  it("routes analysis-report to synthesis column x=3700", () => {
    const entities = [
      makeEntity({ id: "rpt-1", type: "analysis-report", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    expect(positions.get("rpt-1")?.x).toBe(3700);
  });

  it("does not affect other entity type positioning", () => {
    const entities = [
      makeEntity({ id: "mc-1", type: "meta-check", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    expect(positions.get("mc-1")?.x).toBe(3300);
  });

  it("gives analysis-report its own vertical cursor", () => {
    const entities = [
      makeEntity({ id: "mc-1", type: "meta-check", phase: "meta-check" }),
      makeEntity({ id: "rpt-1", type: "analysis-report", phase: "meta-check" }),
    ];
    const positions = layoutEntities(entities);
    // analysis-report should start at y=0 in its own column, not stacked after mc-1
    expect(positions.get("rpt-1")?.y).toBe(0);
  });

  it("includes synthesis in PHASE_COLUMN_X", () => {
    expect(PHASE_COLUMN_X["synthesis"]).toBe(3700);
  });
});
