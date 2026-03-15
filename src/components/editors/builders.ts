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
}

export function buildCreatePlayerCommand(input: CreatePlayerInput): Command {
  return {
    kind: 'add_player',
    payload: {
      name: input.name,
      type: input.type,
      objectives: [],
      constraints: [],
      metadata: input.description
        ? { description: input.description }
        : undefined,
    },
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
  const actor =
    input.actorKind === 'player' && input.playerId
      ? { kind: 'player' as const, player_id: input.playerId }
      : input.actorKind === 'nature'
        ? { kind: 'nature' as const }
        : { kind: 'environment' as const }

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
}

export function buildCreateFormalizationCommand(input: CreateFormalizationInput): Command {
  if (input.kind === 'normal_form') {
    return {
      kind: 'add_formalization',
      payload: {
        game_id: input.gameId,
        kind: 'normal_form' as const,
        purpose: input.purpose,
        abstraction_level: input.abstractionLevel,
        assumptions: [],
        strategies: {},
        payoff_cells: [],
      } as Omit<import('../../types/formalizations').NormalFormModel, 'id'>,
    }
  }

  // For extensive form, auto-create a root decision node and reference it
  const rootNodeId = `game_node_${crypto.randomUUID()}`

  return {
    kind: 'batch',
    label: 'Create extensive-form formalization with root node',
    commands: [
      {
        kind: 'add_game_node',
        id: rootNodeId,
        payload: {
          formalization_id: input.gameId,
          label: 'Root',
          type: 'decision',
          actor: { kind: 'nature' },
        },
      },
      {
        kind: 'add_formalization',
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
    ],
  }
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
