import type {
  EntityType,
  GameNode,
  StrategicGame,
  Player,
  GameEdge,
  Source,
  Observation,
  Claim,
  Inference,
  Assumption,
  Contradiction,
  DerivationEdge,
  LatentFactor,
  CrossGameLink,
  Scenario,
  Playbook,
  Formalization,
} from '../types'
import type { EstimateValue } from '../types/estimates'
import { entityTypes } from '../types/canonical'

export interface BaseCommand {
  base_revision?: number
}

export interface EntityTypeMap {
  game: StrategicGame
  formalization: Formalization
  player: Player
  game_node: GameNode
  game_edge: GameEdge
  source: Source
  observation: Observation
  claim: Claim
  inference: Inference
  assumption: Assumption
  contradiction: Contradiction
  derivation: DerivationEdge
  latent_factor: LatentFactor
  cross_game_link: CrossGameLink
  scenario: Scenario
  playbook: Playbook
}

export type EntityFor<T extends EntityType> = EntityTypeMap[T]

export type AddEntityCommand<T extends EntityType> = BaseCommand & {
  kind: `add_${T}`
  payload: Omit<EntityFor<T>, 'id'>
  id?: string
}

export type UpdateEntityCommand<T extends EntityType> = BaseCommand & {
  kind: `update_${T}`
  payload: { id: string } & Partial<EntityFor<T>>
}

export type DeleteEntityCommand<T extends EntityType> = BaseCommand & {
  kind: `delete_${T}`
  payload: { id: string }
}

export type CrudCommand = {
  [T in EntityType]:
    | AddEntityCommand<T>
    | UpdateEntityCommand<T>
    | DeleteEntityCommand<T>
}[EntityType]

export type StructuralCommand =
  | (BaseCommand & {
      kind: 'update_payoff'
      payload: { node_id: string; player_id: string; value: EstimateValue }
    })
  | (BaseCommand & {
      kind: 'update_normal_form_payoff'
      payload: {
        formalization_id: string
        cell_index: number
        player_id: string
        value: EstimateValue
        row_strategy?: string
        col_strategy?: string
      }
    })
  | (BaseCommand & {
      kind: 'attach_player_to_game'
      payload: { game_id: string; player_id: string }
    })
  | (BaseCommand & {
      kind: 'attach_formalization_to_game'
      payload: { game_id: string; formalization_id: string }
    })
  | (BaseCommand & {
      kind: 'mark_stale'
      payload: { id: string; reason: string }
    })
  | (BaseCommand & {
      kind: 'clear_stale'
      payload: { id: string }
    })
  | (BaseCommand & {
      kind: 'remove_player_from_game'
      payload: { game_id: string; player_id: string }
    })

export type DomainCommand =
  | (BaseCommand & {
      kind: 'apply_cascade_effect'
      payload: unknown
    })
  | (BaseCommand & {
      kind: 'promote_play_result'
      payload: unknown
    })

export type BatchCommand = BaseCommand & {
  kind: 'batch'
  commands: Command[]
  label: string
}

export type Command = CrudCommand | StructuralCommand | DomainCommand | BatchCommand

export type CommandKind = Command['kind']

type CrudKindDescriptor = {
  operation: 'add' | 'update' | 'delete'
  entityType: EntityType
}

export function parseCrudCommandKind(kind: string): CrudKindDescriptor | null {
  for (const operation of ['add', 'update', 'delete'] as const) {
    if (!kind.startsWith(`${operation}_`)) {
      continue
    }

    const candidate = kind.slice(operation.length + 1) as EntityType
    if (!entityTypes.includes(candidate)) {
      return null
    }

    return {
      operation,
      entityType: candidate,
    }
  }

  return null
}

export function isCrudCommand(command: Command): command is CrudCommand {
  return /^add_|^update_|^delete_/.test(command.kind)
}

export function isDeleteCommand(command: Command): command is DeleteEntityCommand<EntityType> {
  return command.kind.startsWith('delete_')
}
