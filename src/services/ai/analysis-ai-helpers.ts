import type { AnalysisSummary } from '@/services/analysis/analysis-summary'
import { normalizeAnalysis } from '@/services/analysis/analysis-normalization'
import type { AnalysisInsights } from '@/services/analysis/analysis-insights'
import type {
  Analysis,
  AnalysisPlayer,
  AnalysisProfile,
  AnalysisStrategy,
  AnalysisValidation,
} from '@/types/analysis'
import type {
  AnalysisAIContext,
  AnalysisAIIntent,
  AnalysisAIOperation,
  AnalysisAIPlannerResult,
} from './analysis-ai-types'

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i
const TRAILING_COMMA_PATTERN = /,\s*([}\]])/g
const MUTATION_VERB_PATTERN =
  /\b(rename|add|create|set|update|change|fill|edit|modify|remove|delete)\b/i
const MUTATION_TARGET_PATTERN =
  /\b(analysis|player|strategy|payoff|payoffs|cell|cells|profile|matrix|row|column|player 1|player 2|p1|p2)\b/i
const EXPLICIT_EDIT_PATTERN =
  /\b(rename\s+(?:the\s+)?(?:analysis|player|strategy)\b|add\s+(?:a\s+)?strategy\b|set\s+(?:the\s+)?(?:payoff|payoffs)\b|fill\s+(?:the\s+)?(?:payoff|cell)\b|update\s+(?:the\s+)?(?:analysis|player|strategy|payoff)\b|change\s+(?:the\s+)?(?:analysis|player|strategy|payoff)\b)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function trimString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null
}

function trimJsonLike(text: string): string {
  const fenced = text.match(JSON_FENCE_PATTERN)
  const candidate = fenced?.[1] ?? text
  return candidate.trim().replace(TRAILING_COMMA_PATTERN, '$1')
}

function formatPayoffPair(payoffs: [number | null, number | null]): string {
  return `[${String(payoffs[0])}, ${String(payoffs[1])}]`
}

function formatIssues(validation: AnalysisValidation): string[] {
  if (validation.issues.length === 0) {
    return ['- none']
  }

  return validation.issues.map((issue) => `- ${issue.path}: ${issue.message}`)
}

function formatProfiles(summary: AnalysisSummary): string[] {
  return summary.profiles.map((profile) => {
    const completeness = profile.isComplete
      ? 'complete'
      : profile.isMissing
        ? 'missing'
        : 'incomplete'

    return [
      `- ${profile.key}`,
      `  label: ${profile.label}`,
      `  ids: ${profile.player1StrategyId} x ${profile.player2StrategyId}`,
      `  payoffs: ${formatPayoffPair(profile.payoffs)}`,
      `  status: ${completeness}`,
    ].join('\n')
  })
}

function formatInsights(insights: AnalysisInsights): string[] {
  if (insights.status === 'blocked') {
    return [
      `Insights status: blocked`,
      `Block reason: ${insights.blockReason}`,
      `Block message: ${insights.blockMessage ?? 'none'}`,
    ]
  }

  const equilibriumLines =
    insights.equilibria.length > 0
      ? insights.equilibria.map(
          (equilibrium) =>
            `- ${equilibrium.label} (${equilibrium.player1StrategyId} x ${equilibrium.player2StrategyId}) payoffs ${formatPayoffPair(equilibrium.payoffs)}`,
        )
      : ['- none']

  const bestResponseLines = insights.bestResponses.flatMap((group) => [
    `- ${group.playerName} (${group.playerId}) best responses to ${group.opponentPlayerName} (${group.opponentPlayerId}):`,
    ...group.responses.map(
      (response) =>
        `  - vs ${response.opponentStrategyName} (${response.opponentStrategyId}): ${response.strategyNames.join(', ')} [${response.strategyIds.join(', ')}]`,
    ),
  ])

  const dominanceLines = insights.dominance.map(
    (dominance) =>
      `- ${dominance.playerName} (${dominance.playerId}): ${dominance.kind} dominance -> ${dominance.strategyNames.join(', ') || 'none'} [${dominance.strategyIds.join(', ') || 'none'}]`,
  )

  return [
    'Insights status: ready',
    `Pure Nash profile keys: ${insights.pureNashProfileKeys.join(', ') || 'none'}`,
    'Equilibria:',
    ...equilibriumLines,
    'Best responses:',
    ...bestResponseLines,
    'Dominance:',
    ...dominanceLines,
  ]
}

function findPlayer(
  analysis: Analysis,
  playerId: string,
  errorPrefix: string,
): AnalysisPlayer {
  const player = analysis.players.find((entry) => entry.id === playerId)
  if (!player) {
    throw new Error(`${errorPrefix} player id "${playerId}" was not found.`)
  }

  return player
}

function findStrategyOwner(
  analysis: Analysis,
  strategyId: string,
): { player: AnalysisPlayer; strategy: AnalysisStrategy } | null {
  for (const player of analysis.players) {
    const strategy = player.strategies.find((entry) => entry.id === strategyId)
    if (strategy) {
      return { player, strategy }
    }
  }

  return null
}

function findProfile(
  analysis: Analysis,
  player1StrategyId: string,
  player2StrategyId: string,
  errorPrefix: string,
): AnalysisProfile {
  const profile = analysis.profiles.find(
    (entry) =>
      entry.player1StrategyId === player1StrategyId &&
      entry.player2StrategyId === player2StrategyId,
  )

  if (!profile) {
    throw new Error(
      `${errorPrefix} payoff profile "${player1StrategyId}::${player2StrategyId}" was not found.`,
    )
  }

  return profile
}

function normalizeOperationType(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim().toLowerCase() : null
}

function normalizePayoffPair(value: unknown): [number | null, number | null] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }

  const pair = value.map((entry) => {
    if (entry === null) return null
    return typeof entry === 'number' && Number.isFinite(entry) ? entry : undefined
  })

  if (pair.includes(undefined)) {
    return null
  }

  return pair as [number | null, number | null]
}

function normalizeOperation(value: unknown): AnalysisAIOperation | null {
  if (!isRecord(value)) {
    return null
  }

  const type = normalizeOperationType(value.type)
  if (!type) {
    return null
  }

  if (type === 'rename-analysis') {
    const name = trimString(value.name)
    return name ? { type: 'rename-analysis', name } : null
  }

  if (type === 'rename-player') {
    const playerId = trimString(value.playerId)
    const name = trimString(value.name)
    return playerId && name ? { type: 'rename-player', playerId, name } : null
  }

  if (type === 'add-strategy') {
    const playerId = trimString(value.playerId)
    const strategyId = trimString(value.strategyId)
    const name = trimString(value.name)
    return playerId && strategyId && name
      ? { type: 'add-strategy', playerId, strategyId, name }
      : null
  }

  if (type === 'rename-strategy') {
    const playerId = trimString(value.playerId)
    const strategyId = trimString(value.strategyId)
    const name = trimString(value.name)
    return playerId && strategyId && name
      ? { type: 'rename-strategy', playerId, strategyId, name }
      : null
  }

  if (type === 'set-profile-payoffs') {
    const player1StrategyId = trimString(value.player1StrategyId)
    const player2StrategyId = trimString(value.player2StrategyId)
    const payoffs = normalizePayoffPair(value.payoffs)
    return player1StrategyId && player2StrategyId && payoffs
      ? {
          type: 'set-profile-payoffs',
          player1StrategyId,
          player2StrategyId,
          payoffs,
        }
      : null
  }

  return null
}

function normalizeOperations(value: unknown): AnalysisAIOperation[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const operations = value.map((entry) => normalizeOperation(entry))
  return operations.every(Boolean) ? (operations as AnalysisAIOperation[]) : null
}

export function classifyAnalysisIntent(input: string): AnalysisAIIntent {
  const normalized = input.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'answer'
  }

  if (EXPLICIT_EDIT_PATTERN.test(normalized)) {
    return 'edit'
  }

  if (MUTATION_VERB_PATTERN.test(normalized) && MUTATION_TARGET_PATTERN.test(normalized)) {
    return 'edit'
  }

  return 'answer'
}

function buildAnalysisAIContextData(
  analysis: Analysis,
  validation: AnalysisValidation,
  summary: AnalysisSummary,
  insights: AnalysisInsights,
  analysisRevision = 0,
): AnalysisAIContext {
  const players = analysis.players.map((player, index) =>
    [
      `- Player ${index + 1}: ${player.name} (${player.id})`,
      ...player.strategies.map(
        (strategy) => `  - Strategy: ${strategy.name} (${strategy.id})`,
      ),
    ].join('\n'),
  )

  const prompt = [
    'ANALYSIS CONTEXT',
    `Revision: ${analysisRevision}`,
    `Analysis: ${analysis.name} (${analysis.id})`,
    `Status: ${summary.statusLabel}`,
    `Progress: ${summary.progressLabel}`,
    `Completion: ${summary.completeProfileCount}/${summary.totalProfileCount} complete`,
    '',
    'PLAYERS AND STRATEGIES',
    ...players,
    '',
    'PAYOFF PROFILES',
    ...formatProfiles(summary),
    '',
    'VALIDATION ISSUES',
    ...formatIssues(validation),
    '',
    'STRATEGIC INSIGHTS',
    ...formatInsights(insights),
  ].join('\n')

  return { prompt }
}

export function buildAnalysisAIContext(
  analysis: Analysis,
  validation: AnalysisValidation,
  summary: AnalysisSummary,
  insights: AnalysisInsights,
  analysisRevision = 0,
): AnalysisAIContext {
  return buildAnalysisAIContextData(
    analysis,
    validation,
    summary,
    insights,
    analysisRevision,
  )
}

export function parseAnalysisAIPlannerResult(text: string): AnalysisAIPlannerResult | null {
  const cleaned = trimJsonLike(text)
  if (!cleaned) {
    return null
  }

  try {
    const parsed = JSON.parse(cleaned) as unknown
    if (!isRecord(parsed)) {
      return null
    }

    const kind = trimString(parsed.kind ?? parsed.result ?? parsed.outcome)
    if (kind === 'cannot_edit') {
      const reason = trimString(parsed.reason ?? parsed.message ?? parsed.rationale)
      return reason ? { kind: 'cannot_edit', reason } : null
    }

    if (kind === 'edit' || (!kind && Array.isArray(parsed.operations))) {
      const operations = normalizeOperations(parsed.operations)
      return operations ? { kind: 'edit', operations } : null
    }

    return null
  } catch {
    return null
  }
}

export function applyAnalysisOperations(
  analysisSnapshot: Analysis,
  operations: AnalysisAIOperation[],
): Analysis {
  let working = structuredClone(analysisSnapshot)

  for (const [index, operation] of operations.entries()) {
    const errorPrefix = `Analysis AI operation ${index + 1}`

    switch (operation.type) {
      case 'rename-analysis':
        working.name = operation.name
        break
      case 'rename-player': {
        const player = findPlayer(working, operation.playerId, errorPrefix)
        player.name = operation.name
        break
      }
      case 'add-strategy': {
        const player = findPlayer(working, operation.playerId, errorPrefix)
        if (findStrategyOwner(working, operation.strategyId)) {
          throw new Error(
            `${errorPrefix} strategy id "${operation.strategyId}" already exists.`,
          )
        }

        player.strategies = [
          ...player.strategies,
          {
            id: operation.strategyId,
            name: operation.name,
          },
        ]
        // Normalize immediately so later operations in the same batch can
        // reference the newly created strategy profiles by stable ids.
        working = normalizeAnalysis(working)
        break
      }
      case 'rename-strategy': {
        const player = findPlayer(working, operation.playerId, errorPrefix)
        const strategy = player.strategies.find(
          (entry) => entry.id === operation.strategyId,
        )
        if (!strategy) {
          throw new Error(
            `${errorPrefix} strategy id "${operation.strategyId}" was not found on player "${player.id}".`,
          )
        }

        strategy.name = operation.name
        break
      }
      case 'set-profile-payoffs': {
        const player1Match = findStrategyOwner(working, operation.player1StrategyId)
        if (!player1Match || player1Match.player.id !== working.players[0].id) {
          throw new Error(
            `${errorPrefix} player 1 strategy id "${operation.player1StrategyId}" was not found.`,
          )
        }

        const player2Match = findStrategyOwner(working, operation.player2StrategyId)
        if (!player2Match || player2Match.player.id !== working.players[1].id) {
          throw new Error(
            `${errorPrefix} player 2 strategy id "${operation.player2StrategyId}" was not found.`,
          )
        }

        const profile = findProfile(
          working,
          operation.player1StrategyId,
          operation.player2StrategyId,
          errorPrefix,
        )
        profile.payoffs = operation.payoffs
        break
      }
      default:
        throw new Error(`${errorPrefix} has an unsupported type.`)
    }
  }

  // Re-normalize once at the end so the full batch lands in the canonical shape.
  return normalizeAnalysis(working)
}
