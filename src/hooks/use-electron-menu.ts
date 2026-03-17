import { useEffect } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'

/**
 * Listens for Electron native menu actions and dispatches the subset that is
 * still truthful for the Phase 2 analysis-first workspace.
 */
export function useElectronMenu() {
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMenuAction) return

    return api.onMenuAction((action: string) => {
      if (action === 'new') {
        useAnalysisStore.getState().newAnalysis()
      }
    })
  }, [])
}
