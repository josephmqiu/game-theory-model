import type { Command } from '../engine/commands'
import type { CanonicalStore } from '../types'
import type {
  AnalysisState,
  InformationAsymmetryMap,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  PlayerIdentificationResult,
  ProposedPlayer,
} from '../types/analysis-pipeline'
import {
  asEntityRef,
  buildModelProposal,
  createConfidenceEstimate,
  createEntityId,
  createEntityPreview,
  createEstimate,
  descriptionContains,
  extractActorSketch,
} from './helpers'

export interface Phase2Input {
  additional_context?: string
}

export interface Phase2RunnerContext {
  canonical: CanonicalStore
  analysisState: AnalysisState
  baseRevision: number
  phaseExecution: PhaseExecution
}

function inferPlayerType(name: string): ProposedPlayer['type'] {
  const lower = name.toLowerCase()
  if (/(state|government|ministry|country)/.test(lower)) return 'state'
  if (/(market|investor|consumer)/.test(lower)) return 'market'
  if (/(public|voter|citizen)/.test(lower)) return 'public'
  if (/(coalition|alliance|bloc)/.test(lower)) return 'coalition'
  if (/(ceo|founder|chair|leader|person)/.test(lower)) return 'individual'
  return 'organization'
}

function inferPlayerRole(name: string, index: number, description: string): ProposedPlayer['role'] {
  const lower = name.toLowerCase()
  if (/(cabinet|board|faction|committee|division|bureau)/.test(lower)) return 'internal'
  if (/(regulator|court|bank|gatekeeper)/.test(lower)) return 'gatekeeper'
  if (/(public|voter|citizen)/.test(lower)) return 'background'
  if (index > 1 && descriptionContains(description, 'civilian', 'community', 'supplier')) return 'involuntary'
  return 'primary'
}

function buildPlayer(name: string, index: number, description: string, evidenceRefs: ReturnType<typeof asEntityRef>[]): ProposedPlayer {
  const role = inferPlayerRole(name, index, description)
  const temp_id = createEntityId('player')

  return {
    temp_id,
    name,
    type: inferPlayerType(name),
    role,
    objectives: [
      {
        description: index === 0 ? 'Preserve strategic leverage and avoid a costly concession.' : 'Improve bargaining position while limiting downside exposure.',
        type: descriptionContains(description, 'market', 'price', 'revenue') ? 'economic' : 'survival',
        internal_conflicts: ['Short-term escalation may weaken long-term flexibility.'],
      },
    ],
    priority_ordering: [{ objective_index: 0, priority: 'absolute' }],
    stability_indicator: descriptionContains(description, 'volatile', 'election', 'transition', 'uncertain') ? 'shifting' : 'stable',
    non_standard_utility: descriptionContains(description, 'identity', 'prestige', 'honor', 'ideology')
      ? 'Non-material prestige or ideological payoff appears salient.'
      : null,
    information_state: {
      knows: ['Its own immediate constraints', 'Recent public moves by counterparties'],
      doesnt_know: ['Counterparty reservation value', 'Threshold for escalation reversal'],
      beliefs: ['Counterparty may bluff about willingness to absorb cost'],
    },
    constraints: ['Time pressure', 'Audience scrutiny'],
    evidence_refs: evidenceRefs,
    confidence: createConfidenceEstimate(`Player identification confidence for ${name}.`, evidenceRefs.map((ref) => ref.id), 0.7),
    rationale: `Derived from Phase 1 evidence and the classified strategic tension around ${description}.`,
  }
}

function buildInformationMap(players: ProposedPlayer[]): InformationAsymmetryMap {
  return {
    entries: players.flatMap((player, index) =>
      players.slice(index + 1).map((counterparty) => ({
        player_a: player.temp_id,
        player_b: counterparty.temp_id,
        a_knows_about_b: ['Recent public posture', 'Observed recent actions'],
        b_knows_about_a: ['Stated red lines', 'Visible constraints'],
        critical_gaps: ['Private threshold for concession', 'Tolerance for drawn-out delay'],
      })),
    ),
  }
}

export function runPhase2Players(
  input: Phase2Input,
  context: Phase2RunnerContext,
): PlayerIdentificationResult {
  const evidenceRefs = [
    ...Object.keys(context.canonical.claims).map((id) => asEntityRef('claim', id)),
    ...Object.keys(context.canonical.inferences).map((id) => asEntityRef('inference', id)),
  ]

  const actorNames = context.analysisState.classification?.initial_actors_sketch?.length
    ? context.analysisState.classification.initial_actors_sketch
    : extractActorSketch(context.analysisState.event_description)

  const seedNames = actorNames.length >= 2 ? actorNames : ['Primary Actor', 'Counterparty']
  const basePlayers = seedNames.slice(0, 3).map((name, index) =>
    buildPlayer(name, index, context.analysisState.event_description, evidenceRefs.slice(0, 2)),
  )

  const internalPlayers: ProposedPlayer[] = descriptionContains(
    `${context.analysisState.event_description} ${input.additional_context ?? ''}`,
    'cabinet',
    'board',
    'faction',
    'committee',
  )
    ? [{
      ...buildPlayer('Internal Decision Cell', basePlayers.length, context.analysisState.event_description, evidenceRefs.slice(0, 2)),
      role: 'internal' as const,
      parent_player_id: basePlayers[0]?.temp_id,
      stability_indicator: 'shifting' as const,
    }]
    : []

  const players = [...basePlayers, ...internalPlayers]

  const proposals: ModelProposal[] = players.map((player) => {
    const commands: Command[] = [
      {
        kind: 'add_player',
        id: player.temp_id,
        payload: {
          name: player.name,
          type: player.type,
          role: player.role,
          parent_player_id: player.parent_player_id,
          objectives: player.objectives.map((objective) => ({
            label: objective.description,
            weight: createEstimate(0.75, objective.description),
            description: objective.internal_conflicts.join(' '),
          })),
          constraints: player.constraints.map((constraint) => ({
            label: constraint,
            type: 'strategic',
            severity: 'soft',
            description: constraint,
          })),
          priority_ordering: player.priority_ordering,
          stability_indicator: player.stability_indicator,
          non_standard_utility: player.non_standard_utility,
          information_state: player.information_state,
        },
      },
    ]

    return buildModelProposal({
      description: `Add player: ${player.name}`,
      phase: 2,
      proposal_type: 'player',
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands,
      entity_previews: [
        createEntityPreview('player', 'add', player.temp_id, {
          name: player.name,
          type: player.type,
          role: player.role,
          parent_player_id: player.parent_player_id ?? null,
        }),
      ],
    })
  })

  return {
    phase: 2,
    status: {
      status: 'complete',
      phase: 2,
      execution_id: context.phaseExecution.id,
      retriable: true,
    } satisfies PhaseResult,
    proposed_players: players,
    information_asymmetry_map: buildInformationMap(players),
    proposals,
  }
}
