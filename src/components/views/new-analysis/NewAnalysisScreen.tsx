import { useState } from 'react'
import type { ReactNode } from 'react'

import { usePipelineController } from '../../../hooks/usePipelineController'
import { useAppStore } from '../../../store'
import { Button } from '../../design-system'

export function NewAnalysisScreen(): ReactNode {
  const [description, setDescription] = useState('')
  const { connectionStatus, startAnalysis } = usePipelineController()
  const setActiveView = useAppStore((state) => state.setActiveView)

  async function handleBeginAnalysis(manual: boolean) {
    const trimmed = description.trim()
    if (!trimmed) {
      return
    }

    await startAnalysis(trimmed, { manual })
    setActiveView('overview')
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-8">
      <h1 className="text-xl font-bold text-text-primary mb-6">New Analysis</h1>
      <p className="mb-4 max-w-2xl text-center text-sm text-text-muted">
        Describe the strategic situation. The browser-safe M5 flow creates the analysis state now, and a connected MCP client can drive the phase tools from there.
      </p>
      <textarea
        className="w-full max-w-2xl h-32 bg-bg-surface border border-border rounded-lg p-4 text-text-primary placeholder-text-muted resize-none"
        placeholder="Describe the event or strategic situation you want to analyze..."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <div className="mt-3 text-xs text-text-dim">
        {connectionStatus.connected
          ? `${connectionStatus.client_name ?? 'MCP client'} is connected over ${connectionStatus.transport}.`
          : 'No MCP client connected. You can still create the analysis and continue in manual mode.'}
      </div>
      <div className="flex gap-3 mt-4">
        <Button variant="primary" onClick={() => void handleBeginAnalysis(false)} disabled={description.trim().length === 0}>
          Begin Analysis
        </Button>
        <Button variant="secondary" onClick={() => void handleBeginAnalysis(true)} disabled={description.trim().length === 0}>
          Manual Mode
        </Button>
      </div>
    </div>
  )
}
