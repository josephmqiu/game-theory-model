import { nanoid } from 'nanoid'
import type {
  Analysis,
  AnalysisPlayer,
  AnalysisProfile,
  AnalysisStrategy,
} from '@/types/analysis'

type AnalysisInput = Partial<Analysis> & {
  players?: Array<Partial<AnalysisPlayer>>
  profiles?: Array<Partial<AnalysisProfile>>
}

export const DEFAULT_ANALYSIS_NAME = 'Untitled Analysis'
const DEFAULT_PLAYER_COUNT = 2
const DEFAULT_STRATEGY_COUNT = 2

function createStrategy(name: string): AnalysisStrategy {
  return {
    id: nanoid(),
    name,
  }
}

function createStrategyList(count: number): AnalysisStrategy[] {
  return Array.from({ length: count }, (_value, index) =>
    createStrategy(`Strategy ${index + 1}`),
  )
}

function createPlayer(index: number): AnalysisPlayer {
  return {
    id: nanoid(),
    name: `Player ${index + 1}`,
    strategies: createStrategyList(DEFAULT_STRATEGY_COUNT),
  }
}

function normalizePayoffValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizePayoffs(
  payoffs: Partial<AnalysisProfile>['payoffs'],
): [number | null, number | null] {
  return [
    normalizePayoffValue(payoffs?.[0]),
    normalizePayoffValue(payoffs?.[1]),
  ]
}

function normalizeStrategies(
  rawStrategies: Array<Partial<AnalysisStrategy>> | undefined,
  fallbackCount: number,
): AnalysisStrategy[] {
  const source =
    rawStrategies && rawStrategies.length > 0
      ? rawStrategies
      : createStrategyList(fallbackCount)

  const usedIds = new Set<string>()

  return source.map((strategy, index) => {
    const candidateId =
      typeof strategy.id === 'string' &&
      strategy.id.trim().length > 0 &&
      !usedIds.has(strategy.id)
        ? strategy.id
        : nanoid()

    usedIds.add(candidateId)

    return {
      id: candidateId,
      name:
        typeof strategy.name === 'string'
          ? strategy.name
          : `Strategy ${index + 1}`,
    }
  })
}

function normalizePlayer(
  player: Partial<AnalysisPlayer> | undefined,
  index: number,
): AnalysisPlayer {
  const fallbackPlayer = createPlayer(index)
  const hasExplicitStrategies = Array.isArray(player?.strategies)

  return {
    id:
      typeof player?.id === 'string' && player.id.trim().length > 0
        ? player.id
        : fallbackPlayer.id,
    name:
      typeof player?.name === 'string' ? player.name : fallbackPlayer.name,
    strategies: normalizeStrategies(
      hasExplicitStrategies ? player?.strategies : undefined,
      hasExplicitStrategies ? 1 : DEFAULT_STRATEGY_COUNT,
    ),
  }
}

function normalizePlayers(
  players: AnalysisInput['players'],
): [AnalysisPlayer, AnalysisPlayer] {
  const normalized = Array.from(
    { length: DEFAULT_PLAYER_COUNT },
    (_value, index) => normalizePlayer(players?.[index], index),
  )

  return [normalized[0], normalized[1]]
}

function buildPayoffMap(
  profiles: AnalysisInput['profiles'],
): Map<string, [number | null, number | null]> {
  const payoffMap = new Map<string, [number | null, number | null]>()

  for (const profile of profiles ?? []) {
    if (
      typeof profile.player1StrategyId !== 'string' ||
      typeof profile.player2StrategyId !== 'string'
    ) {
      continue
    }

    payoffMap.set(
      getAnalysisProfileKey(
        profile.player1StrategyId,
        profile.player2StrategyId,
      ),
      normalizePayoffs(profile.payoffs),
    )
  }

  return payoffMap
}

export function getAnalysisProfileKey(
  player1StrategyId: string,
  player2StrategyId: string,
): string {
  return `${player1StrategyId}::${player2StrategyId}`
}

export function createDefaultAnalysis(): Analysis {
  const players = normalizePlayers(undefined)

  return {
    id: nanoid(),
    name: DEFAULT_ANALYSIS_NAME,
    players,
    profiles: createProfiles(players, new Map()),
  }
}

export function createProfiles(
  players: [AnalysisPlayer, AnalysisPlayer],
  payoffMap: Map<string, [number | null, number | null]>,
): AnalysisProfile[] {
  return players[0].strategies.flatMap((player1Strategy) =>
    players[1].strategies.map((player2Strategy) => {
      const profileKey = getAnalysisProfileKey(
        player1Strategy.id,
        player2Strategy.id,
      )

      return {
        player1StrategyId: player1Strategy.id,
        player2StrategyId: player2Strategy.id,
        payoffs: payoffMap.get(profileKey) ?? [null, null],
      }
    }),
  )
}

export function normalizeAnalysis(input?: AnalysisInput): Analysis {
  const defaults = createDefaultAnalysis()
  const players = normalizePlayers(input?.players)
  const payoffMap = buildPayoffMap(input?.profiles)

  return {
    id:
      typeof input?.id === 'string' && input.id.trim().length > 0
        ? input.id
        : defaults.id,
    name:
      typeof input?.name === 'string' ? input.name : defaults.name,
    players,
    profiles: createProfiles(players, payoffMap),
  }
}
