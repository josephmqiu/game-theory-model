import type { RoutedEdge } from "./edge-routing";

// ── Types ──

export interface BundledEdge extends RoutedEdge {
  /** Shared identifier for all edges in a bundle (trunk + children) */
  bundleId?: string;
  /** True for the synthetic trunk line that replaces the group visually */
  isTrunk?: boolean;
  /** Number of original edges this trunk represents */
  trunkChildCount?: number;
  /** The original edges collapsed into this trunk (for hover expansion in Task 7) */
  trunkChildEdges?: RoutedEdge[];
}

/** Minimum group size before edges are bundled into a trunk */
const BUNDLE_THRESHOLD = 3;

/** Round to nearest 100 to identify phase columns by x-position */
function columnKey(x: number): number {
  return Math.round(x / 100) * 100;
}

/**
 * Groups parallel edges sharing the same (phase-pair, category) into trunk
 * lines. Edges below the threshold pass through unchanged. Bundled edges
 * include both the synthetic trunk (isTrunk: true) and the original edges
 * (marked with bundleId, hidden by default until trunk hover).
 *
 * Pure function — no store imports.
 */
export function bundleEdges(edges: RoutedEdge[]): BundledEdge[] {
  if (edges.length === 0) return [];

  // Step 1: Group by (sourceColumn, targetColumn, category)
  const groups = new Map<string, RoutedEdge[]>();

  for (const edge of edges) {
    const srcCol = columnKey(edge.from.x);
    const tgtCol = columnKey(edge.to.x);
    const key = `${srcCol}:${tgtCol}:${edge.category}`;

    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(edge);
  }

  // Step 2: Build result — bundle groups that meet threshold, pass through the rest
  const result: BundledEdge[] = [];
  let bundleCounter = 0;

  for (const [, group] of groups) {
    if (group.length < BUNDLE_THRESHOLD) {
      // Below threshold: pass through unchanged (no bundleId)
      for (const edge of group) {
        result.push({ ...edge });
      }
      continue;
    }

    // Generate a unique bundle ID for this group
    bundleCounter++;
    const bundleId = `bundle-${bundleCounter}`;

    // Compute trunk line positions: average source y and average target y
    let sumFromY = 0;
    let sumToY = 0;
    for (const edge of group) {
      sumFromY += edge.from.y;
      sumToY += edge.to.y;
    }
    const avgFromY = sumFromY / group.length;
    const avgToY = sumToY / group.length;

    // Trunk uses the group's shared column x-positions
    const fromX = group[0].from.x;
    const toX = group[0].to.x;

    // Build trunk waypoints — midpoint channel like a normal routed edge
    const midX = (fromX + toX) / 2;
    const trunkWaypoints = [
      { x: midX, y: avgFromY },
      { x: midX, y: avgToY },
    ];

    // Add the synthetic trunk edge
    const trunk: BundledEdge = {
      // Use first edge's properties for relType (trunk inherits category)
      relationshipId: `${bundleId}-trunk`,
      relType: group[0].relType,
      category: group[0].category,
      direction: group[0].direction,
      from: { x: fromX, y: avgFromY },
      to: { x: toX, y: avgToY },
      waypoints: trunkWaypoints,
      // Bundle metadata
      bundleId,
      isTrunk: true,
      trunkChildCount: group.length,
      trunkChildEdges: group,
    };
    result.push(trunk);

    // Add original edges marked with bundleId (hidden by default, shown on hover)
    for (const edge of group) {
      result.push({ ...edge, bundleId });
    }
  }

  return result;
}
