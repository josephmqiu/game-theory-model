import { useState } from 'react'
import type { ReactNode } from 'react'
import { Filter, ArrowUpDown, Plus } from 'lucide-react'
import { useAppStore } from '../../store'
import { Badge } from '../design-system'
import { selectWorkflowColumns } from '../../store/selectors/board-selectors'
import type { WorkflowColumn } from '../../store/selectors/board-selectors'
import type { StrategicGame } from '../../types/canonical'
import { CreateGameWizard } from '../editors/wizards'

const COLUMN_LABELS: Record<WorkflowColumn, string> = {
  draft: 'DRAFT',
  modeling: 'MODELING',
  formalized: 'FORMALIZED',
  review: 'REVIEW',
}

const COLUMN_COLORS: Record<WorkflowColumn, string> = {
  draft: '#64748B',
  modeling: '#F59E0B',
  formalized: '#22C55E',
  review: '#6366F1',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  paused: '#F59E0B',
  resolved: '#6366F1',
  stale: '#64748B',
}

interface GameCardProps {
  game: StrategicGame
  formalizationCount: number
  onClick: () => void
}

function GameCard({ game, formalizationCount, onClick }: GameCardProps) {
  const statusColor = STATUS_COLORS[game.status] ?? '#64748B'

  return (
    <button
      className="w-full bg-bg-card border border-border rounded p-4 text-left hover:border-accent transition-colors"
      onClick={onClick}
    >
      <div className="font-mono font-bold text-sm text-text-primary mb-2 truncate">{game.name}</div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={statusColor}>{game.status}</Badge>
        <span className="font-mono text-xs text-text-muted">
          {game.players.length} player{game.players.length !== 1 ? 's' : ''}
        </span>
        <span className="font-mono text-xs text-text-muted">
          {formalizationCount} form{formalizationCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  )
}

interface KanbanColumnProps {
  column: WorkflowColumn
  games: StrategicGame[]
  formalizationCounts: Record<string, number>
  onGameClick: (gameId: string) => void
}

function KanbanColumn({ column, games, formalizationCounts, onGameClick }: KanbanColumnProps) {
  const label = COLUMN_LABELS[column]
  const color = COLUMN_COLORS[column]

  return (
    <div className="flex flex-col min-w-[220px] flex-1">
      <div
        className="flex items-center gap-2 px-3 py-2 mb-3 border-b-2"
        style={{ borderColor: color }}
      >
        <span className="font-mono font-bold text-xs tracking-widest" style={{ color }}>
          {label}
        </span>
        <span
          className="font-mono text-xs rounded px-1"
          style={{ color, backgroundColor: `${color}26` }}
        >
          {games.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            formalizationCount={formalizationCounts[game.id] ?? 0}
            onClick={() => onGameClick(game.id)}
          />
        ))}
        {games.length === 0 && (
          <div className="font-mono text-xs text-text-dim px-3 py-4 text-center border border-dashed border-border rounded">
            No games
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkflowBoard(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const setActiveGame = useAppStore((s) => s.setActiveGame)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const [showCreateGame, setShowCreateGame] = useState(false)

  const columns = selectWorkflowColumns(canonical)

  const formalizationCounts: Record<string, number> = {}
  for (const game of Object.values(canonical.games)) {
    formalizationCounts[game.id] = game.formalizations.length
  }

  function handleGameClick(gameId: string) {
    setActiveGame(gameId)
    setActiveView('graph')
  }

  const columnOrder: WorkflowColumn[] = ['draft', 'modeling', 'formalized', 'review']

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary">
          ANALYSIS WORKFLOW
        </h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-2 font-mono text-xs text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors">
            <Filter size={12} />
            FILTER
          </button>
          <button className="flex items-center gap-1 px-3 py-2 font-mono text-xs text-text-muted border border-border rounded hover:text-text-primary hover:border-text-muted transition-colors">
            <ArrowUpDown size={12} />
            SORT
          </button>
          <button
            className="flex items-center gap-1 px-3 py-2 font-mono text-xs font-bold text-bg-page bg-accent rounded hover:opacity-90 transition-opacity"
            onClick={() => setShowCreateGame(true)}
          >
            <Plus size={12} />
            ADD
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-x-auto pb-2">
        {columnOrder.map((col) => (
          <KanbanColumn
            key={col}
            column={col}
            games={columns[col]}
            formalizationCounts={formalizationCounts}
            onGameClick={handleGameClick}
          />
        ))}
      </div>

      <CreateGameWizard open={showCreateGame} onClose={() => setShowCreateGame(false)} />
    </div>
  )
}
