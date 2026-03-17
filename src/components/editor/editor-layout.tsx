import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import TopBar from './top-bar'
import AgentSettingsDialog from '@/components/shared/agent-settings-dialog'
import UpdateReadyBanner from './update-ready-banner'
import AnalysisPanel from '@/components/panels/analysis-panel'
import { useAgentSettingsStore } from '@/stores/agent-settings-store'
import { useElectronMenu } from '@/hooks/use-electron-menu'
import { initAppStorage } from '@/utils/app-storage'

export default function EditorLayout() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (!isMod || event.key !== ',') {
        return
      }

      event.preventDefault()
      useAgentSettingsStore.getState().setDialogOpen(true)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useElectronMenu()

  useEffect(() => {
    initAppStorage().then(() => {
      useAgentSettingsStore.getState().hydrate()
    })
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 p-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-primary">
                Phase 2 Workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Canonical analysis first
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                This workspace now centers the game-theory domain core instead
                of the legacy design canvas. The old document stack remains in
                the repo for later pruning, but it is no longer the live product
                truth.
              </p>
            </section>

            <AnalysisPanel />
          </div>
        </div>
        <AgentSettingsDialog />
      </div>
    </TooltipProvider>
  )
}
