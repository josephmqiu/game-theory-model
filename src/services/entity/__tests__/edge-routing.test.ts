import { describe, it, expect } from "vitest";
import { routeEdges, type EntityRect } from "../edge-routing";
import type { AnalysisRelationship } from "@/types/entity";

function rect(
  id: string,
  phase: string,
  x: number,
  y: number,
  w = 240,
  h = 85,
): EntityRect {
  return { id, x, y, w, h, phase };
}

function rel(
  id: string,
  type: string,
  from: string,
  to: string,
): AnalysisRelationship {
  return { id, type: type as any, fromEntityId: from, toEntityId: to };
}

describe("routeEdges", () => {
  it("returns empty array for no entities", () => {
    const result = routeEdges([], [rel("r1", "plays-in", "a", "b")]);
    expect(result).toEqual([]);
  });

  it("returns empty array for no relationships", () => {
    const result = routeEdges([rect("a", "situational-grounding", 100, 0)], []);
    expect(result).toEqual([]);
  });

  it("skips relationships referencing missing entities", () => {
    const entities = [rect("a", "situational-grounding", 100, 0)];
    const rels = [rel("r1", "plays-in", "a", "missing")];
    const result = routeEdges(entities, rels);
    expect(result).toEqual([]);
  });

  it("routes a forward edge with right->left ports", () => {
    const entities = [
      rect("a", "situational-grounding", 100, 0),
      rect("b", "player-identification", 500, 0),
    ];
    const rels = [rel("r1", "plays-in", "a", "b")];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(1);
    const edge = result[0];
    expect(edge.direction).toBe("forward");
    // From port exits the right side of entity "a" (x + w = 100 + 240 = 340)
    expect(edge.from.x).toBe(340);
    // To port enters the left side of entity "b" (x = 500)
    expect(edge.to.x).toBe(500);
  });

  it("routes a backward edge with left->right ports", () => {
    const entities = [
      rect("a", "player-identification", 500, 0),
      rect("b", "situational-grounding", 100, 0),
    ];
    const rels = [rel("r1", "informed-by", "a", "b")];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(1);
    const edge = result[0];
    expect(edge.direction).toBe("backward");
    // From port exits the left side of entity "a" (x = 500)
    expect(edge.from.x).toBe(500);
    // To port enters the right side of entity "b" (x + w = 100 + 240 = 340)
    expect(edge.to.x).toBe(340);
  });

  it("routes a same-phase edge with bottom->top ports", () => {
    const entities = [
      rect("a", "player-identification", 500, 0, 240, 85),
      rect("b", "player-identification", 500, 120, 240, 85),
    ];
    const rels = [rel("r1", "conflicts-with", "a", "b")];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(1);
    const edge = result[0];
    expect(edge.direction).toBe("same-phase");
    // From port exits the bottom of upper entity "a" (y + h = 0 + 85 = 85)
    expect(edge.from.y).toBe(85);
    // To port enters the top of lower entity "b" (y = 120)
    expect(edge.to.y).toBe(120);
  });

  it("distributes multiple outgoing ports evenly on right edge", () => {
    const entities = [
      rect("a", "situational-grounding", 100, 0, 240, 85),
      rect("b", "player-identification", 500, 0),
      rect("c", "player-identification", 500, 120),
      rect("d", "player-identification", 500, 240),
    ];
    const rels = [
      rel("r1", "plays-in", "a", "b"),
      rel("r2", "plays-in", "a", "c"),
      rel("r3", "plays-in", "a", "d"),
    ];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(3);
    // All three edges exit the right side of "a"
    const fromYs = result.map((e) => e.from.y).sort((a, b) => a - b);
    // 3 ports on right side: 25%, 50%, 75% of height 85
    // portY = entityY + (h * (index + 1)) / (count + 1)
    // = 0 + (85 * 1) / 4 = 21.25
    // = 0 + (85 * 2) / 4 = 42.5
    // = 0 + (85 * 3) / 4 = 63.75
    expect(fromYs[0]).toBeCloseTo(21.25, 1);
    expect(fromYs[1]).toBeCloseTo(42.5, 1);
    expect(fromYs[2]).toBeCloseTo(63.75, 1);
  });

  it("generates waypoints for channel routing", () => {
    const entities = [
      rect("a", "situational-grounding", 100, 0),
      rect("b", "player-identification", 500, 0),
    ];
    const rels = [rel("r1", "plays-in", "a", "b")];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(1);
    const edge = result[0];
    // Should have at least 2 waypoints (exit + entry offsets, plus channel)
    expect(edge.waypoints.length).toBeGreaterThanOrEqual(2);
    // First waypoint should be EXIT_OFFSET (16px) to the right of the from port
    expect(edge.waypoints[0].x).toBe(edge.from.x + 16);
    // Last waypoint should be EXIT_OFFSET (16px) to the left of the to port
    expect(edge.waypoints[edge.waypoints.length - 1].x).toBe(edge.to.x - 16);
  });

  it("offsets parallel channel segments by CHANNEL_SPACING", () => {
    const entities = [
      rect("a", "situational-grounding", 100, 0, 240, 85),
      rect("b", "situational-grounding", 100, 120, 240, 85),
      rect("c", "player-identification", 500, 0, 240, 85),
    ];
    const rels = [
      rel("r1", "plays-in", "a", "c"),
      rel("r2", "plays-in", "b", "c"),
    ];
    const result = routeEdges(entities, rels);

    expect(result).toHaveLength(2);
    // Both edges route through the same inter-column gap (phase 1 -> phase 2)
    // Their vertical channel segments should be offset by CHANNEL_SPACING (8px)
    // Get x-values of channel waypoints (the middle waypoints — not exit/entry)
    const channelXs = result.map((edge) => {
      // Channel waypoints are the ones between exit and entry waypoints
      // For forward edges: waypoints[1] and waypoints[2] are the channel waypoints
      const midIdx = Math.floor(edge.waypoints.length / 2);
      return edge.waypoints[midIdx].x;
    });
    const diff = Math.abs(channelXs[0] - channelXs[1]);
    expect(diff).toBe(8);
  });
});
