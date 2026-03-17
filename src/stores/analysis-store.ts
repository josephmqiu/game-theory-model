import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Analysis, AnalysisStrategy, AnalysisValidation } from '@/types/analysis'
import { createDefaultAnalysis, normalizeAnalysis } from '@/services/analysis/analysis-normalization'
import { validateAnalysis } from '@/services/analysis/analysis-validation'

interface AnalysisStoreState {
  analysis: Analysis
  validation: AnalysisValidation
  newAnalysis: () => void
  replaceAnalysis: (analysis: Partial<Analysis>) => void
  renameAnalysis: (name: string) => void
  renamePlayer: (playerId: string, name: string) => void
  addStrategy: (playerId: string) => void
  renameStrategy: (
    playerId: string,
    strategyId: string,
    name: string,
  ) => void
  removeStrategy: (playerId: string, strategyId: string) => void
  setPayoff: (
    player1StrategyId: string,
    player2StrategyId: string,
    playerId: string,
    payoff: number | null,
  ) => void
}

function createAnalysisState(analysisInput?: Partial<Analysis>) {
  const analysis = analysisInput
    ? normalizeAnalysis(analysisInput)
    : createDefaultAnalysis()

  return {
    analysis,
    validation: validateAnalysis(analysis),
  }
}

function getStrategyName(strategies: AnalysisStrategy[]): string {
  return `Strategy ${strategies.length + 1}`
}

function getPlayerIndexById(analysis: Analysis, playerId: string): number {
  return analysis.players.findIndex((player) => player.id === playerId)
}

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  ...createAnalysisState(),

  newAnalysis: () => set(createAnalysisState()),

  replaceAnalysis: (analysis) => set(createAnalysisState(analysis)),

  renameAnalysis: (name) =>
    set((state) =>
      createAnalysisState({
        ...state.analysis,
        name,
      }),
    ),

  renamePlayer: (playerId, name) =>
    set((state) =>
      createAnalysisState({
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId ? { ...player, name } : player,
        ) as Analysis['players'],
      }),
    ),

  addStrategy: (playerId) =>
    set((state) =>
      createAnalysisState({
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                strategies: [
                  ...player.strategies,
                  {
                    id: nanoid(),
                    name: getStrategyName(player.strategies),
                  },
                ],
              }
            : player,
        ) as Analysis['players'],
      }),
    ),

  renameStrategy: (playerId, strategyId, name) =>
    set((state) =>
      createAnalysisState({
        ...state.analysis,
        players: state.analysis.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                strategies: player.strategies.map((strategy) =>
                  strategy.id === strategyId ? { ...strategy, name } : strategy,
                ),
              }
            : player,
        ) as Analysis['players'],
      }),
    ),

  removeStrategy: (playerId, strategyId) =>
    set((state) => {
      const nextPlayers = state.analysis.players.map((player) => {
        if (player.id !== playerId || player.strategies.length <= 1) {
          return player
        }

        return {
          ...player,
          strategies: player.strategies.filter(
            (strategy) => strategy.id !== strategyId,
          ),
        }
      }) as Analysis['players']

      return createAnalysisState({
        ...state.analysis,
        players: nextPlayers,
      })
    }),

  setPayoff: (player1StrategyId, player2StrategyId, playerId, payoff) =>
    set((state) => {
      const playerIndex = getPlayerIndexById(state.analysis, playerId)
      if (playerIndex === -1) {
        return state
      }

      return createAnalysisState({
        ...state.analysis,
        profiles: state.analysis.profiles.map((profile) => {
          if (
            profile.player1StrategyId !== player1StrategyId ||
            profile.player2StrategyId !== player2StrategyId
          ) {
            return profile
          }

          const payoffs: [number | null, number | null] = [...profile.payoffs]
          payoffs[playerIndex as 0 | 1] = payoff

          return {
            ...profile,
            payoffs,
          }
        }),
      })
    }),
}))
