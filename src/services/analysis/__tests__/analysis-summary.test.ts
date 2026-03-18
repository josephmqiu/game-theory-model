import { describe, expect, it } from 'vitest'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { createAnalysisSummary } from '@/services/analysis/analysis-summary'

describe('analysis summary', () => {
  it('summarizes incomplete manual work with named payoff cells', () => {
    const analysis = createDefaultAnalysis()
    analysis.name = 'Pricing Game'
    analysis.players[0].name = 'Incumbent'
    analysis.players[0].strategies[0].name = 'High price'
    analysis.players[1].name = 'Entrant'
    analysis.players[1].strategies[0].name = 'Enter'

    const summary = createAnalysisSummary(analysis)

    expect(summary.status).toBe('incomplete')
    expect(summary.statusLabel).toBe('4 payoff cells still incomplete')
    expect(summary.progressLabel).toBe('0 of 4 payoff cells complete')
    expect(summary.totalProfileCount).toBe(4)
    expect(summary.completeProfileCount).toBe(0)
    expect(summary.incompleteProfileCount).toBe(4)
    expect(summary.missingProfileCount).toBe(0)
    expect(summary.profiles[0]).toMatchObject({
      label: 'Incumbent: High price vs Entrant: Enter',
      isComplete: false,
      isMissing: false,
    })
    expect(summary.incompleteProfiles).toHaveLength(4)
    expect(summary.missingProfiles).toHaveLength(0)
  })

  it('reports missing combinations as invalid manual work', () => {
    const analysis = createDefaultAnalysis()
    analysis.profiles = analysis.profiles.slice(0, 3)

    const summary = createAnalysisSummary(analysis)

    expect(summary.status).toBe('invalid')
    expect(summary.issueCount).toBeGreaterThan(0)
    expect(summary.missingProfileCount).toBe(1)
    expect(summary.missingProfiles[0].label).toBe(
      'Player 1: Strategy 2 vs Player 2: Strategy 2',
    )
    expect(summary.statusLabel).toContain('issue')
  })

  it('reports a complete matrix as ready for manual review', () => {
    const analysis = createDefaultAnalysis()

    for (const profile of analysis.profiles) {
      profile.payoffs = [1, 2]
    }

    const summary = createAnalysisSummary(analysis)

    expect(summary.status).toBe('complete')
    expect(summary.statusLabel).toBe('Analysis is complete')
    expect(summary.progressLabel).toBe('4 of 4 payoff cells complete')
    expect(summary.completionPercent).toBe(1)
    expect(summary.completeProfileCount).toBe(4)
    expect(summary.incompleteProfileCount).toBe(0)
    expect(summary.missingProfileCount).toBe(0)
  })
})
