import type { ReactNode } from 'react'
import { useAppStore } from '../../store'
import { WelcomeScreen } from '../shell/WelcomeScreen'
import { WorkflowBoard } from '../shell/WorkflowBoard'
import { PlayersRegistry } from '../shell/PlayersRegistry'
import { EvidenceLibrary } from '../shell/EvidenceLibrary'

export function ViewRouter(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const recoveryActive = useAppStore((s) => s.recovery.active)

  if (recoveryActive) {
    return <div className="p-8 text-warning">Recovery mode — file has errors</div>
  }

  switch (activeView) {
    case 'welcome':
      return <WelcomeScreen />
    case 'board':
      return <WorkflowBoard />
    case 'players_registry':
      return <PlayersRegistry />
    case 'evidence_library':
      return <EvidenceLibrary />
    case 'graph':
      return <div className="p-8 text-text-muted">Graph View</div>
    case 'matrix':
      return <div className="p-8 text-text-muted">Matrix View</div>
    case 'tree':
      return <div className="p-8 text-text-muted">Tree View</div>
    case 'evidence_notebook':
      return <div className="p-8 text-text-muted">Evidence Notebook</div>
    default:
      return <div className="p-8 text-text-muted">{activeView}</div>
  }
}
