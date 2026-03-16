import type { CanonicalStore } from '../types'
import type {
  ActiveRerunCycle,
  AnalysisState,
  BaselineModelResult,
  FormalizationResult,
  HistoricalGameResult,
  PendingRevalidationApproval,
  PlayerIdentificationResult,
  RevalidationCheck,
  RevalidationEngine,
  RevalidationOutcome,
} from '../types/analysis-pipeline'
import type { EntityRef } from '../types/canonical'
import type { RevalidationEvent, RevalidationTrigger } from '../types/evidence'
import { createEntityRef } from '../types/canonical'

interface RevalidationEngineDependencies {
  getCanonical: () => CanonicalStore
  getAnalysisState: () => AnalysisState | null
  getPendingApproval: (eventId: string) => PendingRevalidationApproval | null
  clearPendingApproval: (eventId: string) => void
  setActiveRerunCycle: (cycle: ActiveRerunCycle | null) => void
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}

function uniqueRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function createCheck(
  triggers_found: RevalidationTrigger[],
  affected_phases: number[],
  affected_entities: EntityRef[],
  recommendation: RevalidationCheck['recommendation'],
  description: string,
): RevalidationCheck {
  return {
    triggers_found,
    affected_phases: uniqueNumbers(affected_phases),
    affected_entities: uniqueRefs(affected_entities),
    recommendation,
    description,
  }
}

function getPhase2Check(result: PlayerIdentificationResult): RevalidationCheck {
  const internalPlayers = result.proposed_players.filter(
    (player) => player.role === 'internal' || Boolean(player.parent_player_id),
  )
  if (internalPlayers.length === 0) {
    return createCheck([], [], [], 'none', 'Phase 2 introduced no new independent agency triggers.')
  }

  return createCheck(
    ['new_player_discovered'],
    [3, 4],
    [],
    'revalidate',
    `${internalPlayers.length} internal or hidden player layer(s) require downstream model revalidation.`,
  )
}

function getPhase3Check(result: BaselineModelResult): RevalidationCheck {
  const triggers: RevalidationTrigger[] = []
  const affectedPhases: number[] = []
  const affectedEntities: EntityRef[] = []
  const notes: string[] = []

  if (result.proposed_games.length > 1) {
    triggers.push('new_game_identified')
    affectedPhases.push(3, 4)
    affectedEntities.push(...result.proposed_games.map((game) => createEntityRef('game', game.temp_id)))
    notes.push('Multiple baseline games were proposed.')
  }

  if (result.escalation_ladder) {
    triggers.push('escalation_ladder_revision')
    affectedPhases.push(3)
    affectedEntities.push(createEntityRef('game', result.escalation_ladder.game_id))
    notes.push('Escalation ladder changed the baseline framing.')
  }

  const constrainedGames = result.proposed_games.filter((game) => game.institutional_constraints.length > 0)
  if (constrainedGames.length > 0) {
    triggers.push('institutional_constraint_changed')
    affectedPhases.push(3)
    affectedEntities.push(...constrainedGames.map((game) => createEntityRef('game', game.temp_id)))
    notes.push('Institutional constraints materially shape the strategy space.')
  }

  if (result.model_gaps.some((gap) => /does not yet explain|remain approximate/i.test(gap))) {
    triggers.push('model_cannot_explain_fact')
    affectedPhases.push(3)
    notes.push('Baseline model gaps still leave core explanatory holes.')
  }

  if (triggers.length === 0) {
    return createCheck([], [], [], 'none', 'Phase 3 introduced no revalidation triggers.')
  }

  const recommendation: RevalidationCheck['recommendation'] = triggers.includes('new_game_identified')
    ? 'revalidate'
    : 'monitor'

  return createCheck(
    triggers,
    affectedPhases,
    affectedEntities,
    recommendation,
    notes.join(' '),
  )
}

function getPhase4Check(result: HistoricalGameResult): RevalidationCheck {
  if (!result.baseline_recheck.revalidation_needed) {
    return createCheck([], [], [], 'none', 'Phase 4 historical review converged with the current baseline.')
  }

  const gameRefs = result.dynamic_inconsistency_risks.flatMap((risk) => risk.affected_games)
  const playerRefs = result.trust_assessment.flatMap((assessment) => [
    createEntityRef('player', assessment.assessor_player_id),
    createEntityRef('player', assessment.target_player_id),
  ])

  return createCheck(
    result.baseline_recheck.revalidation_triggers,
    [3, 4],
    [...gameRefs, ...playerRefs],
    'revalidate',
    'Historical interaction patterns changed the baseline framing and require a rerun.',
  )
}

function getPhase6Check(result: FormalizationResult): RevalidationCheck {
  const triggers = [...new Set(result.revalidation_signals.triggers_found)]
  if (triggers.length === 0) {
    return createCheck([], [], [], 'none', 'Phase 6 introduced no revalidation-worthy formalization shifts.')
  }

  const recommendation: RevalidationCheck['recommendation'] = triggers.some(
    (trigger) => trigger === 'new_game_identified' || trigger === 'game_reframed',
  )
    ? 'revalidate'
    : 'monitor'

  return createCheck(
    triggers,
    recommendation === 'revalidate' ? [3, 4, 6] : [6],
    result.revalidation_signals.affected_entities,
    recommendation,
    result.revalidation_signals.description,
  )
}

export function createRevalidationEngine(
  deps: RevalidationEngineDependencies,
): RevalidationEngine {
  return {
    checkTriggers(phaseResult, phase) {
      if (phase === 2) {
        return getPhase2Check(phaseResult as PlayerIdentificationResult)
      }
      if (phase === 3) {
        return getPhase3Check(phaseResult as BaselineModelResult)
      }
      if (phase === 4) {
        return getPhase4Check(phaseResult as HistoricalGameResult)
      }
      if (phase === 6) {
        return getPhase6Check(phaseResult as FormalizationResult)
      }

      return createCheck([], [], [], 'none', `Phase ${phase} has no implemented M6.1 trigger checks yet.`)
    },

    async executeRevalidation(event) {
      const analysisState = deps.getAnalysisState()
      const pendingApproval = deps.getPendingApproval(event.id)
      const nextPassNumber = (analysisState?.pass_number ?? event.pass_number) + 1

      if (pendingApproval) {
        deps.clearPendingApproval(event.id)
      }

      deps.setActiveRerunCycle({
        event_id: event.id,
        source_phase: event.source_phase,
        target_phases: event.target_phases,
        earliest_phase: Math.min(...event.target_phases),
        pass_number: nextPassNumber,
        started_at: new Date().toISOString(),
        status: 'queued',
      })

      return {
        event_id: event.id,
        phases_rerun: pendingApproval?.target_phases ?? event.target_phases,
        entities_marked_stale: pendingApproval?.affected_entities ?? event.entity_refs,
        entities_updated: [],
        new_pass_number: nextPassNumber,
        converged: false,
      }
    },

    getRevalidationLog() {
      return Object.values(deps.getCanonical().revalidation_events).sort(
        (left, right) => right.triggered_at.localeCompare(left.triggered_at),
      )
    },

    getCurrentPass() {
      return deps.getAnalysisState()?.pass_number ?? 1
    },
  }
}
