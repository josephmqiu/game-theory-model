import { useCallback, useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import TopBar from './top-bar'
import Toolbar from './toolbar'
import BooleanToolbar from './boolean-toolbar'
import StatusBar from './status-bar'
import LayerPanel from '@/components/panels/layer-panel'
import RightPanel from '@/components/panels/right-panel'
import AIChatPanel, { AIChatMinimizedBar } from '@/components/panels/ai-chat-panel'
import SaveDialog from '@/components/shared/save-dialog'
import AgentSettingsDialog from '@/components/shared/agent-settings-dialog'
import UpdateReadyBanner from './update-ready-banner'
import { useAIStore } from '@/stores/ai-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore } from '@/stores/document-store'
import { useAgentSettingsStore } from '@/stores/agent-settings-store'
import { useThemePresetStore } from '@/stores/theme-preset-store'
import { useElectronMenu } from '@/hooks/use-electron-menu'
import { useMcpSync } from '@/hooks/use-mcp-sync'
import { useFileDrop } from '@/hooks/use-file-drop'
import { initAppStorage } from '@/utils/app-storage'
import SkiaCanvas from '@/canvas/skia/skia-canvas'

export default function EditorLayout() {
  const toggleMinimize = useAIStore((s) => s.toggleMinimize)
  const hasSelection = useCanvasStore((s) => s.selection.activeId !== null)
  const layerPanelOpen = useCanvasStore((s) => s.layerPanelOpen)
  const saveDialogOpen = useDocumentStore((s) => s.saveDialogOpen)
  const closeSaveDialog = useCallback(() => {
    useDocumentStore.getState().setSaveDialogOpen(false)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      // Cmd+J: toggle AI panel minimize
      if (isMod && e.key === 'j') {
        e.preventDefault()
        toggleMinimize()
        return
      }

      // Cmd+,: open agent settings
      if (isMod && e.key === ',') {
        e.preventDefault()
        useAgentSettingsStore.getState().setDialogOpen(true)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleMinimize])

  // Handle Electron native menu actions
  useElectronMenu()

  // MCP ↔ canvas real-time sync
  useMcpSync()

  // Drag-and-drop file open
  const isDragging = useFileDrop()

  // Hydrate persisted settings (init appStorage first for Electron IPC cache)
  useEffect(() => {
    initAppStorage().then(() => {
      useAgentSettingsStore.getState().hydrate()
      useCanvasStore.getState().hydrate()
      useThemePresetStore.getState().hydrate()
      useCanvasStore.getState().setRightPanelTab('design')
    })
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen flex flex-col bg-background">
        <UpdateReadyBanner />
        <TopBar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {layerPanelOpen && <LayerPanel />}
            <div className="flex-1 flex flex-col min-w-0 relative">
              <SkiaCanvas />
              <Toolbar />
              <BooleanToolbar />

              {/* Bottom bar: minimized AI (left) + zoom controls (right) */}
              <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto">
                  <AIChatMinimizedBar />
                </div>
                <div className="pointer-events-auto">
                  <StatusBar />
                </div>
              </div>

              {/* Expanded AI panel (floating, draggable) */}
              <AIChatPanel />
            </div>
            {hasSelection && <RightPanel />}
          </div>
        </div>
        <SaveDialog open={saveDialogOpen} onClose={closeSaveDialog} />
        <AgentSettingsDialog />

        {/* Drop zone overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-50 border-2 border-dashed border-primary bg-primary/5 pointer-events-none" />
        )}
      </div>
    </TooltipProvider>
  )
}
