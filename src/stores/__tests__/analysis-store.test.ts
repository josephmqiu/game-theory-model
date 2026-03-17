import { beforeEach, describe, expect, it } from 'vitest'
import type { Analysis } from '@/types/analysis'
import { useAnalysisStore } from '@/stores/analysis-store'

describe('analysis store', () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  it('newAnalysis resets the store to the canonical default', () => {
    const initialAnalysis = useAnalysisStore.getState().analysis
    const [player1, player2] = initialAnalysis.players
    const profile = initialAnalysis.profiles[0]

    useAnalysisStore.getState().renameAnalysis('Pricing game')
    useAnalysisStore.getState().renamePlayer(player1.id, 'Incumbent')
    useAnalysisStore.getState().addStrategy(player1.id)
    useAnalysisStore.getState().setPayoff(
      profile.player1StrategyId,
      profile.player2StrategyId,
      player2.id,
      9,
    )

    useAnalysisStore.getState().newAnalysis()

    const resetAnalysis = useAnalysisStore.getState().analysis
    expect(resetAnalysis.name).toBe('Untitled Analysis')
    expect(resetAnalysis.players[0].name).toBe('Player 1')
    expect(resetAnalysis.players[0].strategies).toHaveLength(2)
    expect(resetAnalysis.players[1].strategies).toHaveLength(2)
    expect(resetAnalysis.profiles).toHaveLength(4)
    expect(
      resetAnalysis.profiles.every(
        (nextProfile) =>
          nextProfile.payoffs[0] === null && nextProfile.payoffs[1] === null,
      ),
    ).toBe(true)
  })

  it('setPayoff updates only the targeted profile and player slot', () => {
    const analysis = useAnalysisStore.getState().analysis
    const [player1] = analysis.players
    const [targetProfile, untouchedProfile] = analysis.profiles

    useAnalysisStore.getState().setPayoff(
      targetProfile.player1StrategyId,
      targetProfile.player2StrategyId,
      player1.id,
      7,
    )

    const nextAnalysis = useAnalysisStore.getState().analysis
    expect(nextAnalysis.profiles[0].payoffs).toEqual([7, null])
    expect(
      nextAnalysis.profiles.find(
        (profile) =>
          profile.player1StrategyId === untouchedProfile.player1StrategyId &&
          profile.player2StrategyId === untouchedProfile.player2StrategyId,
      )?.payoffs,
    ).toEqual([null, null])
  })

  it('replaceAnalysis re-normalizes incomplete incoming data', () => {
    useAnalysisStore.getState().replaceAnalysis({
      id: 'analysis-id',
      name: '   ',
      players: [
        {
          id: 'player-1',
          name: 'Player 1',
          strategies: [],
        },
        {
          id: 'player-2',
          name: 'Player 2',
          strategies: [{ id: 'player-2-strategy-1', name: 'Enter' }],
        },
      ],
      profiles: [],
    } as Partial<Analysis>)

    const { analysis, validation } = useAnalysisStore.getState()

    expect(analysis.players[0].strategies).toHaveLength(1)
    expect(analysis.players[1].strategies).toHaveLength(1)
    expect(analysis.profiles).toHaveLength(1)
    expect(validation.isValid).toBe(false)
    expect(
      validation.issues.some(
        (issue) => issue.message === 'Analysis name is required.',
      ),
    ).toBe(true)
  })
})
