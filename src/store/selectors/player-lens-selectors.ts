import type { CanonicalStore, StrategicGame, EntityRef, StaleMarker } from '../../types/canonical'
import type { ObjectiveRef } from '../../types/auxiliary'
import type { CrossGameLink } from '../../types/evidence'

export interface PressurePoint {
  entity_ref: EntityRef
  label: string
  reason: string
}

export interface CrossGameExposure {
  link: CrossGameLink
  sourceGameName: string
  targetGameName: string
}

export interface PlayerLensData {
  playerId: string
  playerName: string
  gamesInvolved: StrategicGame[]
  objectives: ObjectiveRef[]
  pressurePoints: PressurePoint[]
  crossGameExposure: CrossGameExposure[]
}

function collectStaleAssumptions(
  canonical: CanonicalStore,
  gameIds: ReadonlyArray<string>,
): PressurePoint[] {
  const points: PressurePoint[] = []
  const relevantAssumptionIds = new Set<string>()

  for (const gameId of gameIds) {
    const game = canonical.games[gameId]
    if (!game) continue

    for (const assumptionId of game.key_assumptions) {
      relevantAssumptionIds.add(assumptionId)
    }

    for (const formId of game.formalizations) {
      const form = canonical.formalizations[formId]
      if (!form) continue
      for (const assumptionId of form.assumptions) {
        relevantAssumptionIds.add(assumptionId)
      }
    }
  }

  for (const assumptionId of relevantAssumptionIds) {
    const assumption = canonical.assumptions[assumptionId]
    if (!assumption) continue

    const markers = assumption.stale_markers
    if (!markers || markers.length === 0) continue

    for (const marker of markers) {
      points.push({
        entity_ref: { type: 'assumption', id: assumptionId },
        label: assumption.statement,
        reason: marker.reason,
      })
    }
  }

  return points
}

function collectStaleEntitiesInGames(
  canonical: CanonicalStore,
  gameIds: ReadonlyArray<string>,
): PressurePoint[] {
  const points: PressurePoint[] = []

  for (const gameId of gameIds) {
    const game = canonical.games[gameId]
    if (!game) continue

    if (game.stale_markers && game.stale_markers.length > 0) {
      for (const marker of game.stale_markers) {
        points.push({
          entity_ref: { type: 'game', id: gameId },
          label: game.name,
          reason: marker.reason,
        })
      }
    }
  }

  return points
}

export function usePlayerLens(
  canonical: CanonicalStore,
  playerId: string | null,
): PlayerLensData | null {
  if (!playerId) {
    return null
  }

  const player = canonical.players[playerId]
  if (!player) {
    return null
  }

  const gamesInvolved = Object.values(canonical.games).filter((game) =>
    game.players.includes(playerId),
  )

  const gameIds = gamesInvolved.map((g) => g.id)

  const objectives = player.objectives

  const staleAssumptions = collectStaleAssumptions(canonical, gameIds)
  const staleEntities = collectStaleEntitiesInGames(canonical, gameIds)
  const pressurePoints = [...staleAssumptions, ...staleEntities]

  const crossGameExposure: CrossGameExposure[] = []
  for (const link of Object.values(canonical.cross_game_links)) {
    const isInSourceGame = gameIds.includes(link.source_game_id)
    const isInTargetGame = gameIds.includes(link.target_game_id)
    const isTargetPlayer = link.target_player_id === playerId

    if (isInSourceGame || isInTargetGame || isTargetPlayer) {
      crossGameExposure.push({
        link,
        sourceGameName: canonical.games[link.source_game_id]?.name ?? link.source_game_id,
        targetGameName: canonical.games[link.target_game_id]?.name ?? link.target_game_id,
      })
    }
  }

  return {
    playerId,
    playerName: player.name,
    gamesInvolved,
    objectives,
    pressurePoints,
    crossGameExposure,
  }
}
