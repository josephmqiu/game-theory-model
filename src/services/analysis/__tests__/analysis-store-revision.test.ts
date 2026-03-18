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

  it('tracks analysis and workflow revisions independently', () => {
    const state = useAnalysisStore.getState()

    expect(state.analysisRevision).toBe(0)
    expect(state.workflowRevision).toBe(0)

    state.renameAnalysis('Pricing Game')
    expect(useAnalysisStore.getState().analysisRevision).toBe(1)
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)

    state.addStrategy(state.analysis.players[0].id)
    expect(useAnalysisStore.getState().analysisRevision).toBe(2)
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)

    state.setWorkflowStage('payoffs')
    expect(useAnalysisStore.getState().analysisRevision).toBe(2)
    expect(useAnalysisStore.getState().workflowRevision).toBe(1)

    const analysis = createDefaultAnalysis()
    analysis.name = 'Loaded Game'
    loadAnalysisFromText(serializeAnalysisFile(analysis))
    expect(useAnalysisStore.getState().analysisRevision).toBe(3)
    expect(useAnalysisStore.getState().workflowRevision).toBe(2)
    expect(useAnalysisStore.getState().isDirty).toBe(false)

    useAnalysisStore.getState().newAnalysis()
    expect(useAnalysisStore.getState().analysisRevision).toBe(4)
    expect(useAnalysisStore.getState().workflowRevision).toBe(3)
    expect(useAnalysisStore.getState().analysis.name).toBe('Untitled Analysis')
    expect(useAnalysisStore.getState().workflow.currentStage).toBe('details')
  })

  it('increments both revisions for atomic combined commits', () => {
    const state = useAnalysisStore.getState()
    const nextAnalysis = {
      ...state.analysis,
      name: 'Pricing Game',
    }

    state.commitAnalysisWorkflow({
      analysis: nextAnalysis,
      workflow: { currentStage: 'payoffs' },
    })

    expect(useAnalysisStore.getState().analysisRevision).toBe(1)
    expect(useAnalysisStore.getState().workflowRevision).toBe(1)
    expect(useAnalysisStore.getState().analysis.name).toBe('Pricing Game')
    expect(useAnalysisStore.getState().workflow.currentStage).toBe('payoffs')
  })

  it('treats unchanged combined commits as no-ops', () => {
    const state = useAnalysisStore.getState()

    state.commitAnalysisWorkflow({
      analysis: state.analysis,
      workflow: state.workflow,
    })

    expect(useAnalysisStore.getState().analysisRevision).toBe(0)
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)
    expect(useAnalysisStore.getState().isDirty).toBe(false)
  })

  it('rejects blocked workflow stage transitions', () => {
    const state = useAnalysisStore.getState()

    state.setWorkflowStage('review')

    expect(useAnalysisStore.getState().workflow.currentStage).toBe('details')
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)
    expect(useAnalysisStore.getState().isDirty).toBe(false)
  })
})
