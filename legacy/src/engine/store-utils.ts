import type { CanonicalStore, EntityRef, EntityType } from '../types'
import { STORE_KEY, createEntityRef } from '../types/canonical'

export function getStoreRecord<T extends EntityType>(
  store: CanonicalStore,
  type: T,
): CanonicalStore[(typeof STORE_KEY)[T]] {
  return store[STORE_KEY[type]]
}

export function getEntity<T extends EntityType>(
  store: CanonicalStore,
  ref: EntityRef & { type: T },
): CanonicalStore[(typeof STORE_KEY)[T]][string] | undefined {
  return getStoreRecord(store, ref.type)[ref.id] as CanonicalStore[(typeof STORE_KEY)[T]][string] | undefined
}

export function hasEntity(store: CanonicalStore, ref: EntityRef): boolean {
  return getEntity(store, ref) !== undefined
}

export function setEntity<T extends EntityType>(
  store: CanonicalStore,
  type: T,
  entity: CanonicalStore[(typeof STORE_KEY)[T]][string],
): CanonicalStore {
  return {
    ...store,
    [STORE_KEY[type]]: {
      ...store[STORE_KEY[type]],
      [entity.id]: entity,
    },
  }
}

export function deleteEntity(
  store: CanonicalStore,
  ref: EntityRef,
): CanonicalStore {
  const record = getStoreRecord(store, ref.type)
  if (!(ref.id in record)) {
    return store
  }

  const { [ref.id]: _deleted, ...rest } = record
  return {
    ...store,
    [STORE_KEY[ref.type]]: rest,
  }
}

export function findEntityRefById(store: CanonicalStore, id: string): EntityRef | null {
  for (const [type, key] of Object.entries(STORE_KEY) as Array<
    [EntityType, keyof CanonicalStore]
  >) {
    if (id in store[key]) {
      return createEntityRef(type, id)
    }
  }

  return null
}

export function listEntities(
  store: CanonicalStore,
): Array<{ ref: EntityRef; entity: unknown }> {
  const entities: Array<{ ref: EntityRef; entity: unknown }> = []

  for (const [type, key] of Object.entries(STORE_KEY) as Array<
    [EntityType, keyof CanonicalStore]
  >) {
    for (const entity of Object.values(store[key])) {
      entities.push({
        ref: createEntityRef(type, entity.id),
        entity,
      })
    }
  }

  return entities
}
