import { describe, expect, it } from 'vitest'
import {
  createDefaultAnalysis,
  normalizeAnalysis,
} from '@/services/analysis/analysis-normalization'

function getProfilePayoffs(
  analysis: ReturnType<typeof createDefaultAnalysis>,
  player1StrategyId: string,
  player2StrategyId: string,
) {
  return analysis.profiles.find(
    (profile) =>
      profile.player1StrategyId === player1StrategyId &&
      profile.player2StrategyId === player2StrategyId,
  )?.payoffs
}

describe('analysis normalization', () => {
  it('creates a default 2x2 analysis with null payoffs', () => {
    const analysis = createDefaultAnalysis()

    expect(analysis.name).toBe('Untitled Analysis')
    expect(analysis.players).toHaveLength(2)
    expect(analysis.players[0].strategies).toHaveLength(2)
    expect(analysis.players[1].strategies).toHaveLength(2)
    expect(analysis.profiles).toHaveLength(4)
    expect(analysis.profiles.every((profile) => profile.payoffs[0] === null)).toBe(
      true,
    )
    expect(analysis.profiles.every((profile) => profile.payoffs[1] === null)).toBe(
      true,
    )
  })

  it('expands the matrix and preserves surviving payoffs when a strategy is added', () => {
    const analysis = createDefaultAnalysis()
    const populatedProfiles = analysis.profiles.map((profile, index) => ({
      ...profile,
      payoffs: [index + 1, index + 11] as [number, number],
    }))

    const nextAnalysis = normalizeAnalysis({
      ...analysis,
      players: [
        {
          ...analysis.players[0],
          strategies: [
            ...analysis.players[0].strategies,
            { id: 'player-1-strategy-3', name: 'Strategy 3' },
          ],
        },
        analysis.players[1],
      ],
      profiles: populatedProfiles,
    })

    expect(nextAnalysis.players[0].strategies).toHaveLength(3)
    expect(nextAnalysis.profiles).toHaveLength(6)
    expect(
      getProfilePayoffs(
        nextAnalysis,
        analysis.players[0].strategies[0].id,
        analysis.players[1].strategies[0].id,
      ),
    ).toEqual([1, 11])
    expect(
      getProfilePayoffs(
        nextAnalysis,
        'player-1-strategy-3',
        analysis.players[1].strategies[0].id,
      ),
    ).toEqual([null, null])
  })

  it('shrinks the matrix and preserves surviving payoffs when a strategy is removed', () => {
    const analysis = createDefaultAnalysis()
    const populatedProfiles = analysis.profiles.map((profile, index) => ({
      ...profile,
      payoffs: [index + 1, index + 21] as [number, number],
    }))

    const remainingColumnStrategy = analysis.players[1].strategies[0]
    const nextAnalysis = normalizeAnalysis({
      ...analysis,
      players: [
        analysis.players[0],
        {
          ...analysis.players[1],
          strategies: [remainingColumnStrategy],
        },
      ],
      profiles: populatedProfiles,
    })

    expect(nextAnalysis.players[1].strategies).toHaveLength(1)
    expect(nextAnalysis.profiles).toHaveLength(2)
    expect(
      getProfilePayoffs(
        nextAnalysis,
        analysis.players[0].strategies[0].id,
        remainingColumnStrategy.id,
      ),
    ).toEqual([1, 21])
    expect(
      getProfilePayoffs(
        nextAnalysis,
        analysis.players[0].strategies[1].id,
        remainingColumnStrategy.id,
      ),
    ).toEqual([3, 23])
  })

  it('keeps profile payoffs when players or strategies are renamed', () => {
    const analysis = createDefaultAnalysis()
    const populatedProfiles = analysis.profiles.map((profile, index) => ({
      ...profile,
      payoffs: [index + 5, index + 15] as [number, number],
    }))

    const nextAnalysis = normalizeAnalysis({
      ...analysis,
      name: 'Market entry game',
      players: [
        {
          ...analysis.players[0],
          name: 'Incumbent',
          strategies: analysis.players[0].strategies.map((strategy, index) => ({
            ...strategy,
            name: `Incumbent move ${index + 1}`,
          })),
        },
        {
          ...analysis.players[1],
          name: 'Entrant',
          strategies: analysis.players[1].strategies.map((strategy, index) => ({
            ...strategy,
            name: `Entrant move ${index + 1}`,
          })),
        },
      ],
      profiles: populatedProfiles,
    })

    expect(nextAnalysis.name).toBe('Market entry game')
    expect(nextAnalysis.players[0].name).toBe('Incumbent')
    expect(nextAnalysis.players[1].name).toBe('Entrant')
    expect(
      getProfilePayoffs(
        nextAnalysis,
        analysis.players[0].strategies[0].id,
        analysis.players[1].strategies[1].id,
      ),
    ).toEqual([6, 16])
  })
})
