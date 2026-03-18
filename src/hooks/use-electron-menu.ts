import { useEffect } from 'react'
import {
  newAnalysis as startNewAnalysis,
  openAnalysis,
  openAnalysisFromFilePath,
  saveAnalysis,
  saveAnalysisAs,
} from '@/services/analysis/analysis-persistence'

/**
 * Listens for Electron native menu actions and dispatches them into the
 * analysis persistence controller used by the live workspace.
 */
export function useElectronMenu() {
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const handleMenuAction = async (action: string) => {
      if (action === 'new') {
        await startNewAnalysis()
        return
      }

      if (action === 'open') {
        await openAnalysis()
        return
      }

      if (action === 'save') {
        await saveAnalysis()
        return
      }

      if (action === 'saveAs') {
        await saveAnalysisAs()
      }
    }

    const disposeMenu =
      api.onMenuAction?.((action: string) => {
        void handleMenuAction(action)
      }) ?? null

    const disposeOpenFile =
      api.onOpenFile?.((filePath: string) => {
        void openAnalysisFromFilePath(filePath)
      }) ?? null

    void api.getPendingFile?.().then((filePath) => {
      if (filePath) {
        void openAnalysisFromFilePath(filePath)
      }
    })

    return () => {
      disposeMenu?.()
      disposeOpenFile?.()
    }
  }, [])
}
