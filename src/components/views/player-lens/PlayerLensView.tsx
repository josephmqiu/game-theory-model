import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { User, Target, AlertTriangle, Link2 } from 'lucide-react'

import { useAppStore } from '../../../store'
import { usePlayerLens } from '../../../store/selectors/player-lens-selectors'
import type { PressurePoint, CrossGameExposure } from '../../../store/selectors/player-lens-selectors'
import { Badge, StaleBadge, Card } from '../../design-system'
import type { StrategicGame } from '../../../types/canonical'
import type { ObjectiveRef } from '../../../types/auxiliary'

const GAME_STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  paused: '#F59E0B',
  resolved: '#6366F1',
  stale: '#64748B',
}

interface GameListProps {
  games: StrategicGame[]
}

function GameList({ games }: GameListProps) {
  if (games.length === 0) {
    return (
      <p className="font-mono text-xs text-text-dim py-2">Not involved in any games</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {games.map((game) => (
        <div
          key={game.id}
          className="flex items-center justify-between py-2 px-3 bg-bg-card border border-border rounded"
        >
          <span className="font-mono text-sm text-text-primary truncate">{game.name}</span>
          <Badge color={GAME_STATUS_COLORS[game.status] ?? '#64748B'}>
            {game.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}

interface ObjectiveListProps {
  objectives: ReadonlyArray<ObjectiveRef>
}

function ObjectiveList({ objectives }: ObjectiveListProps) {
  if (objectives.length === 0) {
    return (
      <p className="font-mono text-xs text-text-dim py-2">No objectives defined</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {objectives.map((obj, index) => (
        <div
          key={index}
          className="py-2 px-3 bg-bg-card border border-border rounded"
        >
          <div className="font-mono text-sm text-text-primary">{obj.label}</div>
          {obj.description && (
            <div className="font-mono text-xs text-text-muted mt-1">{obj.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] text-text-dim">
              Weight conf: {obj.weight.confidence}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

interface PressurePointListProps {
  points: PressurePoint[]
}

function PressurePointList({ points }: PressurePointListProps) {
  if (points.length === 0) {
    return (
      <p className="font-mono text-xs text-text-dim py-2">No pressure points detected</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {points.map((point, index) => (
        <div
          key={`${point.entity_ref.type}:${point.entity_ref.id}:${index}`}
          className="flex items-start gap-2 py-2 px-3 bg-bg-card border border-border rounded"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StaleBadge />
              <Badge>{point.entity_ref.type.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="font-mono text-sm text-text-primary mt-1 truncate">{point.label}</p>
            <p className="font-mono text-xs text-text-muted mt-0.5">{point.reason}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface CrossGameExposureListProps {
  exposures: CrossGameExposure[]
}

function CrossGameExposureList({ exposures }: CrossGameExposureListProps) {
  if (exposures.length === 0) {
    return (
      <p className="font-mono text-xs text-text-dim py-2">No cross-game exposure</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {exposures.map((exposure) => (
        <div
          key={exposure.link.id}
          className="flex items-center gap-2 py-2 px-3 bg-bg-card border border-border rounded"
        >
          <Link2 size={12} className="text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-text-primary">
              {exposure.sourceGameName} &rarr; {exposure.targetGameName}
            </p>
            <p className="font-mono text-[10px] text-text-muted">
              {exposure.link.effect_type.replace(/_/g, ' ')}
            </p>
          </div>
          <Badge>{exposure.link.effect_type.replace(/_/g, ' ')}</Badge>
        </div>
      ))}
    </div>
  )
}

export function PlayerLensView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const inspectedRefs = useAppStore((s) => s.viewState.inspectedRefs)

  const activePlayerId = useMemo(() => {
    const playerRef = inspectedRefs.find((ref) => ref.type === 'player')
    return playerRef?.id ?? null
  }, [inspectedRefs])

  const lensData = useMemo(
    () => usePlayerLens(canonical, activePlayerId),
    [canonical, activePlayerId],
  )

  if (!lensData) {
    return (
      <div className="flex flex-col h-full p-6 bg-bg-page">
        <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary mb-6">
          PLAYER LENS
        </h1>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <User size={32} className="text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted mb-1">No player selected</p>
            <p className="font-mono text-xs text-text-dim">
              Select a player from the Players Registry to view their strategic lens.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <User size={20} className="text-accent" />
        <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary">
          {lensData.playerName.toUpperCase()}
        </h1>
      </div>

      <div className="flex flex-col gap-6 max-w-3xl">
        <Card title="Games Involved">
          <GameList games={lensData.gamesInvolved} />
        </Card>

        <Card title="Objectives">
          <ObjectiveList objectives={lensData.objectives} />
        </Card>

        <Card title="Pressure Points">
          <PressurePointList points={lensData.pressurePoints} />
        </Card>

        <Card title="Cross-Game Exposure">
          <CrossGameExposureList exposures={lensData.crossGameExposure} />
        </Card>
      </div>
    </div>
  )
}
