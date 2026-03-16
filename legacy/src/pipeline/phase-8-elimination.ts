import type { Command } from '../engine/commands'
import type { CanonicalStore, EntityRef } from '../types'
import type { NormalFormModel } from '../types/formalizations'
import type {
  AssumptionExtractionResult,
  EliminationResult,
  FormalizationResult,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  ProposedEliminatedOutcome,
} from '../types/analysis-pipeline'
import {
  asEntityRef,
  buildModelProposal,
  createEntityId,
  createEntityPreview,
} from './helpers'

interface Phase8RunnerContext {
  canonical: CanonicalStore
  baseRevision: number
  phaseExecution: PhaseExecution
  phaseResults?: Record<number, unknown>
}

function getFormalizationResult(phaseResults?: Record<number, unknown>): FormalizationResult | null {
  const result = phaseResults?.[6]
  return result && typeof result === 'object' && 'phase' in result && result.phase === 6
    ? (result as FormalizationResult)
    : null
}

function getAssumptionResult(phaseResults?: Record<number, unknown>): AssumptionExtractionResult | null {
  const result = phaseResults?.[7]
  return result && typeof result === 'object' && 'phase' in result && result.phase === 7
    ? (result as AssumptionExtractionResult)
    : null
}

interface DominanceElimination {
  gameId: string
  gameName: string
  formalizationId: string
  dominatedStrategy: string
  dominatedPlayerId: string
  outcomeDescription: string
  finding: string
}

function findDominatedStrategyEliminations(
  canonical: CanonicalStore,
  phase6: FormalizationResult,
): DominanceElimination[] {
  const eliminations: DominanceElimination[] = []

  for (const game of Object.values(canonical.games)) {
    const gameFormalizations = Object.values(canonical.formalizations)
      .filter((formalization) => formalization.game_id === game.id)

    for (const formalization of gameFormalizations) {
      const analysis = phase6.baseline_equilibria.analyses.find(
        (entry) => entry.formalization_id === formalization.id,
      )
      if (!analysis) {
        continue
      }

      const isReady = analysis.readiness.overall === 'ready'
        || analysis.readiness.overall === 'usable_with_warnings'
      if (!isReady) {
        continue
      }

      const dominanceSummaries = analysis.solver_summaries.filter(
        (summary) =>
          summary.solver === 'dominance'
          || summary.summary.toLowerCase().includes('dominated')
          || summary.summary.toLowerCase().includes('dominance'),
      )

      for (const summary of dominanceSummaries) {
        if (summary.status === 'failed') {
          continue
        }

        const dominatedInfo = extractDominatedStrategies(formalization, canonical)
        for (const info of dominatedInfo) {
          eliminations.push({
            gameId: game.id,
            gameName: game.name,
            formalizationId: formalization.id,
            dominatedStrategy: info.strategy,
            dominatedPlayerId: info.playerId,
            outcomeDescription: `Outcomes involving ${info.playerName} playing "${info.strategy}" in ${game.name}`,
            finding: `Phase 6 dominance analysis: ${summary.summary}`,
          })
        }
      }

      if (dominanceSummaries.length === 0 && formalization.kind === 'normal_form') {
        const dominated = detectHeuristicDominance(formalization, canonical)
        for (const info of dominated) {
          eliminations.push({
            gameId: game.id,
            gameName: game.name,
            formalizationId: formalization.id,
            dominatedStrategy: info.strategy,
            dominatedPlayerId: info.playerId,
            outcomeDescription: `Outcomes involving ${info.playerName} playing "${info.strategy}" in ${game.name}`,
            finding: `Heuristic dominance check: "${info.strategy}" is weakly dominated for ${info.playerName}`,
          })
        }
      }
    }
  }

  return eliminations
}

interface DominatedStrategyInfo {
  playerId: string
  playerName: string
  strategy: string
}

function extractDominatedStrategies(
  formalization: CanonicalStore['formalizations'][string],
  canonical: CanonicalStore,
): DominatedStrategyInfo[] {
  if (formalization.kind !== 'normal_form') {
    return []
  }

  return detectHeuristicDominance(formalization, canonical)
}

function detectHeuristicDominance(
  formalization: NormalFormModel,
  canonical: CanonicalStore,
): DominatedStrategyInfo[] {
  const results: DominatedStrategyInfo[] = []

  for (const [playerId, strategies] of Object.entries(formalization.strategies)) {
    if (strategies.length < 2) {
      continue
    }

    for (const candidate of strategies) {
      const alternatives = strategies.filter((strategy) => strategy !== candidate)
      const isDominated = alternatives.some((alt) =>
        isWeaklyDominatedBy(formalization, playerId, candidate, alt),
      )

      if (isDominated) {
        const playerName = canonical.players[playerId]?.name ?? playerId
        results.push({ playerId, playerName, strategy: candidate })
      }
    }
  }

  return results
}

function isWeaklyDominatedBy(
  formalization: NormalFormModel,
  playerId: string,
  candidate: string,
  alternative: string,
): boolean {
  let strictlyBetter = false

  for (const cell of formalization.payoff_cells) {
    const profile = cell.strategy_profile
    if (profile[playerId] !== candidate) {
      continue
    }

    const counterpartCell = formalization.payoff_cells.find((other) => {
      const otherProfile = other.strategy_profile
      return otherProfile[playerId] === alternative
        && Object.entries(otherProfile).every(
          ([pid, strategy]) => pid === playerId || strategy === profile[pid],
        )
    })

    if (!counterpartCell) {
      return false
    }

    const candidatePayoff = cell.payoffs[playerId]?.value ?? 0
    const alternativePayoff = counterpartCell.payoffs[playerId]?.value ?? 0

    if (alternativePayoff < candidatePayoff) {
      return false
    }
    if (alternativePayoff > candidatePayoff) {
      strictlyBetter = true
    }
  }

  return strictlyBetter
}

interface AssumptionBasedElimination {
  assumptionId: string
  assumptionStatement: string
  gameIds: string[]
  outcomeDescription: string
  finding: string
}

function findAssumptionBasedEliminations(
  canonical: CanonicalStore,
  phase7: AssumptionExtractionResult,
): AssumptionBasedElimination[] {
  const eliminations: AssumptionBasedElimination[] = []

  const criticalInferenceAssumptions = phase7.assumptions.filter(
    (assumption) =>
      assumption.sensitivity === 'critical'
      && (assumption.evidence_quality === 'inference' || assumption.evidence_quality === 'assumption_only'),
  )

  for (const assumption of criticalInferenceAssumptions) {
    const contradicted = isContradicted(assumption.temp_id, canonical)
    if (!contradicted) {
      continue
    }

    const affectedGameIds = assumption.affected_conclusions
      .filter((ref) => ref.type === 'game')
      .map((ref) => ref.id)

    const affectedFormalizationIds = assumption.affected_conclusions
      .filter((ref) => ref.type === 'formalization')
      .map((ref) => ref.id)

    const gameIdsFromFormalizations = affectedFormalizationIds
      .map((id) => canonical.formalizations[id]?.game_id)
      .filter((gameId): gameId is string => gameId !== undefined)

    const allGameIds = [...new Set([...affectedGameIds, ...gameIdsFromFormalizations])]
    const gameNames = allGameIds
      .map((id) => canonical.games[id]?.name ?? id)
      .join(', ')

    if (allGameIds.length > 0) {
      eliminations.push({
        assumptionId: assumption.temp_id,
        assumptionStatement: assumption.statement,
        gameIds: allGameIds,
        outcomeDescription: `Outcomes relying on the assumption "${assumption.statement}" in ${gameNames}`,
        finding: `Phase 7 critical assumption contradicted: "${assumption.statement}" (evidence quality: ${assumption.evidence_quality})`,
      })
    }
  }

  return eliminations
}

function isContradicted(assumptionId: string, canonical: CanonicalStore): boolean {
  const assumption = canonical.assumptions[assumptionId]
  if (assumption && Array.isArray(assumption.contradicted_by) && assumption.contradicted_by.length > 0) {
    return true
  }

  return Object.values(canonical.contradictions).some(
    (contradiction) =>
      contradiction.left_ref === assumptionId || contradiction.right_ref === assumptionId,
  )
}

function determineSurpriseFactor(
  gameIds: string[],
  canonical: CanonicalStore,
  isDominance: boolean,
): ProposedEliminatedOutcome['surprise_factor'] {
  if (isDominance) {
    return 'low'
  }

  const involvedPlayers = new Set<string>()
  for (const gameId of gameIds) {
    const game = canonical.games[gameId]
    if (game) {
      for (const playerId of game.players) {
        involvedPlayers.add(playerId)
      }
    }
  }

  if (gameIds.length > 1 || involvedPlayers.size > 2) {
    return 'high'
  }

  return 'medium'
}

function buildEliminatedOutcomes(
  dominanceEliminations: DominanceElimination[],
  assumptionEliminations: AssumptionBasedElimination[],
  canonical: CanonicalStore,
): ProposedEliminatedOutcome[] {
  const outcomes: ProposedEliminatedOutcome[] = []

  for (const elimination of dominanceEliminations) {
    outcomes.push({
      temp_id: createEntityId('eliminated_outcome'),
      outcome_description: elimination.outcomeDescription,
      elimination_reasoning: `Strategy "${elimination.dominatedStrategy}" is dominated in formalization ${elimination.formalizationId} for game "${elimination.gameName}". Rational play eliminates outcomes that depend on this strategy being chosen.`,
      citing_phases: [
        { phase: 6, finding: elimination.finding },
      ],
      evidence_refs: [
        asEntityRef('formalization', elimination.formalizationId),
        asEntityRef('game', elimination.gameId),
      ],
      surprise_factor: determineSurpriseFactor([elimination.gameId], canonical, true),
      related_scenarios: [],
    })
  }

  for (const elimination of assumptionEliminations) {
    const evidenceRefs: EntityRef[] = [
      asEntityRef('assumption', elimination.assumptionId),
      ...elimination.gameIds.map((id) => asEntityRef('game', id)),
    ]

    outcomes.push({
      temp_id: createEntityId('eliminated_outcome'),
      outcome_description: elimination.outcomeDescription,
      elimination_reasoning: `Critical assumption "${elimination.assumptionStatement}" has been contradicted in the canonical model. Outcomes that depend on this assumption holding are no longer plausible.`,
      citing_phases: [
        { phase: 7, finding: elimination.finding },
      ],
      evidence_refs: evidenceRefs,
      surprise_factor: determineSurpriseFactor(elimination.gameIds, canonical, false),
      related_scenarios: [],
    })
  }

  return outcomes
}

function buildProposals(
  outcomes: ProposedEliminatedOutcome[],
  context: Phase8RunnerContext,
): ModelProposal[] {
  if (outcomes.length === 0) {
    return []
  }

  return outcomes.map((outcome) => {
    const commands: Command[] = [
      {
        kind: 'add_eliminated_outcome',
        id: outcome.temp_id,
        payload: {
          outcome_description: outcome.outcome_description,
          elimination_reasoning: outcome.elimination_reasoning,
          citing_phases: outcome.citing_phases,
          evidence_refs: outcome.evidence_refs,
          surprise_factor: outcome.surprise_factor,
          related_scenarios: outcome.related_scenarios,
        },
      },
    ]

    return buildModelProposal({
      description: `Eliminate outcome: ${outcome.outcome_description}`,
      phase: 8,
      proposal_type: 'elimination',
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands,
      entity_previews: [
        createEntityPreview('eliminated_outcome', 'add', outcome.temp_id, {
          outcome_description: outcome.outcome_description,
          elimination_reasoning: outcome.elimination_reasoning,
          surprise_factor: outcome.surprise_factor,
        }),
      ],
    })
  })
}

export function runPhase8Elimination(
  context: Phase8RunnerContext,
): EliminationResult {
  const phase6 = getFormalizationResult(context.phaseResults)
  const phase7 = getAssumptionResult(context.phaseResults)

  if (!phase6) {
    const status: PhaseResult = {
      status: 'partial',
      phase: 8,
      execution_id: context.phaseExecution.id,
      retriable: true,
      gaps: ['Phase 6 formalization results are not available; elimination analysis cannot identify dominated strategies.'],
    }

    return {
      phase: 8,
      status,
      eliminated_outcomes: [],
      proposals: [],
    }
  }

  const dominanceEliminations = findDominatedStrategyEliminations(
    context.canonical,
    phase6,
  )

  const assumptionEliminations = phase7
    ? findAssumptionBasedEliminations(context.canonical, phase7)
    : []

  const outcomes = buildEliminatedOutcomes(
    dominanceEliminations,
    assumptionEliminations,
    context.canonical,
  )

  const proposals = buildProposals(outcomes, context)

  const gaps: string[] = []
  if (outcomes.length === 0) {
    gaps.push('No outcomes were eliminated in this pass. The model may lack dominated strategies or contradicted assumptions.')
  }
  if (!phase7) {
    gaps.push('Phase 7 assumption results are not available; assumption-based elimination was skipped.')
  }

  const status: PhaseResult = {
    status: 'complete',
    phase: 8,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps: gaps.length > 0 ? gaps : undefined,
  }

  return {
    phase: 8,
    status,
    eliminated_outcomes: outcomes,
    proposals,
  }
}
