import { useState } from 'react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useAppStore } from '../../store'
import { Badge } from '../design-system'
import { usePlayersRegistry } from '../../store/selectors/player-selectors'
import type { Player } from '../../types/canonical'
import { CreatePlayerWizard } from '../editors/wizards'

const PLAYER_TYPE_COLORS: Record<string, string> = {
  state: '#6366F1',
  organization: '#22C55E',
  individual: '#F59E0B',
  coalition: '#EC4899',
  market: '#14B8A6',
  public: '#64748B',
}

interface PlayerCardProps {
  player: Player
  gameCount: number
  onClick: () => void
}

function PlayerCard({ player, gameCount, onClick }: PlayerCardProps) {
  const typeColor = PLAYER_TYPE_COLORS[player.type] ?? '#64748B'
  const description = player.metadata?.description

  return (
    <button
      className="bg-bg-card border border-border rounded p-4 text-left hover:border-accent transition-colors w-full"
      onClick={onClick}
    >
      <div className="font-mono font-bold text-sm text-text-primary mb-2 truncate">
        {player.name}
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge color={typeColor}>{player.type}</Badge>
        <span className="font-mono text-xs text-text-muted">
          Appears in {gameCount} game{gameCount !== 1 ? 's' : ''}
        </span>
      </div>
      {description && (
        <p className="font-mono text-xs text-text-muted leading-relaxed line-clamp-2">
          {description}
        </p>
      )}
    </button>
  )
}

export function PlayersRegistry(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [showCreatePlayer, setShowCreatePlayer] = useState(false)

  const entries = usePlayersRegistry(canonical)

  function handlePlayerClick(playerId: string) {
    setInspectedRefs([{ type: 'player', id: playerId }])
  }

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary">PLAYERS</h1>
        <button
          className="flex items-center gap-1 px-3 py-2 font-mono text-xs font-bold text-bg-page bg-accent rounded hover:opacity-90 transition-opacity"
          onClick={() => setShowCreatePlayer(true)}
        >
          <Plus size={12} />
          ADD PLAYER
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-sm text-text-muted mb-1">No players yet</p>
            <p className="font-mono text-xs text-text-dim">
              Add players to model strategic actors in your analysis.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {entries.map(({ player, gameCount }) => (
            <PlayerCard
              key={player.id}
              player={player}
              gameCount={gameCount}
              onClick={() => handlePlayerClick(player.id)}
            />
          ))}
        </div>
      )}

      <CreatePlayerWizard open={showCreatePlayer} onClose={() => setShowCreatePlayer(false)} />
    </div>
  )
}
