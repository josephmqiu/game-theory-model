import type { CanonicalStore } from '../../types/canonical'
import type { Player } from '../../types/canonical'

export interface PlayerRegistryEntry {
  player: Player
  gameCount: number
}

export function usePlayersRegistry(canonical: CanonicalStore): PlayerRegistryEntry[] {
  const entries: PlayerRegistryEntry[] = []

  for (const player of Object.values(canonical.players)) {
    const gameCount = Object.values(canonical.games).filter((game) =>
      game.players.includes(player.id),
    ).length

    entries.push({ player, gameCount })
  }

  return entries
}
