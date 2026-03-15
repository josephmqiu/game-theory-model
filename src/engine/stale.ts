import type { CanonicalStore, EntityRef, StaleMarker } from '../types'
import { refKey } from '../types/canonical'

import type { InverseIndex } from './inverse-index'
import { getEntity, setEntity } from './store-utils'

function withStaleMarker(
  entity: { stale_markers?: ReadonlyArray<StaleMarker> },
  marker: StaleMarker,
): typeof entity {
  const existing = entity.stale_markers ?? []
  const duplicate = existing.some(
    (candidate) =>
      candidate.reason === marker.reason &&
      refKey(candidate.caused_by) === refKey(marker.caused_by),
  )
  if (duplicate) {
    return entity
  }

  return {
    ...entity,
    stale_markers: [...existing, marker],
  }
}

function withoutCause(
  entity: { stale_markers?: ReadonlyArray<StaleMarker> },
  root: EntityRef,
): typeof entity {
  const nextMarkers = (entity.stale_markers ?? []).filter(
    (marker) => refKey(marker.caused_by) !== refKey(root),
  )

  if (nextMarkers.length === 0) {
    const { stale_markers: _staleMarkers, ...rest } = entity
    return rest
  }

  return {
    ...entity,
    stale_markers: nextMarkers,
  }
}

export function propagateStale(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
  reason: string,
): { store: CanonicalStore; affected: EntityRef[] } {
  const affected: EntityRef[] = []
  const visited = new Set<string>()
  const queue: EntityRef[] = [target]
  let nextStore = store
  const rootMarker: StaleMarker = {
    reason,
    stale_since: new Date().toISOString(),
    caused_by: target,
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentKey = refKey(current)
    if (visited.has(currentKey)) {
      continue
    }
    visited.add(currentKey)

    const entity = getEntity(nextStore, current)
    if (!entity) {
      continue
    }

    const marker =
      currentKey === refKey(target)
        ? rootMarker
        : {
            reason: `Dependency ${target.type}:${target.id} is stale`,
            stale_since: rootMarker.stale_since,
            caused_by: target,
          }

    const updated = withStaleMarker(entity, marker)
    if (updated !== entity) {
      nextStore = setEntity(nextStore, current.type, updated as never)
      affected.push(current)
    }

    for (const dependent of index[currentKey] ?? []) {
      queue.push(dependent)
    }
  }

  return { store: nextStore, affected }
}

export function clearStale(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
): { store: CanonicalStore; cleared: EntityRef[] } {
  const cleared: EntityRef[] = []
  const queue: EntityRef[] = [target]
  const visited = new Set<string>()
  let nextStore = store

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentKey = refKey(current)
    if (visited.has(currentKey)) {
      continue
    }
    visited.add(currentKey)

    const entity = getEntity(nextStore, current)
    if (!entity) {
      continue
    }

    const beforeCount = entity.stale_markers?.length ?? 0
    const updated = withoutCause(entity, target)
    const afterCount = updated.stale_markers?.length ?? 0
    if (beforeCount !== afterCount) {
      nextStore = setEntity(nextStore, current.type, updated as never)
      cleared.push(current)
    }

    for (const dependent of index[currentKey] ?? []) {
      queue.push(dependent)
    }
  }

  return { store: nextStore, cleared }
}
