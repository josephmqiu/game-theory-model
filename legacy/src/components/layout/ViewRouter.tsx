import type { ReactNode } from 'react'
import { useAppStore, type ViewType } from '../../store'
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
import { ScenarioView } from '../views/scenario/ScenarioView'
import { InspectorPanel } from '../inspector'
import { RecoveryView } from '../shell/RecoveryView'
import { OverviewScreen } from '../views/overview/OverviewScreen'
import { NewAnalysisScreen } from '../views/new-analysis/NewAnalysisScreen'
import { ScenariosScreen } from '../views/scenarios/ScenariosScreen'
import { TimelineScreen } from '../views/timeline/TimelineScreen'
import { AssumptionsScreen } from '../views/assumptions/AssumptionsScreen'
import { SettingsScreen } from '../views/settings/SettingsScreen'
import { PhaseDetailScreen } from '../views/phases/PhaseDetailScreen'

const VIEWS_WITHOUT_INSPECTOR: ViewType[] = ['welcome', 'new_analysis']

function renderView(activeView: ViewType): ReactNode {
  // Phase detail views
  const phaseMatch = activeView.match(/^phase_(\d+)$/)
  if (phaseMatch) {
    return <PhaseDetailScreen phase={Number(phaseMatch[1])} />
  }

  switch (activeView) {
    // New top-level views
    case 'overview': return <OverviewScreen />
    case 'new_analysis': return <NewAnalysisScreen />
    case 'scenarios': return <ScenariosScreen />
    case 'timeline': return <TimelineScreen />
    case 'assumptions': return <AssumptionsScreen />
    case 'settings': return <SettingsScreen />
    case 'playout': return <div className="flex-1 p-6"><h1 className="text-lg font-bold text-text-primary">Play-outs</h1><p className="text-sm text-text-muted mt-2">Coming in M7</p></div>

    // Model lenses (new nav targets pointing to existing views)
    case 'game_map': return <GraphView />
    case 'evidence': return <EvidenceLibrary />
    case 'players': return <PlayersRegistry />

    // Legacy views (still accessible as drill-downs)
    case 'board': return <WorkflowBoard />
    case 'players_registry': return <PlayersRegistry />
    case 'evidence_library': return <EvidenceLibrary />
    case 'graph': return <GraphView />
    case 'matrix': return <MatrixView />
    case 'tree': return <TreeView />
    case 'evidence_notebook': return <EvidenceNotebook />
    case 'player_lens': return <PlayerLensView />
    case 'diff': return <DiffView />
    case 'scenario': return <ScenarioView />
    case 'play': return <div className="flex-1 p-6 text-text-muted">Play view</div>

    // Welcome (no inspector)
    case 'welcome': return <WelcomeScreen />

    default: return <div className="p-8 text-text-muted">{activeView}</div>
  }
}

export function ViewRouter(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const recoveryActive = useAppStore((s) => s.recovery.active)

  if (recoveryActive) {
    return <RecoveryView />
  }

  if (VIEWS_WITHOUT_INSPECTOR.includes(activeView)) {
    return renderView(activeView)
  }

  return (
    <div className="flex flex-1 h-full">
      {renderView(activeView)}
      <InspectorPanel />
    </div>
  )
}
