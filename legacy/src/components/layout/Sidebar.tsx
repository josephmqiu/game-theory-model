import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  LayoutDashboard, Clock, GitBranch, Play,
  Map, FileText, Users, ShieldAlert,
  Circle, CheckCircle, AlertTriangle, Loader,
  ChevronDown, ChevronRight,
  Settings, Hexagon,
} from 'lucide-react'
import { usePhaseProgress } from '../../hooks/usePhaseProgress'
import { NavItem } from '../design-system'
import { useAppStore } from '../../store'
import type { ViewType } from '../../store'

const PHASE_NAMES: Record<number, string> = {
  1: 'Grounding', 2: 'Players', 3: 'Baseline', 4: 'History', 5: 'Revalidation',
  6: 'Formalization', 7: 'Assumptions', 8: 'Elimination', 9: 'Scenarios', 10: 'Meta-check',
}

function PhaseStatusIcon({ status }: { status?: string }): ReactNode {
  switch (status) {
    case 'active': return <Loader className="w-3 h-3 text-amber-400 animate-spin" />
    case 'complete': return <CheckCircle className="w-3 h-3 text-green-500" />
    case 'needs_rerun': return <AlertTriangle className="w-3 h-3 text-orange-400" />
    default: return <Circle className="w-3 h-3 text-zinc-600" />
  }
}

export function Sidebar(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const [phasesCollapsed, setPhasesCollapsed] = useState(false)
  const { phases } = usePhaseProgress()

  function nav(view: ViewType) {
    setActiveView(view)
  }

  return (
    <aside className="flex flex-col w-[240px] bg-bg-sidebar border-r border-border-subtle flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border-subtle">
        <Hexagon className="w-5 h-5 text-accent flex-shrink-0" />
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">STRATEGIC LENS</span>
      </div>

      {/* Top-level nav */}
      <nav className="flex flex-col pt-2">
        <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active={activeView === 'overview'} onClick={() => nav('overview')} />
        <NavItem icon={<Clock className="w-4 h-4" />} label="Timeline" active={activeView === 'timeline'} onClick={() => nav('timeline')} />
        <NavItem icon={<GitBranch className="w-4 h-4" />} label="Scenarios" active={activeView === 'scenarios'} onClick={() => nav('scenarios')} />
        <NavItem icon={<Play className="w-4 h-4" />} label="Play-outs" active={activeView === 'playout'} onClick={() => nav('playout')} />
      </nav>

      {/* MODELS section */}
      <nav className="flex flex-col mt-2">
        <div className="mx-4 border-t border-border-subtle mb-2" />
        <span className="px-4 py-1 font-mono text-xs text-text-dim tracking-widest">MODELS</span>
        <NavItem icon={<Map className="w-4 h-4" />} label="Game Map" active={activeView === 'game_map' || activeView === 'graph'} onClick={() => nav('game_map')} />
        <NavItem icon={<FileText className="w-4 h-4" />} label="Evidence" active={activeView === 'evidence' || activeView === 'evidence_library' || activeView === 'evidence_notebook'} onClick={() => nav('evidence')} />
        <NavItem icon={<Users className="w-4 h-4" />} label="Players" active={activeView === 'players' || activeView === 'players_registry'} onClick={() => nav('players')} />
        <NavItem icon={<ShieldAlert className="w-4 h-4" />} label="Assumptions" active={activeView === 'assumptions'} onClick={() => nav('assumptions')} />
      </nav>

      {/* PHASES section (collapsible) */}
      <nav className="flex flex-col mt-2">
        <div className="mx-4 border-t border-border-subtle mb-2" />
        <button
          type="button"
          className="flex items-center gap-1 px-4 py-1 font-mono text-xs text-text-dim tracking-widest hover:text-text-muted transition-colors"
          onClick={() => setPhasesCollapsed(!phasesCollapsed)}
        >
          {phasesCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          PHASES
        </button>
        {!phasesCollapsed && (
          <>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <NavItem
                key={n}
                icon={<PhaseStatusIcon
                  status={phases.find((phase) => phase.number === n)?.status === 'active'
                    ? 'active'
                    : phases.find((phase) => phase.number === n)?.status === 'complete'
                      ? 'complete'
                      : phases.find((phase) => phase.number === n)?.status === 'review_needed'
                        || phases.find((phase) => phase.number === n)?.status === 'needs_rerun'
                        ? 'needs_rerun'
                        : 'pending'}
                />}
                label={`P${n} ${PHASE_NAMES[n]}`}
                active={activeView === `phase_${n}`}
                onClick={() => nav(`phase_${n}` as ViewType)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom pinned */}
      <div className="border-t border-border-subtle pb-2 pt-2">
        <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" active={activeView === 'settings'} onClick={() => nav('settings')} />
      </div>
    </aside>
  )
}
