import type { CanonicalStore, EntityRef, EntityType } from '../types'
import { refKey } from '../types/canonical'

import { REFERENCE_SCHEMA } from './integrity'
import {
  addDependent,
  allowsTargetType,
  collectDeclaredReferences,
  createDependentSet,
} from './reference-utils'
import { getEntity, listEntities } from './store-utils'

export type InverseIndex = Record<string, ReadonlyArray<EntityRef>>

export function buildInverseIndex(store: CanonicalStore): InverseIndex {
  const mutable = new Map<string, Map<string, EntityRef>>()

  for (const { ref, entity } of listEntities(store)) {
    for (const reference of collectDeclaredReferences(
      ref.type,
      ref.id,
      entity,
      REFERENCE_SCHEMA[ref.type],
    )) {
      if (!allowsTargetType(reference.declaration, reference.target_type)) {
        continue
      }

      const targetKey = refKey({ type: reference.target_type, id: reference.ref_id })
      const dependents = mutable.get(targetKey) ?? createDependentSet()
      addDependent(dependents, ref)
      mutable.set(targetKey, dependents)
    }
  }

  return Object.fromEntries(
    [...mutable.entries()].map(([key, dependents]) => [key, [...dependents.values()]]),
  )
}

export function refreshInverseIndexForEntities(
  index: InverseIndex,
  previousStore: CanonicalStore,
  nextStore: CanonicalStore,
  entities: ReadonlyArray<EntityRef>,
): InverseIndex {
  const mutable = new Map<string, Map<string, EntityRef>>(
    Object.entries(index).map(([key, dependents]) => [
      key,
      new Map(dependents.map((dependent) => [refKey(dependent), dependent])),
    ]),
  )

  for (const entityRef of entities) {
    for (const dependents of mutable.values()) {
      dependents.delete(refKey(entityRef))
    }

    const entity = getEntity(nextStore, entityRef)
    if (!entity) {
      continue
    }

    for (const reference of collectDeclaredReferences(
      entityRef.type,
      entityRef.id,
      entity,
      REFERENCE_SCHEMA[entityRef.type as EntityType],
    )) {
      if (!allowsTargetType(reference.declaration, reference.target_type)) {
        continue
      }

      const targetKey = refKey({ type: reference.target_type, id: reference.ref_id })
      const dependents = mutable.get(targetKey) ?? createDependentSet()
      addDependent(dependents, entityRef)
      mutable.set(targetKey, dependents)
    }
  }

  return Object.fromEntries(
    [...mutable.entries()].map(([key, dependents]) => [key, [...dependents.values()]]),
  )
}

