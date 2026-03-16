import { dispatch } from '../engine/dispatch'
import { createEventLog } from '../engine/events'
import { computeBayesianUpdate } from '../compute/bayesian'
import { solveBackwardInduction } from '../compute/backward-induction'
import { eliminateDominance } from '../compute/dominance'
import { computeExpectedUtility } from '../compute/expected-utility'
import { solveNash } from '../compute/nash'
import { computeReadiness } from '../compute/readiness'
import type { Command } from '../engine/commands'
import type { CanonicalStore } from '../types'
import type {
  AnalysisState,
  BargainingDynamicsResult,
  BaselineEquilibriaResult,
  CommunicationAnalysisResult,
  CommunicationClassificationSummary,
  CrossGameEffectsResult,
  EquilibriumSelectionResult,
  FormalRepresentationResult,
  FormalizationAnalysisSummary,
  FormalizationRepresentationSummary,
  FormalizationResult,
  HistoricalGameResult,
  ModelProposal,
  OptionValueResult,
  PayoffEstimationResult,
  Phase6ProposalGroup,
  Phase6RunInput,
  Phase6Subsection,
  Phase6SubsectionStatus,
  PhaseExecution,
  PhaseResult,
} from '../types/analysis-pipeline'
import type { EntityRef, SolverReadiness } from '../types/canonical'
import type { EstimateValue } from '../types/estimates'
import type {
  BargainingFormalization,
  BayesianGameModel,
  ExtensiveFormModel,
  Formalization,
  NormalFormModel,
  RepeatedGameModel,
  SignalingFormalization,
} from '../types/formalizations'
import {
  asEntityRef,
  buildModelProposal,
  createEntityId,
  createEntityPreview,
  descriptionContains,
} from './helpers'
import { normalizeCrossGameEffect } from './cross-game-effects'

const ALL_SUBSECTIONS: Phase6Subsection[] = ['6a', '6b', '6c', '6d', '6e', '6f', '6g', '6h', '6i']

interface Phase6RunnerContext {
  canonical: CanonicalStore
  analysisState: AnalysisState
  baseRevision: number
  phaseExecution: PhaseExecution
  phaseResults?: Record<number, unknown>
}

interface PlannedFormalization {
  id: string
  gameId: string
  gameName: string
  kind: FormalizationRepresentationSummary['kind']
  purpose: FormalizationRepresentationSummary['purpose']
  abstraction_level: FormalizationRepresentationSummary['abstraction_level']
  reused_existing: boolean
  rationale: string
  assumption_ids: string[]
  node_ids?: {
    root: string
    accept: string
    resist: string
  }
}

type Phase6FormalizationPayload =
  | Omit<NormalFormModel, 'id'>
  | Omit<ExtensiveFormModel, 'id'>
  | Omit<RepeatedGameModel, 'id'>
  | Omit<BayesianGameModel, 'id'>
  | Omit<SignalingFormalization, 'id'>
  | Omit<BargainingFormalization, 'id'>

interface Phase6WorkingState {
  subsections: Phase6Subsection[]
  plannedFormalizations: PlannedFormalization[]
  proposalsBySubsection: Record<Phase6Subsection, ModelProposal[]>
  subsectionStatuses: Phase6SubsectionStatus[]
  revalidationTriggers: FormalizationResult['revalidation_signals']['triggers_found']
  revalidationEntities: EntityRef[]
  revalidationNotes: string[]
}

function createStructuredEstimate(params: {
  representation: EstimateValue['representation']
  value?: number
  min?: number
  max?: number
  ordinal_rank?: number
  rationale: string
  confidence?: number
  assumptions?: string[]
}): EstimateValue {
  return {
    representation: params.representation,
    value: params.value,
    min: params.min,
    max: params.max,
    ordinal_rank: params.ordinal_rank,
    confidence: params.confidence ?? 0.62,
    rationale: params.rationale,
    source_claims: [],
    assumptions: params.assumptions,
  }
}

function emptyStatus(
  subsection: Phase6Subsection,
  status: Phase6SubsectionStatus['status'],
  summary: string,
  warnings: string[] = [],
): Phase6SubsectionStatus {
  return {
    subsection,
    status,
    summary,
    warnings,
  }
}

function createProposalGroupRecord(): Record<Phase6Subsection, ModelProposal[]> {
  return {
    '6a': [],
    '6b': [],
    '6c': [],
    '6d': [],
    '6e': [],
    '6f': [],
    '6g': [],
    '6h': [],
    '6i': [],
  }
}

function firstGame(canonical: CanonicalStore) {
  return Object.values(canonical.games)[0] ?? null
}

function firstTwoPlayers(game: CanonicalStore['games'][string] | null): string[] {
  return game?.players.slice(0, 2) ?? []
}

function getHistoricalResult(context: Phase6RunnerContext): HistoricalGameResult | null {
  const phase4 = context.phaseResults?.[4]
  return phase4 && typeof phase4 === 'object' && 'phase' in phase4 && phase4.phase === 4
    ? phase4 as HistoricalGameResult
    : null
}

function queueStatus(state: Phase6WorkingState, status: Phase6SubsectionStatus): void {
  state.subsectionStatuses.push(status)
}

function addProposal(state: Phase6WorkingState, subsection: Phase6Subsection, proposal: ModelProposal): void {
  proposal.framing_id = subsection
  state.proposalsBySubsection[subsection].push(proposal)
}

function buildAssumptionCommand(id: string, statement: string, type: 'behavioral' | 'capability' | 'structural' | 'institutional' | 'rationality' | 'information'): Command {
  return {
    kind: 'add_assumption',
    id,
    payload: {
      statement,
      type,
      sensitivity: 'medium',
      confidence: 0.62,
      game_theoretic_vs_empirical: 'game_theoretic',
      correlated_cluster_id: null,
    },
  }
}

function buildFormalizationSummary(
  formalization: Formalization,
  canonical: CanonicalStore,
  reusedExisting: boolean,
  rationale: string,
): FormalizationRepresentationSummary {
  return {
    formalization_id: formalization.id,
    game_id: formalization.game_id,
    game_name: canonical.games[formalization.game_id]?.name ?? formalization.game_id,
    kind: formalization.kind as FormalizationRepresentationSummary['kind'],
    purpose: formalization.purpose,
    abstraction_level: formalization.abstraction_level,
    reused_existing: reusedExisting,
    rationale,
    assumption_ids: [...formalization.assumptions],
  }
}

function buildNormalFormPayload(
  formalizationId: string,
  gameId: string,
  players: string[],
): Omit<NormalFormModel, 'id'> {
  const [rowPlayerId, colPlayerId] = players
  const rowStrategies = ['Escalate', 'Hold']
  const colStrategies = ['Resist', 'Accommodate']

  return {
    game_id: gameId,
    kind: 'normal_form',
    purpose: 'computational',
    abstraction_level: 'moderate',
    assumptions: [],
    strategies: {
      [rowPlayerId!]: rowStrategies,
      [colPlayerId!]: colStrategies,
    },
    payoff_cells: rowStrategies.flatMap((rowStrategy, rowIndex) =>
      colStrategies.map((colStrategy, colIndex) => ({
        strategy_profile: {
          [rowPlayerId!]: rowStrategy,
          [colPlayerId!]: colStrategy,
        },
        payoffs: {
          [rowPlayerId!]: createStructuredEstimate({
            representation: 'interval_estimate',
            min: 1 + rowIndex,
            max: 3 + colIndex,
            rationale: 'Structured cardinal band for baseline payoff comparison.',
          }),
          [colPlayerId!]: createStructuredEstimate({
            representation: 'interval_estimate',
            min: 1 + colIndex,
            max: 3 + rowIndex,
            rationale: 'Structured cardinal band for baseline payoff comparison.',
          }),
        },
      })),
    ),
  }
}

function buildExtensiveFormCommands(
  formalizationId: string,
  gameId: string,
  actingPlayerId: string,
): {
  payload: Omit<ExtensiveFormModel, 'id'>
  commands: Command[]
  nodeIds: PlannedFormalization['node_ids']
} {
  const rootId = createEntityId('game_node')
  const acceptId = createEntityId('game_node')
  const resistId = createEntityId('game_node')
  const acceptEdgeId = createEntityId('game_edge')
  const resistEdgeId = createEntityId('game_edge')

  return {
    payload: {
      game_id: gameId,
      kind: 'extensive_form',
      purpose: 'computational',
      abstraction_level: 'moderate',
      assumptions: [],
      root_node_id: rootId,
      information_sets: [],
    },
    commands: [
      {
        kind: 'add_game_node',
        id: rootId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: 'player', player_id: actingPlayerId },
          type: 'decision',
          label: 'Opening move',
          available_actions: ['Escalate', 'Delay'],
        },
      },
      {
        kind: 'add_game_node',
        id: acceptId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: 'nature' },
          type: 'terminal',
          label: 'Accommodation outcome',
        },
      },
      {
        kind: 'add_game_node',
        id: resistId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: 'nature' },
          type: 'terminal',
          label: 'Resistance outcome',
        },
      },
      {
        kind: 'add_game_edge',
        id: acceptEdgeId,
        payload: {
          formalization_id: formalizationId,
          from: rootId,
          to: acceptId,
          label: 'Escalate',
        },
      },
      {
        kind: 'add_game_edge',
        id: resistEdgeId,
        payload: {
          formalization_id: formalizationId,
          from: rootId,
          to: resistId,
          label: 'Delay',
        },
      },
    ],
    nodeIds: {
      root: rootId,
      accept: acceptId,
      resist: resistId,
    },
  }
}

function buildRepeatedPayload(
  gameId: string,
  stageFormalizationId: string,
  players: string[],
): Omit<RepeatedGameModel, 'id'> {
  return {
    game_id: gameId,
    kind: 'repeated',
    purpose: 'explanatory',
    abstraction_level: 'moderate',
    assumptions: [],
    stage_formalization_id: stageFormalizationId,
    horizon: 'indefinite',
    discount_factors: Object.fromEntries(
      players.map((playerId) => [
        playerId,
        {
          type: 'exponential',
          delta: createStructuredEstimate({
            representation: 'interval_estimate',
            min: 0.65,
            max: 0.9,
            rationale: 'Ordinal-first scaffold converted to a broad continuation-value band.',
          }),
        },
      ]),
    ),
    equilibrium_selection: {
      criterion: 'grim_trigger',
    },
  }
}

function buildBayesianPayload(
  gameId: string,
  players: string[],
): Omit<BayesianGameModel, 'id'> {
  const focalPlayer = players[0] ?? 'player_a'
  return {
    game_id: gameId,
    kind: 'bayesian',
    purpose: 'computational',
    abstraction_level: 'moderate',
    assumptions: [],
    player_types: {
      [focalPlayer]: [
        { label: 'Resolved', prior_probability: 0.55, description: 'High willingness to sustain pressure.' },
        { label: 'Constrained', prior_probability: 0.45, description: 'Higher cost from escalation or delay.' },
      ],
    },
    priors: [
      {
        player_id: focalPlayer,
        types: [
          { label: 'Resolved', prior_probability: 0.55 },
          { label: 'Constrained', prior_probability: 0.45 },
        ],
      },
    ],
    signal_structure: {
      signals: [
        { label: 'Hardline statement', type_label: 'Resolved', probability: 0.7 },
        { label: 'Hardline statement', type_label: 'Constrained', probability: 0.3 },
        { label: 'Conciliatory signal', type_label: 'Resolved', probability: 0.3 },
        { label: 'Conciliatory signal', type_label: 'Constrained', probability: 0.7 },
      ],
    },
  }
}

function buildSignalingPayload(
  gameId: string,
): Omit<SignalingFormalization, 'id'> {
  return {
    game_id: gameId,
    kind: 'signaling',
    purpose: 'explanatory',
    abstraction_level: 'moderate',
    assumptions: [],
    sender_types: [
      {
        type_id: 'resolved',
        label: 'Resolved',
        prior_probability: createStructuredEstimate({
          representation: 'interval_estimate',
          min: 0.45,
          max: 0.65,
          rationale: 'Broad prior over sender type.',
        }),
      },
      {
        type_id: 'constrained',
        label: 'Constrained',
        prior_probability: createStructuredEstimate({
          representation: 'interval_estimate',
          min: 0.35,
          max: 0.55,
          rationale: 'Broad prior over sender type.',
        }),
      },
    ],
    messages: [
      {
        message_id: 'hardline',
        label: 'Hardline statement',
        cost_by_type: {
          resolved: createStructuredEstimate({
            representation: 'interval_estimate',
            min: 0.1,
            max: 0.3,
            rationale: 'Low reputational cost for resolved type.',
          }),
          constrained: createStructuredEstimate({
            representation: 'interval_estimate',
            min: 0.4,
            max: 0.7,
            rationale: 'Higher reputational cost for constrained type.',
          }),
        },
      },
    ],
    receiver_actions: [
      { action_id: 'accommodate', label: 'Accommodate' },
      { action_id: 'test', label: 'Test resolve' },
    ],
    equilibrium_concept: 'semi_separating',
  }
}

function buildBargainingPayload(
  gameId: string,
  players: string[],
): Omit<BargainingFormalization, 'id'> {
  return {
    game_id: gameId,
    kind: 'bargaining',
    purpose: 'explanatory',
    abstraction_level: 'moderate',
    assumptions: [],
    protocol: 'alternating_offers',
    parties: players,
    outside_options: Object.fromEntries(
      players.map((playerId, index) => [
        playerId,
        createStructuredEstimate({
          representation: 'interval_estimate',
          min: index + 1,
          max: index + 2.5,
          rationale: 'Outside option band capturing fallback leverage.',
        }),
      ]),
    ),
    discount_factors: Object.fromEntries(
      players.map((playerId) => [
        playerId,
        createStructuredEstimate({
          representation: 'interval_estimate',
          min: 0.6,
          max: 0.9,
          rationale: 'Delay costs remain material but uncertain.',
        }),
      ]),
    ),
    surplus: createStructuredEstimate({
      representation: 'interval_estimate',
      min: 4,
      max: 8,
      rationale: 'Negotiated surplus remains broad but positive.',
    }),
    deadline: {
      rounds: createStructuredEstimate({
        representation: 'interval_estimate',
        min: 2,
        max: 5,
        rationale: 'Negotiating window is limited but not point-estimated.',
      }),
      pressure_model: 'risk_of_breakdown',
    },
    first_mover: players[0],
  }
}

function buildFormalizationProposal(
  context: Phase6RunnerContext,
  params: {
    subsection: Phase6Subsection
    description: string
    proposal_type: ModelProposal['proposal_type']
    commands: Command[]
    previews: Array<ReturnType<typeof createEntityPreview>>
  },
): ModelProposal {
  return buildModelProposal({
    description: params.description,
    phase: 6,
    proposal_type: params.proposal_type,
    phaseExecution: context.phaseExecution,
    baseRevision: context.baseRevision,
    commands: params.commands,
    entity_previews: params.previews,
  })
}

function planFormalRepresentations(context: Phase6RunnerContext, state: Phase6WorkingState): FormalRepresentationResult {
  const game = firstGame(context.canonical)
  const players = firstTwoPlayers(game)
  if (!game || players.length < 2) {
    queueStatus(state, emptyStatus('6a', 'not_applicable', 'No accepted baseline game with two players is available for formalization.'))
    return {
      status: 'not_applicable',
      summaries: [],
      reused_formalization_ids: [],
      new_game_hypotheses: [],
      assumption_proposal_ids: [],
      warnings: ['Phase 6 needs an accepted game and two players before formalization can proceed.'],
    }
  }

  const historical = getHistoricalResult(context)
  const description = context.analysisState.event_description
  const gameFormalizations = game.formalizations
    .map((id) => context.canonical.formalizations[id])
    .filter(Boolean)
  const summaries: FormalizationRepresentationSummary[] = []
  const reusedIds: string[] = []
  const assumptionProposalIds: string[] = []
  const newGameHypotheses: FormalRepresentationResult['new_game_hypotheses'] = []

  const baselineExisting = gameFormalizations.find(
    (formalization) => formalization.kind === 'normal_form' || formalization.kind === 'extensive_form',
  )
  if (baselineExisting) {
    reusedIds.push(baselineExisting.id)
    state.plannedFormalizations.push({
      id: baselineExisting.id,
      gameId: game.id,
      gameName: game.name,
      kind: baselineExisting.kind as PlannedFormalization['kind'],
      purpose: baselineExisting.purpose,
      abstraction_level: baselineExisting.abstraction_level,
      reused_existing: true,
      rationale: 'Phase 3 baseline formalization already covers the core strategic spine.',
      assumption_ids: [...baselineExisting.assumptions],
    })
    summaries.push(buildFormalizationSummary(
      baselineExisting,
      context.canonical,
      true,
      'Phase 3 baseline formalization already covers the core strategic spine.',
    ))
  } else {
    const formalizationId = createEntityId('formalization')
    const assumptionId = createEntityId('assumption')
    const wantsExtensive = game.move_order === 'sequential' || descriptionContains(description, 'deadline', 'ultimatum', 'sequence')
    const baseCommands: Command[] = [
      buildAssumptionCommand(
        assumptionId,
        'Players preserve the same baseline action menu during the current decision window.',
        'structural',
      ),
    ]

    let previews = [
      createEntityPreview('assumption', 'add', assumptionId, {
        statement: 'Players preserve the same baseline action menu during the current decision window.',
      }),
    ]

    let planned: PlannedFormalization
    if (wantsExtensive) {
      const extensive = buildExtensiveFormCommands(formalizationId, game.id, players[0]!)
      baseCommands.push(
        {
          kind: 'add_formalization',
          id: formalizationId,
          payload: {
            ...extensive.payload,
            assumptions: [assumptionId],
          },
        },
        {
          kind: 'attach_formalization_to_game',
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
        ...extensive.commands,
      )
      previews = [
        ...previews,
        createEntityPreview('formalization', 'add', formalizationId, {
          kind: 'extensive_form',
          game_id: game.id,
        }),
      ]
      planned = {
        id: formalizationId,
        gameId: game.id,
        gameName: game.name,
        kind: 'extensive_form',
        purpose: 'computational',
        abstraction_level: 'moderate',
        reused_existing: false,
        rationale: 'Sequential timing and deadline cues justify an extensive-form baseline.',
        assumption_ids: [assumptionId],
        node_ids: extensive.nodeIds,
      }
    } else {
      baseCommands.push(
        {
          kind: 'add_formalization',
          id: formalizationId,
          payload: {
            ...buildNormalFormPayload(formalizationId, game.id, players),
            assumptions: [assumptionId],
          },
        },
        {
          kind: 'attach_formalization_to_game',
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
      )
      previews = [
        ...previews,
        createEntityPreview('formalization', 'add', formalizationId, {
          kind: 'normal_form',
          game_id: game.id,
        }),
      ]
      planned = {
        id: formalizationId,
        gameId: game.id,
        gameName: game.name,
        kind: 'normal_form',
        purpose: 'computational',
        abstraction_level: 'moderate',
        reused_existing: false,
        rationale: 'A compact matrix remains the best computational anchor for the current baseline.',
        assumption_ids: [assumptionId],
      }
    }

    const proposal = buildFormalizationProposal(context, {
      subsection: '6a',
      description: `Create a ${planned.kind.replace(/_/g, ' ')} baseline formalization for ${game.name}.`,
      proposal_type: 'formalization',
      commands: baseCommands,
      previews,
    })
    addProposal(state, '6a', proposal)
    assumptionProposalIds.push(proposal.id)
    state.plannedFormalizations.push(planned)
    summaries.push({
      formalization_id: planned.id,
      game_id: planned.gameId,
      game_name: planned.gameName,
      kind: planned.kind,
      purpose: planned.purpose,
      abstraction_level: planned.abstraction_level,
      reused_existing: false,
      rationale: planned.rationale,
      assumption_ids: planned.assumption_ids,
    })
  }

  const anchor = state.plannedFormalizations[0]
  if (!anchor) {
    queueStatus(state, emptyStatus('6a', 'partial', 'No Phase 6 formalization anchor could be established.'))
    return {
      status: 'partial',
      summaries,
      reused_formalization_ids: reusedIds,
      new_game_hypotheses: newGameHypotheses,
      assumption_proposal_ids: assumptionProposalIds,
      warnings: ['Phase 6 could not establish a computational anchor formalization.'],
    }
  }

  const needsRepeated = Boolean(historical?.patterns_found.length) || descriptionContains(description, 'repeat', 'iterat', 'relationship', 'history')
  const needsBayesian = Boolean(historical?.baseline_recheck.hidden_type_uncertainty) || descriptionContains(description, 'uncertain', 'private', 'hidden type', 'screen')
  const needsSignaling = Boolean(historical?.global_signaling_effects.length) || descriptionContains(description, 'signal', 'credib', 'audience')
  const needsBargaining = game.canonical_game_type === 'bargaining'
    || game.semantic_labels.includes('bargaining')
    || descriptionContains(description, 'bargain', 'negotiat', 'settlement')

  function maybeAddComplementaryFormalization(params: {
    enabled: boolean
    kind: PlannedFormalization['kind']
    rationale: string
    payload: Phase6FormalizationPayload
  }) {
    if (!params.enabled) {
      return
    }
    const existing = gameFormalizations.find((formalization) => formalization.kind === params.kind)
    if (existing) {
      reusedIds.push(existing.id)
      state.plannedFormalizations.push({
        id: existing.id,
        gameId: game.id,
        gameName: game.name,
        kind: params.kind,
        purpose: existing.purpose,
        abstraction_level: existing.abstraction_level,
        reused_existing: true,
        rationale: params.rationale,
        assumption_ids: [...existing.assumptions],
      })
      summaries.push(buildFormalizationSummary(existing, context.canonical, true, params.rationale))
      return
    }

    const formalizationId = createEntityId('formalization')
    const assumptionId = createEntityId('assumption')
    const proposal = buildFormalizationProposal(context, {
      subsection: '6a',
      description: `Add a complementary ${params.kind.replace(/_/g, ' ')} formalization for ${game.name}.`,
      proposal_type: 'formalization',
      commands: [
        buildAssumptionCommand(
          assumptionId,
          `${params.kind.replace(/_/g, ' ')} framing captures a strategically distinct lens for ${game.name}.`,
          params.kind === 'bayesian' || params.kind === 'signaling' ? 'information' : 'structural',
        ),
        {
          kind: 'add_formalization',
          id: formalizationId,
          payload: {
            ...params.payload,
            assumptions: [assumptionId],
            game_id: game.id,
          },
        },
        {
          kind: 'attach_formalization_to_game',
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
      ],
      previews: [
        createEntityPreview('assumption', 'add', assumptionId, {
          statement: `${params.kind.replace(/_/g, ' ')} framing captures a strategically distinct lens for ${game.name}.`,
        }),
        createEntityPreview('formalization', 'add', formalizationId, {
          kind: params.kind,
          game_id: game.id,
        }),
      ],
    })
    addProposal(state, '6a', proposal)
    assumptionProposalIds.push(proposal.id)
    state.plannedFormalizations.push({
      id: formalizationId,
      gameId: game.id,
      gameName: game.name,
      kind: params.kind,
      purpose: params.payload.purpose,
      abstraction_level: params.payload.abstraction_level,
      reused_existing: false,
      rationale: params.rationale,
      assumption_ids: [assumptionId],
    })
    summaries.push({
      formalization_id: formalizationId,
      game_id: game.id,
      game_name: game.name,
      kind: params.kind,
      purpose: params.payload.purpose,
      abstraction_level: params.payload.abstraction_level,
      reused_existing: false,
      rationale: params.rationale,
      assumption_ids: [assumptionId],
    })
  }

  maybeAddComplementaryFormalization({
    enabled: needsRepeated,
    kind: 'repeated',
    rationale: 'Historical interaction appears persistent enough to warrant an indefinite repeated-game lens.',
    payload: buildRepeatedPayload(game.id, anchor.id, players),
  })
  maybeAddComplementaryFormalization({
    enabled: needsBayesian,
    kind: 'bayesian',
    rationale: 'Hidden type or private-information cues justify an incomplete-information overlay.',
    payload: buildBayesianPayload(game.id, players),
  })
  maybeAddComplementaryFormalization({
    enabled: needsSignaling,
    kind: 'signaling',
    rationale: 'Communication and credibility cues justify an explicit signaling frame.',
    payload: buildSignalingPayload(game.id),
  })
  maybeAddComplementaryFormalization({
    enabled: needsBargaining,
    kind: 'bargaining',
    rationale: 'The case is negotiation-shaped enough to warrant a bargaining lens alongside the baseline anchor.',
    payload: buildBargainingPayload(game.id, players),
  })

  if (Object.keys(context.canonical.games).length > 1) {
    newGameHypotheses.push({
      label: 'Multiple accepted games remain strategically active.',
      rationale: 'Phase 6 should preserve cross-game interaction rather than collapsing into a single baseline.',
    })
    state.revalidationTriggers.push('new_game_identified')
    state.revalidationEntities.push(...Object.keys(context.canonical.games).map((id) => asEntityRef('game', id)))
    state.revalidationNotes.push('Phase 6 formalization spans multiple accepted games.')
  } else if (summaries.some((summary) => summary.kind === 'repeated' || summary.kind === 'bayesian' || summary.kind === 'signaling')) {
    state.revalidationTriggers.push('game_reframed')
    state.revalidationEntities.push(asEntityRef('game', game.id))
    state.revalidationNotes.push('Phase 6 introduced a structurally distinct strategic framing beyond the original baseline.')
  }

  queueStatus(
    state,
    emptyStatus(
      '6a',
      'complete',
      `Prepared ${summaries.length} formal representation${summaries.length === 1 ? '' : 's'} for Phase 6.`,
    ),
  )

  return {
    status: 'complete',
    summaries,
    reused_formalization_ids: reusedIds,
    new_game_hypotheses: newGameHypotheses,
    assumption_proposal_ids: assumptionProposalIds,
    warnings: [],
  }
}

function planPayoffEstimation(context: Phase6RunnerContext, state: Phase6WorkingState): PayoffEstimationResult {
  if (state.plannedFormalizations.length === 0) {
    queueStatus(state, emptyStatus('6b', 'partial', 'No planned formalizations exist yet for payoff estimation.'))
    return {
      status: 'partial',
      updates: [],
      warnings: ['Run 6a or provide an accepted formalization before estimating payoffs.'],
    }
  }

  const updates: PayoffEstimationResult['updates'] = []

  for (const planned of state.plannedFormalizations) {
    if (planned.kind === 'normal_form') {
      const proposal = buildFormalizationProposal(context, {
        subsection: '6b',
        description: `Populate solver-facing payoff estimates for ${planned.gameName}.`,
        proposal_type: 'formalization',
        commands: [
          {
            kind: 'update_formalization',
            payload: {
              id: planned.id,
              payoff_cells: buildNormalFormPayload(planned.id, planned.gameId, firstTwoPlayers(context.canonical.games[planned.gameId]) || []).payoff_cells,
            },
          },
        ],
        previews: [
          createEntityPreview('formalization', 'update', planned.id, {
            kind: planned.kind,
            payoff_style: 'interval_estimate',
          }),
        ],
      })
      addProposal(state, '6b', proposal)
      updates.push({
        formalization_id: planned.id,
        ordinal_first: true,
        updated_profiles: 4,
        updated_terminal_nodes: 0,
        cardinal_justifications: ['Cardinal interval bands were added because Phase 6 solver summaries require comparable payoff magnitudes.'],
      })
      continue
    }

    if (planned.kind === 'extensive_form' && planned.node_ids) {
      const players = firstTwoPlayers(context.canonical.games[planned.gameId])
      const proposal = buildFormalizationProposal(context, {
        subsection: '6b',
        description: `Populate terminal utility estimates for the extensive-form branch structure in ${planned.gameName}.`,
        proposal_type: 'formalization',
        commands: [
          {
            kind: 'update_game_node',
            payload: {
              id: planned.node_ids.accept,
              terminal_payoffs: {
                [players[0]!]: createStructuredEstimate({
                  representation: 'interval_estimate',
                  min: 4,
                  max: 6,
                  rationale: 'Accommodation branch preserves leverage at moderate cost.',
                }),
                [players[1]!]: createStructuredEstimate({
                  representation: 'interval_estimate',
                  min: 2,
                  max: 4,
                  rationale: 'Accommodation branch preserves the counterparty position but concedes some initiative.',
                }),
              },
            },
          },
          {
            kind: 'update_game_node',
            payload: {
              id: planned.node_ids.resist,
              terminal_payoffs: {
                [players[0]!]: createStructuredEstimate({
                  representation: 'interval_estimate',
                  min: 1,
                  max: 3,
                  rationale: 'Delay branch preserves flexibility but risks drift.',
                }),
                [players[1]!]: createStructuredEstimate({
                  representation: 'interval_estimate',
                  min: 3,
                  max: 5,
                  rationale: 'Delay branch protects the counterparty from immediate concession.',
                }),
              },
            },
          },
        ],
        previews: [
          createEntityPreview('game_node', 'update', planned.node_ids.accept, {
            label: 'Accommodation outcome',
            payoffs: 'updated',
          }),
          createEntityPreview('game_node', 'update', planned.node_ids.resist, {
            label: 'Resistance outcome',
            payoffs: 'updated',
          }),
        ],
      })
      addProposal(state, '6b', proposal)
      updates.push({
        formalization_id: planned.id,
        ordinal_first: true,
        updated_profiles: 0,
        updated_terminal_nodes: 2,
        cardinal_justifications: ['Terminal utility intervals were added to support backward induction on the branch structure.'],
      })
    }
  }

  queueStatus(
    state,
    emptyStatus(
      '6b',
      updates.length > 0 ? 'complete' : 'partial',
      updates.length > 0
        ? `Estimated payoffs for ${updates.length} formalization${updates.length === 1 ? '' : 's'}.`
        : 'No solver-facing payoff updates were generated.',
    ),
  )

  return {
    status: updates.length > 0 ? 'complete' : 'partial',
    updates,
    warnings: updates.length > 0 ? [] : ['No formalization required Phase 6 payoff updates.'],
  }
}

function buildOverlayStore(context: Phase6RunnerContext, state: Phase6WorkingState): CanonicalStore {
  const commands = Object.values(state.proposalsBySubsection).flatMap((proposals) =>
    proposals.flatMap((proposal) => proposal.commands),
  )

  if (commands.length === 0) {
    return context.canonical
  }

  const result = dispatch(
    context.canonical,
    createEventLog(context.analysisState.id, context.baseRevision),
    {
      kind: 'batch',
      label: 'Phase 6 proposed overlay',
      commands,
      base_revision: context.baseRevision,
    },
    { dryRun: true, source: 'ai_merge' },
  )

  return result.status === 'dry_run' ? result.store : context.canonical
}

function summarizeReadiness(readiness: SolverReadiness): string {
  if (readiness.overall === 'ready') {
    return `Ready with ${readiness.supported_solvers.length} supported solver(s).`
  }
  if (readiness.overall === 'usable_with_warnings') {
    return `Usable with warnings: ${readiness.warnings[0] ?? 'Review the readiness panel.'}`
  }
  return `Blocked: ${readiness.blockers[0] ?? 'Readiness checks failed.'}`
}

function analyzeFormalizations(
  overlay: CanonicalStore,
  state: Phase6WorkingState,
): {
  baseline_equilibria: BaselineEquilibriaResult
  equilibrium_selection: EquilibriumSelectionResult
} {
  if (state.plannedFormalizations.length === 0) {
    return {
      baseline_equilibria: {
        status: 'partial',
        analyses: [],
        warnings: ['No planned formalizations were available for solver analysis.'],
      },
      equilibrium_selection: {
        status: 'partial',
        selections: [],
        warnings: ['No equilibria were available for selection.'],
      },
    }
  }

  const analyses: FormalizationAnalysisSummary[] = []
  const selections: EquilibriumSelectionResult['selections'] = []

  for (const planned of state.plannedFormalizations) {
    const formalization = overlay.formalizations[planned.id]
    if (!formalization) {
      continue
    }

    const readiness = computeReadiness(formalization, overlay).readiness
    const solver_summaries: FormalizationAnalysisSummary['solver_summaries'] = [
      {
        solver: 'readiness',
        status: readiness.overall === 'not_ready' ? 'failed' : readiness.overall === 'usable_with_warnings' ? 'partial' : 'success',
        summary: summarizeReadiness(readiness),
        warnings: [...readiness.warnings, ...readiness.blockers],
      },
    ]
    let classification: string | null = null
    let selectedEquilibriumId: string | null = null
    const alternatives: string[] = []

    if (formalization.kind === 'normal_form') {
      const nash = solveNash(formalization, overlay)
      const dominance = eliminateDominance(formalization, overlay)
      const expectedUtility = computeExpectedUtility(formalization, overlay)
      solver_summaries.push(
        {
          solver: 'nash',
          status: nash.status,
          summary: nash.status === 'failed'
            ? (nash.error ?? 'Nash search failed.')
            : `${nash.equilibria.length} Nash equilibrium candidate(s) identified.`,
          equilibrium_count: nash.equilibria.length,
          warnings: nash.warnings,
        },
        {
          solver: 'dominance',
          status: dominance.status,
          summary: `${dominance.eliminated_strategies.length} dominated strategy elimination(s) found.`,
          equilibrium_count: dominance.reduced_game.remaining_cells.length,
          warnings: dominance.warnings,
        },
        {
          solver: 'expected_utility',
          status: expectedUtility.status,
          summary: `Best responses summarize expected utility under a uniform-opponent heuristic.`,
          warnings: expectedUtility.warnings,
        },
      )
      selectedEquilibriumId = nash.equilibria[0]?.id ?? null
      for (const equilibrium of nash.equilibria.slice(1)) {
        alternatives.push(equilibrium.id)
      }
      classification = nash.equilibria.length > 1
        ? 'Multiple equilibrium candidates remain live.'
        : nash.equilibria.length === 1
          ? 'Single focal equilibrium candidate.'
          : 'No solver-cleared Nash equilibrium yet.'
    } else if (formalization.kind === 'extensive_form') {
      const backwardInduction = solveBackwardInduction(formalization, overlay)
      solver_summaries.push({
        solver: 'backward_induction',
        status: backwardInduction.status,
        summary: backwardInduction.status === 'failed'
          ? (backwardInduction.error ?? 'Backward induction failed.')
          : `Backward induction produced a ${backwardInduction.solution_path.length}-step solution path.`,
        equilibrium_count: backwardInduction.solution_path.length > 0 ? 1 : 0,
        warnings: backwardInduction.warnings,
      })
      selectedEquilibriumId = backwardInduction.solution_path[0] ?? null
      classification = backwardInduction.status === 'success'
        ? 'Sequential solution path identified.'
        : 'Tree remains blocked on extensive-form completeness.'
    } else if (formalization.kind === 'bayesian') {
      const bayesian = computeBayesianUpdate(formalization, overlay)
      solver_summaries.push({
        solver: 'bayesian_update',
        status: bayesian.status,
        summary: bayesian.status === 'failed'
          ? (bayesian.error ?? 'Bayesian update failed.')
          : `Posterior beliefs updated across ${bayesian.update_chain.length} observation step(s).`,
        equilibrium_count: bayesian.posterior_beliefs.length,
        warnings: bayesian.warnings,
      })
      classification = bayesian.posterior_beliefs.length > 0
        ? 'Belief updating materially changes downstream expectations.'
        : 'Belief updating remains underspecified.'
    } else if (formalization.kind === 'signaling') {
      solver_summaries.push({
        solver: 'signaling_classification',
        status: formalization.equilibrium_concept ? 'success' : 'partial',
        summary: formalization.equilibrium_concept
          ? `Current signaling frame looks ${formalization.equilibrium_concept.replace(/_/g, ' ')}.`
          : 'Signaling frame lacks an explicit equilibrium concept.',
        warnings: readiness.warnings,
      })
      classification = formalization.equilibrium_concept
        ? `${formalization.equilibrium_concept.replace(/_/g, ' ')} signaling structure.`
        : 'Signal structure present without equilibrium labeling.'
    } else if (formalization.kind === 'repeated') {
      solver_summaries.push({
        solver: 'readiness',
        status: readiness.overall === 'not_ready' ? 'partial' : 'success',
        summary: readiness.overall === 'not_ready'
          ? 'Repeated-game simulation remains blocked, but continuation incentives are structurally mapped.'
          : 'Repeated-game continuation incentives are ready for simulation review.',
        warnings: [...readiness.warnings, ...readiness.blockers],
      })
      classification = 'Continuation-value frame active.'
    } else if (formalization.kind === 'bargaining') {
      solver_summaries.push({
        solver: 'bargaining',
        status: 'partial',
        summary: 'Bargaining structure is represented, but the dedicated bargaining solver remains deferred.',
        warnings: [...readiness.warnings, ...readiness.blockers],
      })
      classification = 'Alternating-offers bargaining structure captured.'
    }

    analyses.push({
      formalization_id: formalization.id,
      game_id: formalization.game_id,
      kind: formalization.kind as FormalizationAnalysisSummary['kind'],
      readiness,
      solver_summaries,
      classification,
    })

    if (selectedEquilibriumId || alternatives.length > 0) {
      selections.push({
        formalization_id: formalization.id,
        selected_equilibrium_id: selectedEquilibriumId,
        rationale: selectedEquilibriumId
          ? 'Selected the first solver-cleared equilibrium candidate as the current focal point.'
          : 'No focal equilibrium could be selected yet.',
        alternatives,
      })
    }
  }

  return {
    baseline_equilibria: {
      status: analyses.length > 0 ? 'complete' : 'partial',
      analyses,
      warnings: analyses.length > 0 ? [] : ['No formalization analysis summaries were produced.'],
    },
    equilibrium_selection: {
      status: selections.length > 0 ? 'complete' : 'partial',
      selections,
      warnings: selections.length > 0 ? [] : ['Multiple equilibria were not solver-cleared, so selection remains advisory only.'],
    },
  }
}

function buildBargainingDynamics(
  canonical: CanonicalStore,
  state: Phase6WorkingState,
): BargainingDynamicsResult | null {
  const bargainingPlan = state.plannedFormalizations.find((planned) => planned.kind === 'bargaining')
  const bargainingModel = bargainingPlan ? canonical.formalizations[bargainingPlan.id] : null
  if (!bargainingPlan && !bargainingModel) {
    queueStatus(state, emptyStatus('6e', 'not_applicable', 'No bargaining-specific frame was selected for this case.'))
    return null
  }

  queueStatus(state, emptyStatus('6e', 'complete', 'Bargaining leverage and outside-option dynamics were summarized.'))
  return {
    status: 'complete',
    applicable: true,
    summary: 'Outside options, delay costs, and first-mover dynamics jointly shape the bargaining envelope.',
    leverage_points: [
      'Outside options anchor reservation values.',
      'Delay costs create pressure against indefinite holdouts.',
      'First-mover control shapes agenda-setting power.',
    ],
    warnings: [],
  }
}

function buildCommunicationAnalysis(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): CommunicationAnalysisResult {
  const game = firstGame(context.canonical)
  const players = firstTwoPlayers(game)
  const description = context.analysisState.event_description

  if (!game || players.length === 0 || !descriptionContains(description, 'signal', 'credib', 'audience', 'statement', 'message')) {
    queueStatus(state, emptyStatus('6f', 'not_applicable', 'No strong communication-signaling cues were detected.'))
    return {
      status: 'not_applicable',
      classifications: [],
      warnings: [],
    }
  }

  const classifications: CommunicationClassificationSummary[] = players.map((playerId, index) => {
    const classification = descriptionContains(description, 'audience')
      ? 'audience_cost'
      : index === 0
        ? 'costly_signal'
        : 'cheap_talk'
    const id = createEntityId('signal_classification')
    const proposal = buildFormalizationProposal(context, {
      subsection: '6f',
      description: `Classify ${context.canonical.players[playerId]?.name ?? playerId} communication incentives in ${game.name}.`,
      proposal_type: 'signal',
      commands: [
        {
          kind: 'add_signal_classification',
          id,
          payload: {
            player_id: playerId,
            signal_description: `${context.canonical.players[playerId]?.name ?? playerId} is sending strategic messages that affect counterpart beliefs.`,
            classification,
            cost_description: classification === 'costly_signal'
              ? 'Backing down after a hardline signal would impose reputational or material cost.'
              : null,
            informativeness: classification === 'cheap_talk' ? 'medium' : 'high',
            informativeness_conditions: ['Interpret in the context of current bargaining leverage and audience incentives.'],
            evidence_refs: [],
            game_refs: [asEntityRef('game', game.id)],
          },
        },
      ],
      previews: [
        createEntityPreview('signal_classification', 'add', id, {
          player_id: playerId,
          classification,
        }),
      ],
    })
    addProposal(state, '6f', proposal)
    return {
      id,
      player_id: playerId,
      classification,
      summary: `${context.canonical.players[playerId]?.name ?? playerId} is best modeled as ${classification.replace(/_/g, ' ')} in the current messaging environment.`,
    }
  })

  queueStatus(state, emptyStatus('6f', 'complete', `Classified communication incentives for ${classifications.length} player signal channel(s).`))
  return {
    status: 'complete',
    classifications,
    warnings: [],
  }
}

function buildOptionValue(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): OptionValueResult | null {
  const game = firstGame(context.canonical)
  const description = context.analysisState.event_description
  if (!game || !descriptionContains(description, 'wait', 'delay', 'hold', 'pause', 'option')) {
    queueStatus(state, emptyStatus('6g', 'not_applicable', 'No credible wait-or-hold option dominated the current model.'))
    return null
  }

  const playerId = game.players[0]
  queueStatus(state, emptyStatus('6g', 'complete', 'Option value from waiting or delaying remains materially relevant.'))
  return {
    status: 'complete',
    summary: 'Preserving a delay option has material value because new information can arrive before irreversible commitment.',
    player_options: playerId
      ? [{ player_id: playerId, option: 'Delay and gather additional information', value: 'material' }]
      : [],
    warnings: [],
  }
}

function buildBehavioralOverlay(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): FormalizationResult['behavioral_overlays'] {
  const description = context.analysisState.event_description
  const cues: NonNullable<FormalizationResult['behavioral_overlays']>['overlays'] = []
  if (descriptionContains(description, 'election', 'domestic politics', 'audience')) {
    cues.push({
      label: 'Domestic political pressure',
      effect_on_prediction: 'shifts_risk' as const,
      summary: 'Domestic audience costs may compress the negotiated settlement space.',
    })
  }
  if (descriptionContains(description, 'bias', 'misperception', 'emotion', 'prestige')) {
    cues.push({
      label: 'Behavioral misperception risk',
      effect_on_prediction: 'changes_prediction' as const,
      summary: 'Behavioral overlays suggest the baseline rational model may underweight escalation traps.',
    })
  }

  if (cues.length === 0) {
    queueStatus(state, emptyStatus('6h', 'not_applicable', 'No strong adjacent behavioral overlay stood out in this pass.'))
    return null
  }

  if (cues.some((overlay) => overlay.effect_on_prediction === 'changes_prediction')) {
    const game = firstGame(context.canonical)
    if (game) {
      state.revalidationTriggers.push('behavioral_overlay_changes_prediction')
      state.revalidationEntities.push(asEntityRef('game', game.id))
      state.revalidationNotes.push('Behavioral overlays materially change the predicted branch weights.')
    }
  }

  queueStatus(state, emptyStatus('6h', 'complete', 'Adjacent behavioral overlays were documented without replacing the core game-theoretic model.'))
  return {
    status: 'complete',
    label: 'ADJACENT — NOT CORE GAME THEORY',
    methodology_flags: [
      'Use only as an adjacent overlay on top of the core game-theoretic structure.',
      'Do not silently promote behavioral overlays into canonical payoffs without explicit review.',
    ],
    overlays: cues,
    warnings: [],
  }
}

function buildCrossGameEffects(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): CrossGameEffectsResult | null {
  const games = Object.values(context.canonical.games)
  if (games.length < 2) {
    queueStatus(state, emptyStatus('6i', 'not_applicable', 'Only one accepted game is active, so cross-game spillovers remain dormant.'))
    return null
  }

  const [sourceGame, targetGame] = games
  const effect = normalizeCrossGameEffect({
    source_game_id: sourceGame!.id,
    target_game_id: targetGame!.id,
    trigger_ref: sourceGame!.id,
    effect_type: 'commitment_change',
    target_ref: targetGame!.id,
    rationale: 'Commitments in the source game change bargaining leverage and timing in the target game.',
  })
  const linkId = createEntityId('cross_game_link')
  const proposal = buildFormalizationProposal(context, {
    subsection: '6i',
    description: `Add a cross-game linkage between ${sourceGame!.name} and ${targetGame!.name}.`,
    proposal_type: 'cross_game_link',
    commands: [
      {
        kind: 'add_cross_game_link',
        id: linkId,
        payload: effect,
      },
      {
        kind: 'update_game',
        payload: {
          id: sourceGame!.id,
          coupling_links: [...sourceGame!.coupling_links, linkId],
        },
      },
      {
        kind: 'update_game',
        payload: {
          id: targetGame!.id,
          coupling_links: [...targetGame!.coupling_links, linkId],
        },
      },
    ],
    previews: [
      createEntityPreview('cross_game_link', 'add', linkId, {
        source_game_id: effect.source_game_id,
        target_game_id: effect.target_game_id,
        effect_type: effect.effect_type,
      }),
    ],
  })
  addProposal(state, '6i', proposal)
  state.revalidationTriggers.push('new_cross_game_link')
  state.revalidationEntities.push(asEntityRef('cross_game_link', linkId))
  state.revalidationNotes.push('Phase 6 added a new cross-game linkage that should be monitored downstream.')

  queueStatus(state, emptyStatus('6i', 'complete', 'Cross-game spillovers were normalized into an explicit linkage proposal.'))
  return {
    status: 'complete',
    effects: [
      {
        source_game_id: effect.source_game_id,
        target_game_id: effect.target_game_id,
        effect_type: effect.effect_type,
        summary: effect.rationale,
      },
    ],
    warnings: [],
  }
}

function buildProposalGroups(state: Phase6WorkingState): Phase6ProposalGroup[] {
  const descriptions: Record<Phase6Subsection, string> = {
    '6a': '6a: Choosing formal representations...',
    '6b': '6b: Estimating structured payoffs...',
    '6c': '6c: Computing baseline equilibrium summaries...',
    '6d': '6d: Comparing equilibrium selection candidates...',
    '6e': '6e: Reviewing bargaining dynamics...',
    '6f': '6f: Classifying strategic communication...',
    '6g': '6g: Checking the option value of waiting...',
    '6h': '6h: Documenting adjacent behavioral overlays...',
    '6i': '6i: Evaluating cross-game effects...',
  }

  return ALL_SUBSECTIONS.flatMap((subsection) =>
    state.proposalsBySubsection[subsection].length > 0
      ? [{
          subsection,
          content: descriptions[subsection],
          proposals: state.proposalsBySubsection[subsection],
        }]
      : [],
  )
}

function dedupeEntityRefs(refs: EntityRef[]): EntityRef[] {
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

export function runPhase6Formalization(
  input: Phase6RunInput | undefined,
  context: Phase6RunnerContext,
): FormalizationResult {
  const subsections = input?.subsections?.length
    ? ALL_SUBSECTIONS.filter((subsection) => input.subsections?.includes(subsection))
    : ALL_SUBSECTIONS
  const state: Phase6WorkingState = {
    subsections,
    plannedFormalizations: [],
    proposalsBySubsection: createProposalGroupRecord(),
    subsectionStatuses: [],
    revalidationTriggers: [],
    revalidationEntities: [],
    revalidationNotes: [],
  }

  const formal_representations = subsections.includes('6a')
    ? planFormalRepresentations(context, state)
    : {
        status: 'not_applicable' as const,
        summaries: [],
        reused_formalization_ids: [],
        new_game_hypotheses: [],
        assumption_proposal_ids: [],
        warnings: [],
      }

  const payoff_estimation = subsections.includes('6b')
    ? planPayoffEstimation(context, state)
    : {
        status: 'not_applicable' as const,
        updates: [],
        warnings: [],
      }

  const overlayStore = buildOverlayStore(context, state)
  const { baseline_equilibria, equilibrium_selection } =
    subsections.includes('6c') || subsections.includes('6d')
      ? analyzeFormalizations(overlayStore, state)
      : {
          baseline_equilibria: {
            status: 'not_applicable' as const,
            analyses: [],
            warnings: [],
          },
          equilibrium_selection: {
            status: 'not_applicable' as const,
            selections: [],
            warnings: [],
          },
        }

  if (subsections.includes('6c')) {
    queueStatus(
      state,
      emptyStatus(
        '6c',
        baseline_equilibria.analyses.length > 0 ? baseline_equilibria.status : 'partial',
        baseline_equilibria.analyses.length > 0
          ? `Generated baseline equilibrium summaries for ${baseline_equilibria.analyses.length} formalization(s).`
          : 'No formalization was solver-ready enough for equilibrium summarization.',
        baseline_equilibria.warnings,
      ),
    )
  }

  if (subsections.includes('6d')) {
    queueStatus(
      state,
      emptyStatus(
        '6d',
        equilibrium_selection.selections.length > 0 ? equilibrium_selection.status : 'partial',
        equilibrium_selection.selections.length > 0
          ? 'Documented equilibrium-selection rationale for the live solver candidates.'
          : 'No multiple-equilibrium case required a separate selection rationale.',
        equilibrium_selection.warnings,
      ),
    )
  }

  const bargaining_dynamics = subsections.includes('6e')
    ? buildBargainingDynamics(overlayStore, state)
    : null
  const communication_analysis = subsections.includes('6f')
    ? buildCommunicationAnalysis(context, state)
    : {
        status: 'not_applicable' as const,
        classifications: [],
        warnings: [],
      }
  const option_value = subsections.includes('6g')
    ? buildOptionValue(context, state)
    : null
  const behavioral_overlays = subsections.includes('6h')
    ? buildBehavioralOverlay(context, state)
    : null
  const cross_game_effects = subsections.includes('6i')
    ? buildCrossGameEffects(context, state)
    : null

  const proposal_groups = buildProposalGroups(state)
  const proposals = proposal_groups.flatMap((group) => group.proposals)
  const partialSubsections = state.subsectionStatuses.filter((entry) => entry.status !== 'complete')
  const phaseStatus: PhaseResult = {
    status: partialSubsections.length > 0 ? 'partial' : 'complete',
    phase: 6,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps: partialSubsections.map((entry) => `${entry.subsection}: ${entry.summary}`),
  }

  return {
    phase: 6,
    status: phaseStatus,
    subsections_run: subsections,
    subsection_statuses: state.subsectionStatuses,
    formal_representations,
    payoff_estimation,
    baseline_equilibria,
    equilibrium_selection,
    bargaining_dynamics,
    communication_analysis,
    option_value,
    behavioral_overlays,
    cross_game_effects,
    proposals,
    proposal_groups,
    revalidation_signals: {
      triggers_found: [...new Set(state.revalidationTriggers)],
      affected_entities: dedupeEntityRefs(state.revalidationEntities),
      description: state.revalidationNotes.join(' ') || 'Phase 6 introduced no additional revalidation signals.',
    },
  }
}
