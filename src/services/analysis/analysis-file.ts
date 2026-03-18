import {
  ANALYSIS_FILE_TYPE,
  ANALYSIS_FILE_VERSION,
  type Analysis,
  type AnalysisFileV1,
  type AnalysisWorkflowState,
} from '@/types/analysis'
import { normalizeAnalysis, getAnalysisProfileKey } from './analysis-normalization'
import { normalizeAnalysisWorkflowState, isGuidedWorkflowStage } from './analysis-workflow'
import { validateAnalysis } from './analysis-validation'

export class AnalysisFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalysisFileError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function assertAnalysisString(value: unknown, fieldPath: string): asserts value is string {
  if (!isString(value)) {
    throw new AnalysisFileError(`${fieldPath} must be a string.`)
  }
}

function assertAnalysisArray(value: unknown, fieldPath: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new AnalysisFileError(`${fieldPath} must be an array.`)
  }
}

function assertAnalysisFileType(raw: Record<string, unknown>): void {
  if (raw.type !== ANALYSIS_FILE_TYPE) {
    throw new AnalysisFileError(`Unsupported analysis file type: ${String(raw.type)}.`)
  }

  if (raw.version !== ANALYSIS_FILE_VERSION) {
    throw new AnalysisFileError(`Unsupported analysis file version: ${String(raw.version)}.`)
  }
}

function assertAnalysisWorkflowShape(rawWorkflow: unknown): asserts rawWorkflow is AnalysisWorkflowState {
  if (!isRecord(rawWorkflow)) {
    throw new AnalysisFileError('workflow must be an object.')
  }

  if (!isGuidedWorkflowStage(rawWorkflow.currentStage)) {
    throw new AnalysisFileError('workflow.currentStage must be a valid guided workflow stage.')
  }
}

function assertAnalysisShape(rawAnalysis: unknown): asserts rawAnalysis is Analysis {
  if (!isRecord(rawAnalysis)) {
    throw new AnalysisFileError('Analysis payload must be an object.')
  }

  assertAnalysisString(rawAnalysis.id, 'analysis.id')
  assertAnalysisString(rawAnalysis.name, 'analysis.name')
  assertAnalysisArray(rawAnalysis.players, 'analysis.players')
  assertAnalysisArray(rawAnalysis.profiles, 'analysis.profiles')

  if (rawAnalysis.players.length !== 2) {
    throw new AnalysisFileError('Analysis must contain exactly two players.')
  }

  const [player1Raw, player2Raw] = rawAnalysis.players
  if (!isRecord(player1Raw) || !isRecord(player2Raw)) {
    throw new AnalysisFileError('Analysis players must be objects.')
  }

  assertAnalysisString(player1Raw.id, 'analysis.players[0].id')
  assertAnalysisString(player1Raw.name, 'analysis.players[0].name')
  assertAnalysisArray(player1Raw.strategies, 'analysis.players[0].strategies')
  assertAnalysisString(player2Raw.id, 'analysis.players[1].id')
  assertAnalysisString(player2Raw.name, 'analysis.players[1].name')
  assertAnalysisArray(player2Raw.strategies, 'analysis.players[1].strategies')

  if (player1Raw.id === player2Raw.id) {
    throw new AnalysisFileError('Analysis players must have distinct ids.')
  }

  if (player1Raw.strategies.length === 0 || player2Raw.strategies.length === 0) {
    throw new AnalysisFileError('Analysis must include at least one strategy per player.')
  }

  const player1StrategyIds = new Set<string>()
  const player2StrategyIds = new Set<string>()

  for (const [index, strategy] of player1Raw.strategies.entries()) {
    if (!isRecord(strategy)) {
      throw new AnalysisFileError(`analysis.players[0].strategies[${index}] must be an object.`)
    }
    assertAnalysisString(strategy.id, `analysis.players[0].strategies[${index}].id`)
    assertAnalysisString(strategy.name, `analysis.players[0].strategies[${index}].name`)
    if (player1StrategyIds.has(strategy.id)) {
      throw new AnalysisFileError('analysis.players[0].strategies contains duplicate ids.')
    }
    player1StrategyIds.add(strategy.id)
  }

  for (const [index, strategy] of player2Raw.strategies.entries()) {
    if (!isRecord(strategy)) {
      throw new AnalysisFileError(`analysis.players[1].strategies[${index}] must be an object.`)
    }
    assertAnalysisString(strategy.id, `analysis.players[1].strategies[${index}].id`)
    assertAnalysisString(strategy.name, `analysis.players[1].strategies[${index}].name`)
    if (player2StrategyIds.has(strategy.id)) {
      throw new AnalysisFileError('analysis.players[1].strategies contains duplicate ids.')
    }
    player2StrategyIds.add(strategy.id)
  }

  const player1Strategies = player1Raw.strategies as Array<{
    id: string
    name: string
  }>
  const player2Strategies = player2Raw.strategies as Array<{
    id: string
    name: string
  }>

  const expectedProfileKeys = new Set<string>()
  for (const player1Strategy of player1Strategies) {
    for (const player2Strategy of player2Strategies) {
      expectedProfileKeys.add(
        getAnalysisProfileKey(player1Strategy.id, player2Strategy.id),
      )
    }
  }

  const actualProfileKeys = new Set<string>()
  if (rawAnalysis.profiles.length !== expectedProfileKeys.size) {
    throw new AnalysisFileError('Analysis profiles do not match the strategy matrix size.')
  }

  for (const [index, profile] of rawAnalysis.profiles.entries()) {
    if (!isRecord(profile)) {
      throw new AnalysisFileError(`analysis.profiles[${index}] must be an object.`)
    }

    assertAnalysisString(
      profile.player1StrategyId,
      `analysis.profiles[${index}].player1StrategyId`,
    )
    assertAnalysisString(
      profile.player2StrategyId,
      `analysis.profiles[${index}].player2StrategyId`,
    )
    assertAnalysisArray(profile.payoffs, `analysis.profiles[${index}].payoffs`)

    if (profile.payoffs.length !== 2) {
      throw new AnalysisFileError(`analysis.profiles[${index}].payoffs must contain two values.`)
    }

    if (!isNumberOrNull(profile.payoffs[0]) || !isNumberOrNull(profile.payoffs[1])) {
      throw new AnalysisFileError(`analysis.profiles[${index}].payoffs must contain numbers or null.`)
    }

    const profileKey = getAnalysisProfileKey(
      profile.player1StrategyId,
      profile.player2StrategyId,
    )

    if (!expectedProfileKeys.has(profileKey)) {
      throw new AnalysisFileError(`analysis.profiles[${index}] references an unknown strategy combination.`)
    }

    if (actualProfileKeys.has(profileKey)) {
      throw new AnalysisFileError('Analysis profiles contain duplicate strategy combinations.')
    }

    actualProfileKeys.add(profileKey)
  }

  for (const expectedProfileKey of expectedProfileKeys) {
    if (!actualProfileKeys.has(expectedProfileKey)) {
      throw new AnalysisFileError('Analysis profiles are missing one or more strategy combinations.')
    }
  }
}

export function createAnalysisFile(
  analysis: Analysis,
  workflow?: AnalysisWorkflowState,
): AnalysisFileV1 {
  return {
    type: ANALYSIS_FILE_TYPE,
    version: ANALYSIS_FILE_VERSION,
    analysis: normalizeAnalysis(analysis),
    ...(workflow ? { workflow } : {}),
  }
}

export function serializeAnalysisFile(
  analysis: Analysis,
  workflow?: AnalysisWorkflowState,
): string {
  return JSON.stringify(createAnalysisFile(analysis, workflow), null, 2)
}

export function parseAnalysisFileText(text: string): AnalysisFileV1 {
  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    throw new AnalysisFileError('Analysis file is not valid JSON.')
  }

  if (!isRecord(raw)) {
    throw new AnalysisFileError('Analysis file must be a JSON object.')
  }

  assertAnalysisFileType(raw)
  assertAnalysisShape(raw.analysis)
  if (raw.workflow !== undefined) {
    assertAnalysisWorkflowShape(raw.workflow)
  }

  const analysis = normalizeAnalysis(raw.analysis)
  const validation = validateAnalysis(analysis)
  const workflow = normalizeAnalysisWorkflowState(
    analysis,
    validation,
    raw.workflow,
  )

  return {
    type: ANALYSIS_FILE_TYPE,
    version: ANALYSIS_FILE_VERSION,
    analysis,
    workflow,
  }
}

export function createDefaultAnalysisFileName(analysis: Analysis): string {
  const cleaned = analysis.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${cleaned || 'untitled-analysis'}.gta`
}
