import type { ReactNode } from 'react'
import { Undo2, Redo2, Save } from 'lucide-react'

import { Breadcrumb } from '../design-system'

interface ToolbarButtonProps {
  disabled?: boolean
  onClick?: () => void
  title?: string
  children: ReactNode
}

function ToolbarButton({ disabled, onClick, title, children }: ToolbarButtonProps): ReactNode {
  return (
    <button
      className="flex items-center justify-center w-8 h-8 rounded text-text-dim hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}
import { useAppStore } from '../../store'
import type { ViewType } from '../../store'

const VIEW_LABELS: Record<ViewType, string> = {
  welcome: 'Welcome',
  board: 'Workflow Board',
  players_registry: 'Players Registry',
  evidence_library: 'Evidence Library',
  graph: 'Graph',
  matrix: 'Matrix',
  tree: 'Tree',
  timeline: 'Timeline',
  player_lens: 'Player Lens',
  evidence_notebook: 'Evidence Notebook',
  scenario: 'Scenario',
  play: 'Play',
  diff: 'Diff',
}

function buildBreadcrumbs(
  activeView: ViewType,
  activeGameId: string | null,
  gameName: string | null,
): string[] {
  const gameViews: ViewType[] = ['graph', 'matrix', 'tree', 'evidence_notebook', 'play']
  const isGameView = gameViews.includes(activeView)

  if (isGameView && activeGameId !== null && gameName !== null) {
    return ['Games', gameName, VIEW_LABELS[activeView]]
  }

  return [VIEW_LABELS[activeView]]
}

export function TopBar(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const canonical = useAppStore((s) => s.canonical)
  const eventLog = useAppStore((s) => s.eventLog)
  const fileMeta = useAppStore((s) => s.fileMeta)
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const saveFile = useAppStore((s) => s.saveFile)

  const activeGame = activeGameId ? canonical.games[activeGameId] : null
  const gameName = activeGame?.name ?? null

  const breadcrumbs = buildBreadcrumbs(activeView, activeGameId, gameName)

  const canUndo = eventLog.cursor > 0
  const canRedo = eventLog.cursor < eventLog.events.length
  const canSave = fileMeta.dirty

  function handleSave() {
    saveFile().catch(() => {
      // saveFile not yet implemented — silently ignore
    })
  }

  return (
    <header className="flex items-center justify-between h-12 px-6 border-b border-border-subtle flex-shrink-0">
      <Breadcrumb segments={breadcrumbs} />

      <div className="flex items-center gap-1">
        <ToolbarButton disabled={!canUndo} onClick={() => undo()} title="Undo">
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton disabled={!canRedo} onClick={() => redo()} title="Redo">
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton disabled={!canSave} onClick={handleSave} title="Save">
          <Save className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </header>
  )
}
