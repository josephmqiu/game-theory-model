import type {
  Analysis,
  AnalysisValidation,
  AnalysisValidationIssue,
} from '@/types/analysis'
import { getAnalysisProfileKey } from './analysis-normalization'

function pushIssue(
  issues: AnalysisValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message })
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

export function validateAnalysis(analysis: Analysis): AnalysisValidation {
  const issues: AnalysisValidationIssue[] = []
  const incompleteProfiles: AnalysisValidation['incompleteProfiles'] = []

  if (analysis.players.length !== 2) {
    pushIssue(issues, 'players', 'Exactly two players are required.')
  }

  if (analysis.name.trim().length === 0) {
    pushIssue(issues, 'name', 'Analysis name is required.')
  }

  const trimmedPlayerNames = analysis.players.map((player) => player.name.trim())

  trimmedPlayerNames.forEach((name, index) => {
    if (name.length === 0) {
      pushIssue(
        issues,
        `players.${index}.name`,
        `Player ${index + 1} name is required.`,
      )
    }
  })

  if (hasDuplicates(trimmedPlayerNames.filter(Boolean))) {
    pushIssue(issues, 'players', 'Player names must be unique.')
  }

  const expectedProfileKeys = new Set<string>()
  const actualProfileKeys = new Set<string>()

  for (const [playerIndex, player] of analysis.players.entries()) {
    if (player.strategies.length === 0) {
      pushIssue(
        issues,
        `players.${playerIndex}.strategies`,
        `Player ${playerIndex + 1} must have at least one strategy.`,
      )
    }

    const trimmedStrategyNames = player.strategies.map((strategy) =>
      strategy.name.trim(),
    )

    trimmedStrategyNames.forEach((name, strategyIndex) => {
      if (name.length === 0) {
        pushIssue(
          issues,
          `players.${playerIndex}.strategies.${strategyIndex}.name`,
          `Strategy ${strategyIndex + 1} for Player ${playerIndex + 1} is required.`,
        )
      }
    })

    if (hasDuplicates(trimmedStrategyNames.filter(Boolean))) {
      pushIssue(
        issues,
        `players.${playerIndex}.strategies`,
        `Player ${playerIndex + 1} strategy names must be unique.`,
      )
    }
  }

  for (const player1Strategy of analysis.players[0].strategies) {
    for (const player2Strategy of analysis.players[1].strategies) {
      expectedProfileKeys.add(
        getAnalysisProfileKey(player1Strategy.id, player2Strategy.id),
      )
    }
  }

  for (const [index, profile] of analysis.profiles.entries()) {
    const profileKey = getAnalysisProfileKey(
      profile.player1StrategyId,
      profile.player2StrategyId,
    )

    if (actualProfileKeys.has(profileKey)) {
      pushIssue(
        issues,
        `profiles.${index}`,
        'Duplicate strategy profile found.',
      )
    }

    actualProfileKeys.add(profileKey)

    if (profile.payoffs[0] === null || profile.payoffs[1] === null) {
      incompleteProfiles.push({
        player1StrategyId: profile.player1StrategyId,
        player2StrategyId: profile.player2StrategyId,
      })
    }
  }

  for (const expectedProfileKey of expectedProfileKeys) {
    if (!actualProfileKeys.has(expectedProfileKey)) {
      pushIssue(
        issues,
        'profiles',
        'Every strategy combination must have a profile.',
      )
      break
    }
  }

  for (const actualProfileKey of actualProfileKeys) {
    if (!expectedProfileKeys.has(actualProfileKey)) {
      pushIssue(
        issues,
        'profiles',
        'Profiles must only contain valid strategy combinations.',
      )
      break
    }
  }

  return {
    isValid: issues.length === 0,
    isComplete: issues.length === 0 && incompleteProfiles.length === 0,
    issues,
    incompleteProfiles,
  }
}
