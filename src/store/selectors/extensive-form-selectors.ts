import type { Node, Edge } from '@xyflow/react'

import type { CanonicalStore, GameNode, GameEdge } from '../../types/canonical'
import type { ExtensiveFormModel } from '../../types/formalizations'
import type { GraphNodeData, GraphEdgeData } from './graph-selectors'
import { computeTreeLayout } from '../../components/views/tree/tree-layout'

export type TreeNode = Node<GraphNodeData, 'decision' | 'chance' | 'terminal'>
export type TreeEdge = Edge<GraphEdgeData, 'game'>

export interface InformationSetGroup {
  id: string
  playerId: string
  nodeIds: readonly string[]
}

export interface ExtensiveFormViewModel {
  nodes: TreeNode[]
  edges: TreeEdge[]
  rootNodeId: string | null
  informationSets: readonly InformationSetGroup[]
  formalization: ExtensiveFormModel | null
}

const PLAYER_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#22C55E',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
]

function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#6B7280'
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

const EMPTY_VIEW_MODEL: ExtensiveFormViewModel = {
  nodes: [],
  edges: [],
  rootNodeId: null,
  informationSets: [],
  formalization: null,
}

export function selectExtensiveFormViewModel(
  canonical: CanonicalStore,
  formalizationId: string | null,
): ExtensiveFormViewModel {
  if (!formalizationId) {
    return EMPTY_VIEW_MODEL
  }

  const formalization = canonical.formalizations[formalizationId]
  if (!formalization || formalization.kind !== 'extensive_form') {
    return EMPTY_VIEW_MODEL
  }

  const ef = formalization as ExtensiveFormModel

  const game = canonical.games[ef.game_id]
  const playerColorMap = new Map<string, string>()
  if (game) {
    for (let i = 0; i < game.players.length; i++) {
      playerColorMap.set(game.players[i]!, getPlayerColor(i))
    }
  }

  const formNodes = Object.values(canonical.nodes).filter(
    (n) => n.formalization_id === formalizationId,
  )

  const formEdges = Object.values(canonical.edges).filter(
    (e) => e.formalization_id === formalizationId,
  )

  // Build adjacency for layout
  const layoutNodes = formNodes.map((n) => n.id)
  const layoutEdges = formEdges.map((e) => ({
    from: e.from,
    to: e.to,
  }))

  const positions = computeTreeLayout(ef.root_node_id, layoutNodes, layoutEdges)

  const nodes: TreeNode[] = formNodes.map((node) => {
    const { playerId, playerName, playerColor } = resolvePlayerInfo(
      node,
      canonical.players,
      playerColorMap,
    )

    const position = positions[node.id] ?? { x: 0, y: 0 }

    return {
      id: node.id,
      type: nodeTypeToReactFlowType(node.type),
      position,
      data: {
        label: node.label,
        nodeType: node.type,
        playerId,
        playerName,
        playerColor,
        terminalPayoffs: node.terminal_payoffs,
        staleMarkers: node.stale_markers,
        formalizationId,
      },
    }
  })

  const edges: TreeEdge[] = formEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'game' as const,
    data: {
      label: edge.label,
      staleMarkers: edge.stale_markers,
    },
  }))

  const informationSets: InformationSetGroup[] = ef.information_sets.map((infoSet) => ({
    id: infoSet.id,
    playerId: infoSet.player_id,
    nodeIds: infoSet.node_ids,
  }))

  return {
    nodes,
    edges,
    rootNodeId: ef.root_node_id,
    informationSets,
    formalization: ef,
  }
}
