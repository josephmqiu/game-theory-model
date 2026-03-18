import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  Analysis,
  AnalysisFileReference,
  AnalysisStrategy,
  AnalysisValidation,
} from '@/types/analysis'
import {
  createDefaultAnalysis,
  normalizeAnalysis,
} from '@/services/analysis/analysis-normalization'
import { validateAnalysis } from '@/services/analysis/analysis-validation'

interface AnalysisStoreState extends AnalysisFileReference {
  analysis: Analysis
  validation: AnalysisValidation
  isDirty: boolean
  newAnalysis: () => void
  loadAnalysis: (
    analysis: Partial<Analysis>,
    source?: Partial<AnalysisFileReference>,
  ) => void
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
  setAnalysisFileReference: (source: Partial<AnalysisFileReference>) => void
  clearAnalysisFileReference: () => void
  markDirty: () => void
  markClean: () => void
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

function createStoreState(
  analysisInput?: Partial<Analysis>,
  source?: Partial<AnalysisFileReference>,
  isDirty = false,
) {
  const { analysis, validation } = createAnalysisState(analysisInput)

  return {
    analysis,
    validation,
    fileName: source?.fileName ?? null,
    filePath: source?.filePath ?? null,
    fileHandle: source?.fileHandle ?? null,
    isDirty,
  }
}

function getStrategyName(strategies: AnalysisStrategy[]): string {
  return `Strategy ${strategies.length + 1}`
}

function getPlayerIndexById(analysis: Analysis, playerId: string): number {
  return analysis.players.findIndex((player) => player.id === playerId)
}

function getAnalysisSource(
  state: Pick<AnalysisStoreState, 'fileName' | 'filePath' | 'fileHandle'>,
): AnalysisFileReference {
  return {
    fileName: state.fileName,
    filePath: state.filePath,
    fileHandle: state.fileHandle,
  }
}

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  ...createStoreState(),

  newAnalysis: () => set(createStoreState()),

  loadAnalysis: (analysis, source) => set(createStoreState(analysis, source, false)),

  replaceAnalysis: (analysis) =>
    set((state) =>
      createStoreState(
        {
          ...state.analysis,
          ...analysis,
        },
        getAnalysisSource(state),
        true,
      ),
    ),

  renameAnalysis: (name) =>
    set((state) =>
      createStoreState(
        {
          ...state.analysis,
          name,
        },
        getAnalysisSource(state),
        true,
      ),
    ),

  renamePlayer: (playerId, name) =>
    set((state) =>
      createStoreState(
        {
          ...state.analysis,
          players: state.analysis.players.map((player) =>
            player.id === playerId ? { ...player, name } : player,
          ) as Analysis['players'],
        },
        getAnalysisSource(state),
        true,
      ),
    ),

  addStrategy: (playerId) =>
    set((state) =>
      createStoreState(
        {
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
        },
        getAnalysisSource(state),
        true,
      ),
    ),

  renameStrategy: (playerId, strategyId, name) =>
    set((state) =>
      createStoreState(
        {
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
        },
        getAnalysisSource(state),
        true,
      ),
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

      return createStoreState(
        {
          ...state.analysis,
          players: nextPlayers,
        },
        getAnalysisSource(state),
        true,
      )
    }),

  setPayoff: (player1StrategyId, player2StrategyId, playerId, payoff) =>
    set((state) => {
      const playerIndex = getPlayerIndexById(state.analysis, playerId)
      if (playerIndex === -1) {
        return state
      }

      return createStoreState(
        {
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
        },
        getAnalysisSource(state),
        true,
      )
    }),

  setAnalysisFileReference: (source) =>
    set((state) => ({
      ...state,
      fileName:
        source.fileName === undefined ? state.fileName : source.fileName,
      filePath:
        source.filePath === undefined ? state.filePath : source.filePath,
      fileHandle:
        source.fileHandle === undefined ? state.fileHandle : source.fileHandle,
    })),

  clearAnalysisFileReference: () =>
    set({
      fileName: null,
      filePath: null,
      fileHandle: null,
    }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),
}))
