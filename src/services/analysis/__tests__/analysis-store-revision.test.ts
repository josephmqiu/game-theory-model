import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAnalysisStore } from '@/stores/analysis-store'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { loadAnalysisFromText } from '@/services/analysis/analysis-persistence'
import { serializeAnalysisFile } from '@/services/analysis/analysis-file'

describe('analysis store revision tracking', () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  afterEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  it('increments the analysis revision for mutations, loads, and new analyses', () => {
    const state = useAnalysisStore.getState()

    expect(state.analysisRevision).toBe(0)

    state.renameAnalysis('Pricing Game')
    expect(useAnalysisStore.getState().analysisRevision).toBe(1)

    state.addStrategy(state.analysis.players[0].id)
    expect(useAnalysisStore.getState().analysisRevision).toBe(2)

    const analysis = createDefaultAnalysis()
    analysis.name = 'Loaded Game'
    loadAnalysisFromText(serializeAnalysisFile(analysis))
    expect(useAnalysisStore.getState().analysisRevision).toBe(3)
    expect(useAnalysisStore.getState().isDirty).toBe(false)

    useAnalysisStore.getState().newAnalysis()
    expect(useAnalysisStore.getState().analysisRevision).toBe(4)
    expect(useAnalysisStore.getState().analysis.name).toBe('Untitled Analysis')
  })
})
