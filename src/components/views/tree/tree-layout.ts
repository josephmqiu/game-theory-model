interface LayoutEdge {
  from: string
  to: string
}

const VERTICAL_GAP = 150
const HORIZONTAL_GAP = 200

export function computeTreeLayout(
  rootNodeId: string,
  nodeIds: readonly string[],
  edges: readonly LayoutEdge[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}

  if (nodeIds.length === 0) {
    return positions
  }

  // Build children map
  const childrenMap = new Map<string, string[]>()
  const hasParent = new Set<string>()

  for (const edge of edges) {
    const existing = childrenMap.get(edge.from)
    if (existing) {
      existing.push(edge.to)
    } else {
      childrenMap.set(edge.from, [edge.to])
    }
    hasParent.add(edge.to)
  }

  // Calculate subtree widths for proper horizontal distribution
  const subtreeWidths = new Map<string, number>()

  function getSubtreeWidth(nodeId: string): number {
    const cached = subtreeWidths.get(nodeId)
    if (cached !== undefined) {
      return cached
    }

    const children = childrenMap.get(nodeId)
    if (!children || children.length === 0) {
      subtreeWidths.set(nodeId, 1)
      return 1
    }

    let width = 0
    for (const child of children) {
      width += getSubtreeWidth(child)
    }

    subtreeWidths.set(nodeId, width)
    return width
  }

  // Compute widths starting from root
  getSubtreeWidth(rootNodeId)

  // Also compute for any orphan trees
  for (const nodeId of nodeIds) {
    if (!hasParent.has(nodeId) && nodeId !== rootNodeId) {
      getSubtreeWidth(nodeId)
    }
  }

  // Position nodes using DFS
  function positionNode(
    nodeId: string,
    depth: number,
    leftBound: number,
  ): void {
    const width = subtreeWidths.get(nodeId) ?? 1
    const x = leftBound + (width * HORIZONTAL_GAP) / 2
    const y = depth * VERTICAL_GAP

    positions[nodeId] = { x, y }

    const children = childrenMap.get(nodeId)
    if (!children || children.length === 0) {
      return
    }

    let currentLeft = leftBound
    for (const child of children) {
      const childWidth = subtreeWidths.get(child) ?? 1
      positionNode(child, depth + 1, currentLeft)
      currentLeft += childWidth * HORIZONTAL_GAP
    }
  }

  // Position the main tree from root
  positionNode(rootNodeId, 0, 0)

  // Position any orphan nodes that aren't reachable from root
  let orphanOffset = (subtreeWidths.get(rootNodeId) ?? 1) * HORIZONTAL_GAP + HORIZONTAL_GAP
  for (const nodeId of nodeIds) {
    if (!(nodeId in positions)) {
      if (!hasParent.has(nodeId)) {
        positionNode(nodeId, 0, orphanOffset)
        orphanOffset += (subtreeWidths.get(nodeId) ?? 1) * HORIZONTAL_GAP + HORIZONTAL_GAP
      }
    }
  }

  // Final pass: any remaining unpositioned nodes get placed in a row
  let remainingOffset = 0
  for (const nodeId of nodeIds) {
    if (!(nodeId in positions)) {
      positions[nodeId] = { x: orphanOffset + remainingOffset, y: 0 }
      remainingOffset += HORIZONTAL_GAP
    }
  }

  return positions
}
