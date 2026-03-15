import type { ReactNode } from 'react'
import { useAppStore } from '../../store'
import { WelcomeScreen } from '../shell/WelcomeScreen'
import { WorkflowBoard } from '../shell/WorkflowBoard'
import { PlayersRegistry } from '../shell/PlayersRegistry'
import { EvidenceLibrary } from '../shell/EvidenceLibrary'
import { GraphView } from '../views/graph/GraphView'
import { EvidenceNotebook } from '../views/evidence/EvidenceNotebook'
import { MatrixView } from '../views/matrix/MatrixView'
import { TreeView } from '../views/tree/TreeView'
import { TimelineView } from '../views/timeline/TimelineView'
import { PlayerLensView } from '../views/player-lens/PlayerLensView'
import { DiffView } from '../views/diff/DiffView'
import { InspectorPanel } from '../inspector'

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
      return (
        <div className="flex flex-1 h-full">
          <GraphView />
          <InspectorPanel />
        </div>
      )
    case 'matrix':
      return (
        <div className="flex flex-1 h-full">
          <MatrixView />
          <InspectorPanel />
        </div>
      )
    case 'tree':
      return (
        <div className="flex flex-1 h-full">
          <TreeView />
          <InspectorPanel />
        </div>
      )
    case 'evidence_notebook':
      return <EvidenceNotebook />
    case 'timeline':
      return <TimelineView />
    case 'player_lens':
      return <PlayerLensView />
    case 'diff':
      return <DiffView />
    default:
      return <div className="p-8 text-text-muted">{activeView}</div>
  }
}
