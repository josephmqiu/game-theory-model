import type { EntityRef, EntityType } from '../types'

import { createEntityRef, refKey } from '../types/canonical'
import { inferEntityTypeFromId } from './id-generator'
import type { RefDeclaration } from './integrity'

type ObjectLike = Record<string, unknown> | unknown[]

export interface DeclaredReference {
  declaration: RefDeclaration
  holder: EntityRef
  field: string
  ref_id: string
  target_type: EntityType | null
}

function isObjectLike(value: unknown): value is ObjectLike {
  return typeof value === 'object' && value !== null
}

function walkFieldLeaves(
  current: unknown,
  segments: string[],
  visitor: (parent: ObjectLike, key: string | number, value: unknown) => void,
): void {
  if (segments.length === 0) {
    return
  }

  const [segment, ...rest] = segments

  if (segment === '*') {
    if (Array.isArray(current)) {
      current.forEach((value, index) => {
        if (rest.length === 0) {
          visitor(current, index, value)
          return
        }

        walkFieldLeaves(value, rest, visitor)
      })
      return
    }

    if (!isObjectLike(current)) {
      return
    }

    for (const [key, value] of Object.entries(current)) {
      if (rest.length === 0) {
        visitor(current, key, value)
        continue
      }

      walkFieldLeaves(value, rest, visitor)
    }
    return
  }

  if (!isObjectLike(current) || !(segment in current)) {
    return
  }

  const next = current[segment as keyof typeof current]
  if (rest.length === 0) {
    visitor(current, segment, next)
    return
  }

  walkFieldLeaves(next, rest, visitor)
}

export function collectFieldLeafValues(root: unknown, field: string): unknown[] {
  const values: unknown[] = []
  walkFieldLeaves(root, field.split('.'), (_parent, _key, value) => {
    values.push(value)
  })
  return values
}

export function mutateFieldLeaves(
  root: unknown,
  field: string,
  visitor: (parent: ObjectLike, key: string | number, value: unknown) => void,
): void {
  walkFieldLeaves(root, field.split('.'), visitor)
}

export function collectDeclaredReferences(
  holderType: EntityType,
  holderId: string,
  entity: unknown,
  declarations: ReadonlyArray<RefDeclaration>,
): DeclaredReference[] {
  const holder = createEntityRef(holderType, holderId)
  const references: DeclaredReference[] = []

  for (const declaration of declarations) {
    for (const value of collectFieldLeafValues(entity, declaration.field)) {
      if (typeof value === 'string') {
        references.push({
          declaration,
          holder,
          field: declaration.field,
          ref_id: value,
          target_type: inferEntityTypeFromId(value),
        })
        continue
      }

      if (Array.isArray(value)) {
        for (const nested of value) {
          if (typeof nested !== 'string') {
            continue
          }

          references.push({
            declaration,
            holder,
            field: declaration.field,
            ref_id: nested,
            target_type: inferEntityTypeFromId(nested),
          })
        }
      }
    }
  }

  return references
}

export function allowsTargetType(
  declaration: RefDeclaration,
  targetType: EntityType | null,
): targetType is EntityType {
  if (!targetType) {
    return false
  }

  return Array.isArray(declaration.target)
    ? declaration.target.includes(targetType)
    : declaration.target === targetType
}

export function createDependentSet() {
  return new Map<string, EntityRef>()
}

export function addDependent(
  targetMap: Map<string, EntityRef>,
  dependent: EntityRef,
): void {
  targetMap.set(refKey(dependent), dependent)
}

