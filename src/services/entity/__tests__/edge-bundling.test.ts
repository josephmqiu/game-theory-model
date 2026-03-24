import { describe, it, expect } from "vitest";
import { bundleEdges } from "../edge-bundling";
import type { RoutedEdge } from "../edge-routing";

function makeEdge(
  id: string,
  category: "downstream" | "evidence" | "structural",
  fromX: number,
  toX: number,
  fromY = 50,
  toY = 50,
): RoutedEdge {
  return {
    relationshipId: id,
    relType: "plays-in" as any,
    category,
    direction: "forward" as const,
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
    waypoints: [
      { x: (fromX + toX) / 2, y: fromY },
      { x: (fromX + toX) / 2, y: toY },
    ],
  };
}

describe("bundleEdges", () => {
  it("returns empty array for no edges", () => {
    expect(bundleEdges([])).toEqual([]);
  });

  it("passes through groups of 1-2 edges unchanged (no bundleId)", () => {
    const edges = [
      makeEdge("r1", "downstream", 340, 500),
      makeEdge("r2", "downstream", 340, 500, 70, 70),
    ];
    const result = bundleEdges(edges);
    expect(result).toHaveLength(2);
    expect(result.every((e) => !e.isTrunk && !e.bundleId)).toBe(true);
  });

  it("creates trunk for groups of 3+ edges in same (phase-pair, category)", () => {
    const edges = [
      makeEdge("r1", "downstream", 340, 500, 30, 30),
      makeEdge("r2", "downstream", 340, 500, 50, 50),
      makeEdge("r3", "downstream", 340, 500, 70, 70),
    ];
    const result = bundleEdges(edges);
    const trunks = result.filter((e) => e.isTrunk);
    expect(trunks).toHaveLength(1);
    expect(trunks[0].trunkChildCount).toBe(3);
    expect(trunks[0].bundleId).toBeDefined();
    // Individual edges should also be in result, marked with same bundleId
    const bundled = result.filter((e) => e.bundleId && !e.isTrunk);
    expect(bundled).toHaveLength(3);
  });

  it("bundles separately by category (preserves visual hierarchy)", () => {
    const edges = [
      makeEdge("r1", "downstream", 340, 500, 30, 30),
      makeEdge("r2", "downstream", 340, 500, 50, 50),
      makeEdge("r3", "downstream", 340, 500, 70, 70),
      makeEdge("r4", "evidence", 340, 500, 30, 30),
      makeEdge("r5", "evidence", 340, 500, 50, 50),
      makeEdge("r6", "evidence", 340, 500, 70, 70),
    ];
    const result = bundleEdges(edges);
    const trunks = result.filter((e) => e.isTrunk);
    expect(trunks).toHaveLength(2); // separate trunks for downstream and evidence
    const categories = trunks.map((t) => t.category);
    expect(categories).toContain("downstream");
    expect(categories).toContain("evidence");
  });

  it("does not bundle edges between different phase columns", () => {
    const edges = [
      makeEdge("r1", "downstream", 340, 500, 30, 30),
      makeEdge("r2", "downstream", 340, 500, 50, 50),
      makeEdge("r3", "downstream", 340, 900, 70, 70), // different target column!
    ];
    const result = bundleEdges(edges);
    const trunks = result.filter((e) => e.isTrunk);
    expect(trunks).toHaveLength(0); // neither group reaches threshold of 3
  });
});
