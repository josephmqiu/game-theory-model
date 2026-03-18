import type {
  Analysis,
  AnalysisProfile,
  AnalysisValidation,
} from '@/types/analysis'
import { getAnalysisProfileKey } from './analysis-normalization'
import { validateAnalysis } from './analysis-validation'

export type AnalysisSummaryStatus = 'complete' | 'incomplete' | 'invalid'

export interface AnalysisSummaryPlayer {
  id: string
  name: string
  strategyCount: number
  strategies: Array<{
    id: string
    name: string
  }>
}

export interface AnalysisSummaryProfile {
  key: string
  label: string
  player1StrategyId: string
  player1StrategyName: string
  player2StrategyId: string
  player2StrategyName: string
  payoffs: [number | null, number | null]
  isComplete: boolean
  isMissing: boolean
}

export interface AnalysisSummary {
  status: AnalysisSummaryStatus
  statusLabel: string
  progressLabel: string
  issueCount: number
  totalProfileCount: number
  completeProfileCount: number
  incompleteProfileCount: number
  missingProfileCount: number
  completionPercent: number
  players: [AnalysisSummaryPlayer, AnalysisSummaryPlayer]
  profiles: AnalysisSummaryProfile[]
  incompleteProfiles: AnalysisSummaryProfile[]
  missingProfiles: AnalysisSummaryProfile[]
  issues: AnalysisValidation['issues']
}

function formatFallbackName(
  name: string | undefined,
  fallbackName: string,
): string {
  const trimmed = name?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : fallbackName
}

function hasCompletePayoffs(profile: AnalysisProfile): boolean {
  return profile.payoffs[0] !== null && profile.payoffs[1] !== null
}

function createPlayerSummary(
  player: Analysis['players'][number],
  index: number,
): AnalysisSummaryPlayer {
  return {
    id: player.id,
    name: formatFallbackName(player.name, `Player ${index + 1}`),
    strategyCount: player.strategies.length,
    strategies: player.strategies.map((strategy, strategyIndex) => ({
      id: strategy.id,
      name: formatFallbackName(
        strategy.name,
        `Strategy ${strategyIndex + 1}`,
      ),
    })),
  }
}

function createProfileLabel(
  player1Name: string,
  player1StrategyName: string,
  player2Name: string,
  player2StrategyName: string,
): string {
  return `${player1Name}: ${player1StrategyName} vs ${player2Name}: ${player2StrategyName}`
}

export function createAnalysisSummary(
  analysis: Analysis,
  validation = validateAnalysis(analysis),
): AnalysisSummary {
  const player1 = analysis.players[0]
  const player2 = analysis.players[1]
  const player1Summary = createPlayerSummary(player1, 0)
  const player2Summary = createPlayerSummary(player2, 1)

  const actualProfiles = new Map<string, AnalysisProfile>()
  for (const profile of analysis.profiles) {
    actualProfiles.set(
      getAnalysisProfileKey(
        profile.player1StrategyId,
        profile.player2StrategyId,
      ),
      profile,
    )
  }

  const profiles: AnalysisSummaryProfile[] = []
  const incompleteProfiles: AnalysisSummaryProfile[] = []
  const missingProfiles: AnalysisSummaryProfile[] = []

  for (const [player1Index, player1Strategy] of player1.strategies.entries()) {
    for (const [player2Index, player2Strategy] of player2.strategies.entries()) {
      const key = getAnalysisProfileKey(
        player1Strategy.id,
        player2Strategy.id,
      )
      const profile = actualProfiles.get(key)
      const player1StrategyName = formatFallbackName(
        player1Strategy.name,
        `Strategy ${player1Index + 1}`,
      )
      const player2StrategyName = formatFallbackName(
        player2Strategy.name,
        `Strategy ${player2Index + 1}`,
      )
      const summaryProfile: AnalysisSummaryProfile = {
        key,
        label: createProfileLabel(
          player1Summary.name,
          player1StrategyName,
          player2Summary.name,
          player2StrategyName,
        ),
        player1StrategyId: player1Strategy.id,
        player1StrategyName,
        player2StrategyId: player2Strategy.id,
        player2StrategyName,
        payoffs: profile?.payoffs ?? [null, null],
        isComplete: profile ? hasCompletePayoffs(profile) : false,
        isMissing: !profile,
      }

      profiles.push(summaryProfile)

      if (!profile) {
        missingProfiles.push(summaryProfile)
        continue
      }

      if (!hasCompletePayoffs(profile)) {
        incompleteProfiles.push(summaryProfile)
      }
    }
  }

  const totalProfileCount = profiles.length
  const completeProfileCount = profiles.filter(
    (profile) => profile.isComplete,
  ).length
  const incompleteProfileCount =
    totalProfileCount - completeProfileCount - missingProfiles.length
  const issueCount = validation.issues.length
  const status: AnalysisSummaryStatus =
    issueCount > 0
      ? 'invalid'
      : missingProfiles.length > 0 || incompleteProfileCount > 0
        ? 'incomplete'
        : 'complete'
  const remainingProfileCount =
    missingProfiles.length + incompleteProfileCount

  return {
    status,
    statusLabel:
      status === 'invalid'
        ? `${issueCount} issue${issueCount === 1 ? '' : 's'} to fix`
        : remainingProfileCount > 0
          ? `${remainingProfileCount} payoff cell${
              remainingProfileCount === 1 ? '' : 's'
            } still incomplete`
          : 'Analysis is complete',
    progressLabel: `${completeProfileCount} of ${totalProfileCount} payoff cells complete`,
    issueCount,
    totalProfileCount,
    completeProfileCount,
    incompleteProfileCount,
    missingProfileCount: missingProfiles.length,
    completionPercent:
      totalProfileCount === 0 ? 1 : completeProfileCount / totalProfileCount,
    players: [player1Summary, player2Summary],
    profiles,
    incompleteProfiles,
    missingProfiles,
    issues: validation.issues,
  }
}
