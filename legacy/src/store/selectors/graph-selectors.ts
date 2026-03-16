import type { Node, Edge } from '@xyflow/react'

import type { CanonicalStore, GameNode, GameEdge } from '../../types/canonical'
import type { Formalization } from '../../types/formalizations'
import {
  buildPlayerColorMap,
  nodeTypeToReactFlowType,
  resolvePlayerInfo,
} from './graph-view-helpers'

export interface GraphNodeData {
  label: string
  nodeType: GameNode['type']
  playerId: string | null
  playerName: string | null
  playerColor: string | null
  terminalPayoffs: GameNode['terminal_payoffs']
  staleMarkers: GameNode['stale_markers']
  formalizationId: string
  highlighted?: boolean
  subgameSummary?: string
  [key: string]: unknown
}

export interface GraphEdgeData {
  label: string
  staleMarkers: GameEdge['stale_markers']
  highlighted?: boolean
  dimmed?: boolean
  [key: string]: unknown
}

export type GraphNode = Node<GraphNodeData, 'decision' | 'chance' | 'terminal'>
export type GraphEdge = Edge<GraphEdgeData, 'game'>

export interface GraphViewModel {
  nodes: GraphNode[]
  edges: GraphEdge[]
  formalization: Formalization | null
}

export function buildGraphViewModel(
  canonical: CanonicalStore,
  activeFormalizationId: string | null,
): GraphViewModel {
  if (!activeFormalizationId) {
    return { nodes: [], edges: [], formalization: null }
  }

  const formalization = canonical.formalizations[activeFormalizationId] ?? null
  if (!formalization) {
    return { nodes: [], edges: [], formalization: null }
  }

  // Build player color map from the game's player list
  const playerColorMap = buildPlayerColorMap(canonical, formalization.game_id)

  // Filter nodes belonging to this formalization
  const formNodes = Object.values(canonical.nodes).filter(
    (n) => n.formalization_id === activeFormalizationId,
  )

  // Filter edges belonging to this formalization
  const formEdges = Object.values(canonical.edges).filter(
    (e) => e.formalization_id === activeFormalizationId,
  )

  // Auto-layout: arrange nodes in a simple top-down tree
  const nodes: GraphNode[] = formNodes.map((node, index) => {
    const { playerId, playerName, playerColor } = resolvePlayerInfo(
      node,
      canonical.players,
      playerColorMap,
    )

    return {
      id: node.id,
      type: nodeTypeToReactFlowType(node.type),
      position: { x: index * 200, y: Math.floor(index / 3) * 150 },
      data: {
        label: node.label,
        nodeType: node.type,
        playerId,
        playerName,
        playerColor,
        terminalPayoffs: node.terminal_payoffs,
        staleMarkers: node.stale_markers,
        formalizationId: activeFormalizationId,
      },
    }
  })

  const edges: GraphEdge[] = formEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'game' as const,
    data: {
      label: edge.label,
      staleMarkers: edge.stale_markers,
    },
  }))

  return { nodes, edges, formalization }
}
