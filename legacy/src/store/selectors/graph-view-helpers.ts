import type { CanonicalStore, GameNode } from '../../types/canonical'

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

export function buildPlayerColorMap(
  canonical: CanonicalStore,
  gameId: string | null | undefined,
): Map<string, string> {
  const playerColorMap = new Map<string, string>()
  const game = gameId ? canonical.games[gameId] : null

  if (!game) {
    return playerColorMap
  }

  for (let index = 0; index < game.players.length; index += 1) {
    playerColorMap.set(
      game.players[index]!,
      PLAYER_COLORS[index % PLAYER_COLORS.length] ?? '#6B7280',
    )
  }

  return playerColorMap
}

export function resolvePlayerInfo(
  node: GameNode,
  players: CanonicalStore['players'],
  playerColorMap: Map<string, string>,
): { playerId: string | null; playerName: string | null; playerColor: string | null } {
  if (node.actor.kind !== 'player') {
    return { playerId: null, playerName: null, playerColor: null }
  }

  const player = players[node.actor.player_id]

  return {
    playerId: node.actor.player_id,
    playerName: player?.name ?? 'Unknown',
    playerColor: playerColorMap.get(node.actor.player_id) ?? '#6B7280',
  }
}

export function nodeTypeToReactFlowType(
  kind: GameNode['type'],
): 'decision' | 'chance' | 'terminal' {
  switch (kind) {
    case 'decision':
      return 'decision'
    case 'chance':
      return 'chance'
    case 'terminal':
      return 'terminal'
  }
}
