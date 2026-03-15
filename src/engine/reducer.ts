import { compare, type Operation } from 'fast-json-patch'

import type { CanonicalStore, EntityRef, EntityType, StaleMarker } from '../types'
import { canonicalStoreSchema } from '../types/schemas'
import { createEntityRef } from '../types/canonical'

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
  const duplicate = staleMarkers.some(
    (candidate) => candidate.reason === reason && candidate.caused_by.id === target.id,
  )
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
    (marker) => marker.caused_by.id !== target.id,
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
