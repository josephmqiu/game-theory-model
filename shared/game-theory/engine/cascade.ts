import type { CanonicalStore, EntityRef, EntityType } from '../types'
import { createEntityRef, refKey } from '../types/canonical'

import type { Command, DeleteEntityCommand, UpdateEntityCommand } from './commands'
import { REFERENCE_SCHEMA, type ImpactReport, type IntegrityAction } from './integrity'
import type { InverseIndex } from './inverse-index'
import {
  allowsTargetType,
  collectDeclaredReferences,
  collectFieldLeafValues,
  mutateFieldLeaves,
} from './reference-utils'
import { getEntity } from './store-utils'

function actionKey(action: IntegrityAction): string {
  switch (action.kind) {
    case 'block':
      return `block:${action.reason}`
    case 'cascade_delete':
      return `cascade_delete:${refKey(action.entity)}`
    case 'mark_stale':
      return `mark_stale:${refKey(action.entity)}:${refKey(action.caused_by)}`
    case 'remove_ref':
      return `remove_ref:${refKey(action.entity)}:${action.field}:${action.ref_id}`
  }
}

function addAction(
  actions: Map<string, IntegrityAction>,
  action: IntegrityAction,
): void {
  actions.set(actionKey(action), action)
}

function findMatchingDeclarations(
  holderType: EntityType,
  holderId: string,
  entity: unknown,
  target: EntityRef,
) {
  return collectDeclaredReferences(holderType, holderId, entity, REFERENCE_SCHEMA[holderType]).filter(
    (reference) =>
      allowsTargetType(reference.declaration, reference.target_type) &&
      reference.target_type === target.type &&
      reference.ref_id === target.id,
  )
}

function fieldWouldBeEmptyAfterRemovals(
  entity: unknown,
  field: string,
  removedIds: ReadonlySet<string>,
): boolean {
  for (const value of collectFieldLeafValues(entity, field)) {
    if (Array.isArray(value)) {
      if (value.filter((item) => typeof item === 'string' && !removedIds.has(item)).length === 0) {
        return true
      }
    }
  }

  return false
}

export function computeImpact(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
): ImpactReport {
  const directDependents = [...(index[refKey(target)] ?? [])]
  const transitiveDependents = new Map<string, EntityRef>()
  const actions = new Map<string, IntegrityAction>()
  const deleted = new Set<string>([refKey(target)])
  const queue: EntityRef[] = [target]
  const pendingRemovals = new Map<
    string,
    { dependent: EntityRef; field: string; removedRefs: Map<string, EntityRef> }
  >()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    for (const dependent of index[refKey(current)] ?? []) {
      const entity = getEntity(store, dependent)
      if (!entity) {
        continue
      }

      if (refKey(current) !== refKey(target)) {
        transitiveDependents.set(refKey(dependent), dependent)
      }

      for (const reference of findMatchingDeclarations(
        dependent.type,
        dependent.id,
        entity,
        current,
      )) {
        switch (reference.declaration.on_delete) {
          case 'block':
            addAction(actions, {
              kind: 'block',
              reason: `${dependent.type}:${dependent.id} blocks deletion of ${current.type}:${current.id}.`,
            })
            break
          case 'cascade_delete':
            if (!deleted.has(refKey(dependent))) {
              deleted.add(refKey(dependent))
              queue.push(dependent)
            }
            addAction(actions, { kind: 'cascade_delete', entity: dependent })
            break
          case 'mark_stale':
            addAction(actions, {
              kind: 'mark_stale',
              entity: dependent,
              reason: `Dependency ${current.type}:${current.id} was deleted`,
              caused_by: current,
            })
            break
          case 'remove_ref':
            addAction(actions, {
              kind: 'remove_ref',
              entity: dependent,
              field: reference.field,
              ref_id: current.id,
            })
            break
          case 'remove_ref_or_stale_if_empty': {
            addAction(actions, {
              kind: 'remove_ref',
              entity: dependent,
              field: reference.field,
              ref_id: current.id,
            })
            const removalKey = `${refKey(dependent)}|${reference.field}`
            const existing = pendingRemovals.get(removalKey) ?? {
              dependent,
              field: reference.field,
              removedRefs: new Map<string, EntityRef>(),
            }
            existing.removedRefs.set(refKey(current), current)
            pendingRemovals.set(removalKey, existing)
            break
          }
        }
      }
    }
  }

  for (const { dependent, field, removedRefs } of pendingRemovals.values()) {
    if (!dependent || deleted.has(refKey(dependent))) {
      continue
    }
    const entity = getEntity(store, dependent)
    if (!entity) {
      continue
    }
    if (
      fieldWouldBeEmptyAfterRemovals(
        entity,
        field,
        new Set([...removedRefs.values()].map((ref) => ref.id)),
      )
    ) {
      for (const removedRef of removedRefs.values()) {
        addAction(actions, {
          kind: 'mark_stale',
          entity: dependent,
          reason: `Required references removed from ${field}`,
          caused_by: removedRef,
        })
      }
    }
  }

  const filteredActions = [...actions.values()].filter((action) => {
    if (action.kind === 'remove_ref' || action.kind === 'mark_stale') {
      return !deleted.has(refKey(action.entity))
    }
    return true
  })

  const severity = filteredActions.some((action) => action.kind === 'cascade_delete')
    ? 'destructive'
    : filteredActions.some((action) => action.kind === 'mark_stale')
      ? 'warning'
      : 'safe'

  return {
    target,
    direct_dependents: directDependents,
    transitive_dependents: [...transitiveDependents.values()],
    proposed_actions: filteredActions,
    severity,
  }
}

function removeReferenceFromEntity(entity: unknown, field: string, refId: string): unknown {
  const clone = structuredClone(entity)
  mutateFieldLeaves(clone, field, (parent, key, value) => {
    if (Array.isArray(value)) {
      const nextValue = value.filter((item) => item !== refId)
      ;(parent as Record<string | number, unknown>)[key] = nextValue
      return
    }

    if (value === refId && !Array.isArray(parent)) {
      delete (parent as Record<string | number, unknown>)[key]
    }
  })

  return clone
}

function makeUpdateCommand(
  entity: EntityRef,
  nextEntity: Record<string, unknown>,
): Command {
  return {
    kind: `update_${entity.type}` as Command['kind'],
    payload: nextEntity as UpdateEntityCommand<EntityType>['payload'],
  } as Command
}

function makeDeleteCommand(entity: EntityRef): Command {
  return {
    kind: `delete_${entity.type}` as Command['kind'],
    payload: { id: entity.id },
  } as Command
}

export function expandCascadeFromImpact(
  store: CanonicalStore,
  deleteCommand: Command & { payload: { id: string } },
  impact: ImpactReport,
): Command {
  const targetType = deleteCommand.kind.slice('delete_'.length) as EntityType
  const target = createEntityRef(targetType, deleteCommand.payload.id)
  const mutatedEntities = new Map<string, { ref: EntityRef; entity: Record<string, unknown> }>()

  for (const action of impact.proposed_actions) {
    if (action.kind !== 'remove_ref') {
      continue
    }

    const existing =
      mutatedEntities.get(refKey(action.entity))?.entity ??
      (structuredClone(getEntity(store, action.entity) ?? {}) as Record<string, unknown>)
    const nextEntity = removeReferenceFromEntity(existing, action.field, action.ref_id) as Record<
      string,
      unknown
    >
    mutatedEntities.set(refKey(action.entity), {
      ref: action.entity,
      entity: nextEntity,
    })
  }

  const commands: Command[] = [deleteCommand]

  for (const action of impact.proposed_actions) {
    if (action.kind === 'cascade_delete') {
      commands.push(makeDeleteCommand(action.entity))
    }
  }

  for (const { ref, entity } of mutatedEntities.values()) {
    commands.push(makeUpdateCommand(ref, entity))
  }

  return {
    kind: 'batch',
    label: `Cascade delete ${target.type}:${target.id}`,
    commands,
  }
}

export function expandCascade(
  store: CanonicalStore,
  index: InverseIndex,
  deleteCommand: DeleteEntityCommand<EntityType>,
): Command {
  const targetType = deleteCommand.kind.slice('delete_'.length) as EntityType
  const target = createEntityRef(targetType, deleteCommand.payload.id)
  return expandCascadeFromImpact(store, deleteCommand as Command & { payload: { id: string } }, computeImpact(store, index, target))
}
