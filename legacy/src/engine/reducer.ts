import { compare, type Operation } from 'fast-json-patch'

import type { CanonicalStore, EntityRef, EntityType, StaleMarker } from '../types'
import { canonicalStoreSchema } from '../types/schemas'
import { createEntityRef, refKey } from '../types/canonical'

import type {
  AddEntityCommand,
  Command,
  DeleteEntityCommand,
  EntityFor,
  UpdateEntityCommand,
} from './commands'
import { parseCrudCommandKind } from './commands'
import { generateEntityId } from './id-generator'
import { findEntityRefById, getEntity, getStoreRecord } from './store-utils'

export class CommandError extends Error {
  readonly reason: 'validation_failed' | 'error'

  constructor(message: string, reason: 'validation_failed' | 'error' = 'validation_failed') {
    super(message)
    this.name = 'CommandError'
    this.reason = reason
  }
}

export interface ReduceResult {
  newStore: CanonicalStore
  patches: ReadonlyArray<Operation>
  inversePatches: ReadonlyArray<Operation>
}

function cloneStore(store: CanonicalStore): CanonicalStore {
  return structuredClone(store)
}

function appendStaleMarker(
  store: CanonicalStore,
  target: EntityRef,
  reason: string,
): CanonicalStore {
  const nextStore = cloneStore(store)
  const entity = getEntity(nextStore, target)
  if (!entity) {
    throw new CommandError(`Cannot mark stale for missing entity ${target.id}.`)
  }

  const marker: StaleMarker = {
    reason,
    stale_since: new Date().toISOString(),
    caused_by: target,
  }
  const staleMarkers = entity.stale_markers ?? []
  const duplicate = staleMarkers.some((candidate) => refKey(candidate.caused_by) === refKey(target))
  if (!duplicate) {
    entity.stale_markers = [...staleMarkers, marker]
  }
  return nextStore
}

function removeStaleMarker(store: CanonicalStore, target: EntityRef): CanonicalStore {
  const nextStore = cloneStore(store)
  const entity = getEntity(nextStore, target)
  if (!entity) {
    throw new CommandError(`Cannot clear stale for missing entity ${target.id}.`)
  }

  const staleMarkers = (entity.stale_markers ?? []).filter(
    (marker) => refKey(marker.caused_by) !== refKey(target),
  )
  if (staleMarkers.length > 0) {
    entity.stale_markers = staleMarkers
  } else {
    delete entity.stale_markers
  }
  return nextStore
}

function reduceCrudCommand(store: CanonicalStore, command: Command): CanonicalStore {
  const descriptor = parseCrudCommandKind(command.kind)
  if (!descriptor) {
    throw new CommandError(`Unsupported command kind ${command.kind}.`)
  }

  const nextStore = cloneStore(store)
  const record = getStoreRecord(nextStore, descriptor.entityType)

  if (descriptor.operation === 'add') {
    const addCommand = command as AddEntityCommand<EntityType>
    const id = addCommand.id ?? generateEntityId(descriptor.entityType)
    if (id in record) {
      throw new CommandError(`Entity ${id} already exists.`)
    }
    record[id] = { ...addCommand.payload, id } as EntityFor<EntityType>
    return nextStore
  }

  if (descriptor.operation === 'update') {
    const updateCommand = command as UpdateEntityCommand<EntityType>
    const existing = record[updateCommand.payload.id]
    if (!existing) {
      throw new CommandError(`Entity ${updateCommand.payload.id} does not exist.`)
    }
    record[updateCommand.payload.id] = {
      ...existing,
      ...updateCommand.payload,
      id: updateCommand.payload.id,
    } as EntityFor<EntityType>
    return nextStore
  }

  const deleteCommand = command as DeleteEntityCommand<EntityType>
  if (!(deleteCommand.payload.id in record)) {
    throw new CommandError(`Entity ${deleteCommand.payload.id} does not exist.`)
  }
  delete record[deleteCommand.payload.id]
  return nextStore
}

function reduceBatch(store: CanonicalStore, command: Extract<Command, { kind: 'batch' }>): CanonicalStore {
  return command.commands.reduce((current, nested) => reduceStore(current, nested), store)
}

export function reduceStore(store: CanonicalStore, command: Command): CanonicalStore {
  if (command.kind === 'batch') {
    return reduceBatch(store, command)
  }

  if (parseCrudCommandKind(command.kind)) {
    return reduceCrudCommand(store, command)
  }

  switch (command.kind) {
    case 'update_payoff': {
      const nextStore = cloneStore(store)
      const node = nextStore.nodes[command.payload.node_id]
      if (!node) {
        throw new CommandError(`Node ${command.payload.node_id} does not exist.`)
      }
      node.terminal_payoffs = {
        ...(node.terminal_payoffs ?? {}),
        [command.payload.player_id]: command.payload.value,
      }
      return nextStore
    }
    case 'update_normal_form_payoff': {
      const nextStore = cloneStore(store)
      const formalization = nextStore.formalizations[command.payload.formalization_id]
      if (!formalization) {
        throw new CommandError(`Formalization ${command.payload.formalization_id} does not exist.`)
      }
      if (formalization.kind !== 'normal_form') {
        throw new CommandError(
          `Formalization ${command.payload.formalization_id} is not normal-form.`,
        )
      }
      const cell = formalization.payoff_cells[command.payload.cell_index]
      if (!cell) {
        const { row_strategy: rowStrategy, col_strategy: colStrategy } = command.payload
        if (!rowStrategy || !colStrategy) {
          throw new CommandError(`Cell index ${command.payload.cell_index} out of bounds.`)
        }

        const playerIds = Object.keys(formalization.strategies)
        if (playerIds.length < 2) {
          throw new CommandError('Normal-form formalization must have two players before editing payoffs.')
        }

        const rowPlayerId = playerIds[0]!
        const colPlayerId = playerIds[1]!

        formalization.payoff_cells = [
          ...formalization.payoff_cells,
          {
            strategy_profile: {
              [rowPlayerId]: rowStrategy,
              [colPlayerId]: colStrategy,
            },
            payoffs: {
              [command.payload.player_id]: command.payload.value,
            },
          },
        ]
        return nextStore
      }
      formalization.payoff_cells = formalization.payoff_cells.map((c, i) =>
        i === command.payload.cell_index
          ? { ...c, payoffs: { ...c.payoffs, [command.payload.player_id]: command.payload.value } }
          : c,
      )
      return nextStore
    }
    case 'attach_player_to_game': {
      const nextStore = cloneStore(store)
      const game = nextStore.games[command.payload.game_id]
      if (!game) {
        throw new CommandError(`Game ${command.payload.game_id} does not exist.`)
      }
      if (!(command.payload.player_id in nextStore.players)) {
        throw new CommandError(`Player ${command.payload.player_id} does not exist.`)
      }
      if (!game.players.includes(command.payload.player_id)) {
        game.players = [...game.players, command.payload.player_id]
      }
      return nextStore
    }
    case 'attach_formalization_to_game': {
      const nextStore = cloneStore(store)
      const game = nextStore.games[command.payload.game_id]
      if (!game) {
        throw new CommandError(`Game ${command.payload.game_id} does not exist.`)
      }
      if (!(command.payload.formalization_id in nextStore.formalizations)) {
        throw new CommandError(`Formalization ${command.payload.formalization_id} does not exist.`)
      }
      if (!game.formalizations.includes(command.payload.formalization_id)) {
        game.formalizations = [...game.formalizations, command.payload.formalization_id]
      }
      return nextStore
    }
    case 'mark_stale': {
      const target = findEntityRefById(store, command.payload.id)
      if (!target) {
        throw new CommandError(`Entity ${command.payload.id} does not exist.`)
      }
      return appendStaleMarker(store, target, command.payload.reason)
    }
    case 'clear_stale': {
      const target = findEntityRefById(store, command.payload.id)
      if (!target) {
        throw new CommandError(`Entity ${command.payload.id} does not exist.`)
      }
      return removeStaleMarker(store, target)
    }
    case 'remove_player_from_game': {
      const nextStore = cloneStore(store)
      const game = nextStore.games[command.payload.game_id]
      if (!game) {
        throw new CommandError(`Game ${command.payload.game_id} does not exist.`)
      }
      game.players = game.players.filter((playerId) => playerId !== command.payload.player_id)
      return nextStore
    }
    case 'trigger_revalidation': {
      const {
        trigger_condition,
        source_phase,
        target_phases,
        entity_refs,
        description,
        pass_number,
      } = command.payload
      const id = generateEntityId('revalidation_event')
      const event: import('../types/evidence').RevalidationEvent = {
        id,
        trigger_condition,
        triggered_at: new Date().toISOString(),
        source_phase,
        target_phases,
        description,
        entity_refs,
        resolution: 'pending' as const,
        pass_number,
      }
      const nextStore = cloneStore(store)
      return {
        ...nextStore,
        revalidation_events: { ...nextStore.revalidation_events, [id]: event },
      }
    }
    case 'apply_cascade_effect':
    case 'promote_play_result':
      throw new CommandError(`Command kind ${command.kind} is not implemented yet.`)
  }

  throw new CommandError(`Unsupported command kind ${JSON.stringify(command)}.`)
}

export function reduce(
  store: CanonicalStore,
  command: Command,
): ReduceResult {
  const newStore = reduceStore(store, command)
  const validation = canonicalStoreSchema.safeParse(newStore)
  if (!validation.success) {
    throw new CommandError(validation.error.issues.map((issue) => issue.message).join('; '))
  }

  return {
    newStore,
    patches: compare(store, newStore),
    inversePatches: compare(newStore, store),
  }
}
