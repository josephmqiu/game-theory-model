import type { Command } from '../../engine/commands'
import type { SemanticGameLabel } from '../../types/canonical'

export interface CreateGameInput {
  name: string
  description: string
  labels: SemanticGameLabel[]
  status: 'active' | 'paused' | 'resolved'
}

export function buildCreateGameCommand(input: CreateGameInput): Command {
  const now = new Date().toISOString()
  return {
    kind: 'add_game',
    payload: {
      name: input.name,
      description: input.description,
      status: input.status,
      semantic_labels: input.labels,
      players: [],
      formalizations: [],
      coupling_links: [],
      key_assumptions: [],
      created_at: now,
      updated_at: now,
    },
  }
}

export interface CreatePlayerInput {
  name: string
  type: 'state' | 'organization' | 'individual' | 'coalition' | 'market' | 'public'
  description?: string
  gameIds?: string[]
}

export function buildCreatePlayerCommand(input: CreatePlayerInput): Command {
  const playerId = `player_${crypto.randomUUID()}`
  const gameIds = input.gameIds ?? []

  return {
    kind: 'batch',
    label: 'Create player',
    commands: [
      {
        kind: 'add_player',
        id: playerId,
        payload: {
          name: input.name,
          type: input.type,
          objectives: [],
          constraints: [],
          metadata: input.description
            ? { description: input.description }
            : undefined,
        },
      },
      ...gameIds.map<Command>((gameId) => ({
        kind: 'attach_player_to_game',
        payload: {
          game_id: gameId,
          player_id: playerId,
        },
      })),
    ],
  }
}

export interface CreateNodeInput {
  formalizationId: string
  label: string
  type: 'decision' | 'chance' | 'terminal'
  actorKind: 'player' | 'nature' | 'environment'
  playerId?: string
  description?: string
}

export function buildCreateNodeCommand(input: CreateNodeInput): Command {
  if (input.actorKind === 'player' && !input.playerId) {
    throw new Error('playerId is required when actorKind is player')
  }

  const actor: import('../../types/canonical').Actor =
    input.actorKind === 'player'
      ? { kind: 'player', player_id: input.playerId! }
      : input.actorKind === 'nature'
        ? { kind: 'nature' }
        : { kind: 'environment' }

  return {
    kind: 'add_game_node',
    payload: {
      formalization_id: input.formalizationId,
      label: input.label,
      type: input.type,
      actor,
      description: input.description,
    },
  }
}

export interface CreateEdgeInput {
  formalizationId: string
  from: string
  to: string
  label: string
}

export function buildCreateEdgeCommand(input: CreateEdgeInput): Command {
  return {
    kind: 'add_game_edge',
    payload: {
      formalization_id: input.formalizationId,
      from: input.from,
      to: input.to,
      label: input.label,
    },
  }
}

export interface CreateFormalizationInput {
  gameId: string
  kind: 'normal_form' | 'extensive_form'
  purpose: 'explanatory' | 'computational' | 'playout'
  abstractionLevel: 'coarse' | 'medium' | 'detailed'
  rowPlayerId?: string
  colPlayerId?: string
  rowStrategies?: string[]
  colStrategies?: string[]
}

export type CreateFormalizationCommandResult = Command & {
  formalizationId: string
  rootNodeId?: string
}

export function buildCreateFormalizationCommand(
  input: CreateFormalizationInput,
): CreateFormalizationCommandResult {
  const formalizationId = `formalization_${crypto.randomUUID()}`

  if (input.kind === 'normal_form') {
    const strategies: Record<string, string[]> = {}

    if (input.rowPlayerId) {
      strategies[input.rowPlayerId] = input.rowStrategies ?? []
    }
    if (input.colPlayerId) {
      strategies[input.colPlayerId] = input.colStrategies ?? []
    }

    const payoffCells =
      input.rowPlayerId && input.colPlayerId
        ? (input.rowStrategies ?? []).flatMap((rowStrategy) =>
            (input.colStrategies ?? []).map((colStrategy) => ({
              strategy_profile: {
                [input.rowPlayerId!]: rowStrategy,
                [input.colPlayerId!]: colStrategy,
              },
              payoffs: {},
            })),
          )
        : []

    const command: Command = {
      kind: 'batch' as const,
      label: 'Create normal-form formalization',
      commands: [
        {
          kind: 'add_formalization' as const,
          id: formalizationId,
          payload: {
            game_id: input.gameId,
            kind: 'normal_form' as const,
            purpose: input.purpose,
            abstraction_level: input.abstractionLevel,
            assumptions: [],
            strategies,
            payoff_cells: payoffCells,
          } as Omit<import('../../types/formalizations').NormalFormModel, 'id'>,
        },
        {
          kind: 'attach_formalization_to_game' as const,
          payload: {
            game_id: input.gameId,
            formalization_id: formalizationId,
          },
        },
      ],
    }

    return Object.assign(command, { formalizationId })
  }

  // For extensive form, auto-create a root decision node and reference it
  const rootNodeId = `game_node_${crypto.randomUUID()}`
  const command: Command = {
    kind: 'batch' as const,
    label: 'Create extensive-form formalization with root node',
    commands: [
      {
        kind: 'add_formalization' as const,
        id: formalizationId,
        payload: {
          game_id: input.gameId,
          kind: 'extensive_form' as const,
          purpose: input.purpose,
          abstraction_level: input.abstractionLevel,
          assumptions: [],
          root_node_id: rootNodeId,
          information_sets: [],
        } as Omit<import('../../types/formalizations').ExtensiveFormModel, 'id'>,
      },
      {
        kind: 'attach_formalization_to_game' as const,
        payload: {
          game_id: input.gameId,
          formalization_id: formalizationId,
        },
      },
      {
        kind: 'add_game_node' as const,
        id: rootNodeId,
        payload: {
          formalization_id: formalizationId,
          label: 'Root',
          type: 'decision' as const,
          actor: { kind: 'nature' as const },
        },
      },
    ],
  }

  return Object.assign(command, { formalizationId, rootNodeId })
}

export interface CreateSourceInput {
  kind: 'web' | 'pdf' | 'article' | 'report' | 'transcript' | 'manual'
  title?: string
  url?: string
  publisher?: string
  notes?: string
}

export function buildCreateSourceCommand(input: CreateSourceInput): Command {
  return {
    kind: 'add_source',
    payload: {
      kind: input.kind,
      title: input.title,
      url: input.url,
      publisher: input.publisher,
      captured_at: new Date().toISOString(),
      notes: input.notes,
    },
  }
}

export interface CreateClaimInput {
  statement: string
  confidence: number
  basedOn: string[]
}

export function buildCreateClaimCommand(input: CreateClaimInput): Command {
  return {
    kind: 'add_claim',
    payload: {
      statement: input.statement,
      confidence: input.confidence,
      based_on: input.basedOn,
    },
  }
}

export interface CreateAssumptionInput {
  statement: string
  type: 'structural' | 'behavioral' | 'payoff' | 'timing' | 'belief' | 'simplification'
  sensitivity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

export function buildCreateAssumptionCommand(input: CreateAssumptionInput): Command {
  return {
    kind: 'add_assumption',
    payload: {
      statement: input.statement,
      type: input.type,
      sensitivity: input.sensitivity,
      confidence: input.confidence,
    },
  }
}

export interface CreateObservationInput {
  sourceId: string
  text: string
}

export function buildCreateObservationCommand(input: CreateObservationInput): Command {
  return {
    kind: 'add_observation',
    payload: {
      source_id: input.sourceId,
      text: input.text,
      captured_at: new Date().toISOString(),
    },
  }
}

export interface CreateInferenceInput {
  statement: string
  derivedFrom: string[]
  confidence: number
  rationale: string
}

export function buildCreateInferenceCommand(input: CreateInferenceInput): Command {
  return {
    kind: 'add_inference',
    payload: {
      statement: input.statement,
      derived_from: input.derivedFrom,
      confidence: input.confidence,
      rationale: input.rationale,
    },
  }
}

export interface CreateContradictionInput {
  leftRef: string
  rightRef: string
  description: string
  resolutionStatus: 'open' | 'partially_resolved' | 'resolved' | 'deferred'
  notes?: string
}

export function buildCreateContradictionCommand(input: CreateContradictionInput): Command {
  return {
    kind: 'add_contradiction',
    payload: {
      left_ref: input.leftRef,
      right_ref: input.rightRef,
      description: input.description,
      resolution_status: input.resolutionStatus,
      notes: input.notes,
    },
  }
}

export interface CreateLatentFactorInput {
  name: string
  description?: string
  states: Array<{ label: string; probability: number; confidence: number }>
  affects: string[]
}

export function buildCreateLatentFactorCommand(input: CreateLatentFactorInput): Command {
  return {
    kind: 'add_latent_factor',
    payload: {
      name: input.name,
      description: input.description,
      states: input.states,
      affects: input.affects,
    },
  }
}

export interface CreateCrossGameLinkInput {
  sourceGameId: string
  targetGameId: string
  triggerRef: string
  effectType: (typeof import('../../types/evidence').crossGameLinkEffectTypes)[number]
  targetRef: string
  rationale: string
  targetPlayerId?: string
}

export function buildCreateCrossGameLinkCommand(input: CreateCrossGameLinkInput): Command {
  return {
    kind: 'add_cross_game_link',
    payload: {
      source_game_id: input.sourceGameId,
      target_game_id: input.targetGameId,
      trigger_ref: input.triggerRef,
      effect_type: input.effectType,
      target_ref: input.targetRef,
      rationale: input.rationale,
      target_player_id: input.targetPlayerId,
    },
  }
}

export interface CreateScenarioInput {
  name: string
  formalizationId: string
  narrative: string
  probabilityModel: 'independent' | 'dependency_aware' | 'ordinal_only'
}

export function buildCreateScenarioCommand(input: CreateScenarioInput): Command {
  return {
    kind: 'add_scenario',
    payload: {
      name: input.name,
      formalization_id: input.formalizationId,
      path: [],
      probability_model: input.probabilityModel,
      key_assumptions: [],
      invalidators: [],
      narrative: input.narrative,
    },
  }
}

export interface CreatePlaybookInput {
  name: string
  formalizationId: string
  notes?: string
}

export function buildCreatePlaybookCommand(input: CreatePlaybookInput): Command {
  return {
    kind: 'add_playbook',
    payload: {
      name: input.name,
      formalization_id: input.formalizationId,
      role_assignments: {},
      notes: input.notes,
    },
  }
}
