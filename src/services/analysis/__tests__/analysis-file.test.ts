import { describe, expect, it } from 'vitest'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { createDefaultAnalysisWorkflowState } from '@/services/analysis/analysis-workflow'
import { validateAnalysis } from '@/services/analysis/analysis-validation'
import {
  createDefaultAnalysisFileName,
  parseAnalysisFileText,
  serializeAnalysisFile,
} from '@/services/analysis/analysis-file'

function createAnalysisWithDraftIssues() {
  const analysis = createDefaultAnalysis()

  analysis.name = 'Pricing Game'
  analysis.players[0].name = '  '
  analysis.players[0].strategies[0].name = 'High price'
  analysis.players[0].strategies[1].name = 'High price'
  analysis.players[1].name = 'Entrant'
  analysis.profiles[0].payoffs = [7, null]

  return analysis
}

describe('analysis file contract', () => {
  it('round-trips valid draft work without losing validation state', () => {
    const analysis = createAnalysisWithDraftIssues()
    const workflow = createDefaultAnalysisWorkflowState()
    workflow.currentStage = 'payoffs'
    const text = serializeAnalysisFile(analysis, workflow)
    const parsed = parseAnalysisFileText(text)

    expect(parsed.analysis).toEqual(analysis)
    expect(parsed.workflow).toEqual(workflow)
    expect(validateAnalysis(parsed.analysis).isValid).toBe(false)
    expect(validateAnalysis(parsed.analysis).isComplete).toBe(false)
    expect(createDefaultAnalysisFileName(parsed.analysis)).toBe('pricing-game.gta')
  })

  it('derives a workflow cursor for older files that do not store workflow metadata', () => {
    const analysis = createDefaultAnalysis()
    analysis.name = 'Pricing Game'
    analysis.profiles = analysis.profiles.map((profile) => ({
      ...profile,
      payoffs: [2, 1] as [number, number],
    }))

    const parsed = parseAnalysisFileText(
      JSON.stringify({
        type: 'game-theory-analysis',
        version: 1,
        analysis,
      }),
    )

    expect(parsed.workflow).toEqual({ currentStage: 'review' })
  })

  it('rejects malformed or incompatible files', () => {
    expect(() => parseAnalysisFileText('not json')).toThrow(
      'Analysis file is not valid JSON.',
    )

    expect(() =>
      parseAnalysisFileText(
        JSON.stringify({
          type: 'other-format',
          version: 1,
          analysis: createDefaultAnalysis(),
        }),
      ),
    ).toThrow('Unsupported analysis file type: other-format.')

    expect(() =>
      parseAnalysisFileText(
        JSON.stringify({
          type: 'game-theory-analysis',
          version: 2,
          analysis: createDefaultAnalysis(),
        }),
      ),
    ).toThrow('Unsupported analysis file version: 2.')

    expect(() =>
      parseAnalysisFileText(
        JSON.stringify({
          type: 'game-theory-analysis',
          version: 1,
          workflow: { currentStage: 'bogus' },
          analysis: createDefaultAnalysis(),
        }),
      ),
    ).toThrow('workflow.currentStage must be a valid guided workflow stage.')

    expect(() =>
      parseAnalysisFileText(
        JSON.stringify({
          type: 'game-theory-analysis',
          version: 1,
          analysis: {
            id: 'analysis',
            name: 'Broken',
            players: [],
            profiles: [],
          },
        }),
      ),
    ).toThrow('Analysis must contain exactly two players.')
  })
})
