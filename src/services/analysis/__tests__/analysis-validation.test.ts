import { describe, expect, it } from 'vitest'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { validateAnalysis } from '@/services/analysis/analysis-validation'

describe('analysis validation', () => {
  it('marks blank names as invalid', () => {
    const analysis = createDefaultAnalysis()
    analysis.name = '   '

    const validation = validateAnalysis(analysis)

    expect(validation.isValid).toBe(false)
    expect(validation.issues.some((issue) => issue.message === 'Analysis name is required.')).toBe(
      true,
    )
  })

  it('marks duplicate player names as invalid', () => {
    const analysis = createDefaultAnalysis()
    analysis.players[0].name = 'Player'
    analysis.players[1].name = 'Player'

    const validation = validateAnalysis(analysis)

    expect(validation.isValid).toBe(false)
    expect(validation.issues.some((issue) => issue.message === 'Player names must be unique.')).toBe(
      true,
    )
  })

  it('marks duplicate strategy names within a player as invalid', () => {
    const analysis = createDefaultAnalysis()
    analysis.players[0].strategies[0].name = 'Compete'
    analysis.players[0].strategies[1].name = 'Compete'

    const validation = validateAnalysis(analysis)

    expect(validation.isValid).toBe(false)
    expect(
      validation.issues.some(
        (issue) =>
          issue.message === 'Player 1 strategy names must be unique.',
      ),
    ).toBe(true)
  })

  it('reports incomplete payoffs without coercing them to zero', () => {
    const analysis = createDefaultAnalysis()
    analysis.profiles[0].payoffs = [0, null]

    const validation = validateAnalysis(analysis)

    expect(validation.isValid).toBe(true)
    expect(validation.isComplete).toBe(false)
    expect(validation.incompleteProfiles).toHaveLength(4)
    expect(analysis.profiles[0].payoffs).toEqual([0, null])
  })
})
