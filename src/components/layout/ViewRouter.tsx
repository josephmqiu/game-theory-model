import type { ReactNode } from 'react'
import { useAppStore } from '../../store'

export function ViewRouter(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const recoveryActive = useAppStore((s) => s.recovery.active)

  if (recoveryActive) {
    return <div className="p-8 text-warning">Recovery mode — file has errors</div>
  }

  switch (activeView) {
    case 'welcome':
      return <div className="p-8 text-text-muted">Welcome Screen</div>
    case 'board':
      return <div className="p-8 text-text-muted">Workflow Board</div>
    case 'players_registry':
      return <div className="p-8 text-text-muted">Players Registry</div>
    case 'evidence_library':
      return <div className="p-8 text-text-muted">Evidence Library</div>
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
