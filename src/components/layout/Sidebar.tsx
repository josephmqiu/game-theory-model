import type { ReactNode } from 'react'
import {
  Hexagon,
  LayoutDashboard,
  Swords,
  Users,
  FileText,
  GitBranch,
  Grid3x3,
  ListTree,
  BookOpen,
  Play,
  Settings,
} from 'lucide-react'

import { NavItem } from '../design-system'
import { useAppStore } from '../../store'
import type { ViewType } from '../../store'

export function Sidebar(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const canonical = useAppStore((s) => s.canonical)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setActiveGame = useAppStore((s) => s.setActiveGame)

  const activeGame = activeGameId ? canonical.games[activeGameId] : null
  const gameLabel = activeGame?.name ?? 'SELECTED GAME'

  function handleAppNav(view: ViewType) {
    setActiveGame(null)
    setActiveView(view)
  }

  function handleGameNav(view: ViewType) {
    setActiveView(view)
  }

  return (
    <aside className="flex flex-col w-[240px] bg-bg-sidebar border-r border-border-subtle flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border-subtle">
        <Hexagon className="w-5 h-5 text-accent flex-shrink-0" />
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">
          STRATEGIC LENS
        </span>
      </div>

      {/* APP section */}
      <nav className="flex flex-col pt-2">
        <span className="px-4 py-1 font-mono text-xs text-text-dim tracking-widest">APP</span>
        <NavItem
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="WORKFLOW BOARD"
          active={activeView === 'board' && activeGameId === null}
          onClick={() => handleAppNav('board')}
        />
        <NavItem
          icon={<Swords className="w-4 h-4" />}
          label="GAMES"
          active={activeView === 'board' && activeGameId !== null}
          onClick={() => handleAppNav('board')}
        />
        <NavItem
          icon={<Users className="w-4 h-4" />}
          label="PLAYERS"
          active={activeView === 'players_registry'}
          onClick={() => handleAppNav('players_registry')}
        />
        <NavItem
          icon={<FileText className="w-4 h-4" />}
          label="EVIDENCE"
          active={activeView === 'evidence_library'}
          onClick={() => handleAppNav('evidence_library')}
        />
      </nav>

      {/* GAME section — conditional */}
      {activeGameId !== null && (
        <nav className="flex flex-col mt-2">
          <div className="mx-4 border-t border-border-subtle mb-2" />
          <span className="px-4 py-1 font-mono text-xs text-text-dim tracking-widest truncate">
            {gameLabel.toUpperCase()}
          </span>
          <NavItem
            icon={<GitBranch className="w-4 h-4" />}
            label="GRAPH"
            active={activeView === 'graph'}
            onClick={() => handleGameNav('graph')}
          />
          <NavItem
            icon={<Grid3x3 className="w-4 h-4" />}
            label="MATRIX"
            active={activeView === 'matrix'}
            onClick={() => handleGameNav('matrix')}
          />
          <NavItem
            icon={<ListTree className="w-4 h-4" />}
            label="TREE"
            active={activeView === 'tree'}
            onClick={() => handleGameNav('tree')}
          />
          <NavItem
            icon={<BookOpen className="w-4 h-4" />}
            label="EVIDENCE"
            active={activeView === 'evidence_notebook'}
            onClick={() => handleGameNav('evidence_notebook')}
          />
          <NavItem
            icon={<Play className="w-4 h-4" />}
            label="PLAY"
            active={activeView === 'play'}
            onClick={() => handleGameNav('play')}
          />
        </nav>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom pinned */}
      <div className="border-t border-border-subtle pb-2 pt-2">
        <NavItem
          icon={<Settings className="w-4 h-4" />}
          label="SETTINGS"
          active={false}
          onClick={undefined}
        />
      </div>
    </aside>
  )
}
