import type { Node, Edge } from '@xyflow/react'

import type { CanonicalStore, GameNode, GameEdge } from '../../types/canonical'
import type { Formalization } from '../../types/formalizations'

export interface GraphNodeData {
  label: string
  nodeType: GameNode['type']
  playerId: string | null
  playerName: string | null
  playerColor: string | null
  terminalPayoffs: GameNode['terminal_payoffs']
  staleMarkers: GameNode['stale_markers']
  formalizationId: string
  [key: string]: unknown
}

export interface GraphEdgeData {
  label: string
  staleMarkers: GameEdge['stale_markers']
  [key: string]: unknown
}

export type GraphNode = Node<GraphNodeData, 'decision' | 'chance' | 'terminal'>
export type GraphEdge = Edge<GraphEdgeData, 'game'>

export interface GraphViewModel {
  nodes: GraphNode[]
  edges: GraphEdge[]
  formalization: Formalization | null
}

const PLAYER_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#22C55E', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#6B7280'
}

function resolvePlayerInfo(
  node: GameNode,
  players: CanonicalStore['players'],
  playerColorMap: Map<string, string>,
): { playerId: string | null; playerName: string | null; playerColor: string | null } {
  if (node.actor.kind !== 'player') {
    return { playerId: null, playerName: null, playerColor: null }
  }

  const player = players[node.actor.player_id]
  const color = playerColorMap.get(node.actor.player_id) ?? '#6B7280'

  return {
    playerId: node.actor.player_id,
    playerName: player?.name ?? 'Unknown',
    playerColor: color,
  }
}

function nodeTypeToReactFlowType(kind: GameNode['type']): 'decision' | 'chance' | 'terminal' {
  switch (kind) {
    case 'decision':
      return 'decision'
    case 'chance':
      return 'chance'
    case 'terminal':
      return 'terminal'
  }
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
  const game = canonical.games[formalization.game_id]
  const playerColorMap = new Map<string, string>()
  if (game) {
    for (let i = 0; i < game.players.length; i++) {
      playerColorMap.set(game.players[i]!, getPlayerColor(i))
    }
  }

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
