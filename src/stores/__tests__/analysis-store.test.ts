import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAnalysisStore } from '@/stores/analysis-store'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import {
  confirmDiscardAnalysisChanges,
  commitAnalysisSave,
  hasUnsavedAnalysisChanges,
  loadAnalysisFromText,
  resetAnalysisForNewDocument,
} from '@/services/analysis/analysis-persistence'
import { serializeAnalysisFile } from '@/services/analysis/analysis-file'

describe('analysis store persistence state', () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  afterEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  it('marks edits dirty and preserves file references until a new analysis is created', () => {
    const state = useAnalysisStore.getState()
    state.setAnalysisFileReference({
      fileName: 'pricing.gta',
      filePath: '/tmp/pricing.gta',
    })

    state.renameAnalysis('Pricing Game')

    expect(useAnalysisStore.getState().analysis.name).toBe('Pricing Game')
    expect(useAnalysisStore.getState().isDirty).toBe(true)
    expect(useAnalysisStore.getState().fileName).toBe('pricing.gta')
    expect(hasUnsavedAnalysisChanges()).toBe(true)

    resetAnalysisForNewDocument()

    expect(useAnalysisStore.getState().analysis.name).toBe('Untitled Analysis')
    expect(useAnalysisStore.getState().isDirty).toBe(false)
    expect(useAnalysisStore.getState().fileName).toBeNull()
    expect(useAnalysisStore.getState().filePath).toBeNull()
    expect(useAnalysisStore.getState().fileHandle).toBeNull()
  })

  it('loads a saved file without marking the store dirty', () => {
    const analysis = createDefaultAnalysis()
    analysis.players[0].name = 'Incumbent'
    analysis.profiles[0].payoffs = [4, null]
    const text = serializeAnalysisFile(analysis)

    loadAnalysisFromText(text, {
      fileName: 'pricing.gta',
      filePath: '/tmp/pricing.gta',
    })

    expect(useAnalysisStore.getState().analysis).toEqual(analysis)
    expect(useAnalysisStore.getState().fileName).toBe('pricing.gta')
    expect(useAnalysisStore.getState().filePath).toBe('/tmp/pricing.gta')
    expect(useAnalysisStore.getState().isDirty).toBe(false)
  })

  it('keeps the current analysis when a load fails', () => {
    const before = useAnalysisStore.getState().analysis

    expect(() =>
      loadAnalysisFromText(
        JSON.stringify({
          type: 'game-theory-analysis',
          version: 1,
          analysis: {
            id: 'broken',
            name: 'Broken',
            players: [],
            profiles: [],
          },
        }),
      ),
    ).toThrow('Analysis must contain exactly two players.')

    expect(useAnalysisStore.getState().analysis).toEqual(before)
  })

  it('commits a save by updating the file reference and clearing dirty state', () => {
    const state = useAnalysisStore.getState()
    state.renamePlayer(state.analysis.players[0].id, 'Incumbent')

    commitAnalysisSave({
      fileName: 'pricing.gta',
      filePath: '/tmp/pricing.gta',
      fileHandle: null,
    })

    expect(useAnalysisStore.getState().fileName).toBe('pricing.gta')
    expect(useAnalysisStore.getState().filePath).toBe('/tmp/pricing.gta')
    expect(useAnalysisStore.getState().isDirty).toBe(false)
  })

  it('only discards dirty changes when the confirmation prompt accepts', async () => {
    useAnalysisStore.getState().renameAnalysis('Pricing Game')

    await expect(
      confirmDiscardAnalysisChanges({
        confirm: () => false,
      }),
    ).resolves.toBe(false)

    await expect(
      confirmDiscardAnalysisChanges({
        confirm: () => true,
      }),
    ).resolves.toBe(true)
  })
})
