import { useEffect } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey

      if (isMod && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        useAnalysisStore.getState().newAnalysis()
        return
      }

      if (
        isMod &&
        (event.key.toLowerCase() === 's' || event.key.toLowerCase() === 'o')
      ) {
        event.preventDefault()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
