import { applyPatch, compare, type Operation } from 'fast-json-patch'

import type { CanonicalStore, EntityRef, EntityType } from '../types'
import { createEntityRef } from '../types/canonical'

import type { Command } from './commands'
import { isDeleteCommand } from './commands'
import { computeImpact, expandCascade } from './cascade'
import {
  getCanonicalRevisionSync,
  incrementRevisionSync,
  persistEventSync,
} from './event-persistence'
import { createEventLog, type EventLog, type ModelEvent } from './events'
import { validateStoreInvariants } from './integrity'
import { buildInverseIndex, type InverseIndex } from './inverse-index'
import { reduce, reduceStore, CommandError } from './reducer'
import { clearStale, propagateStale } from './stale'
import { findEntityRefById } from './store-utils'

export type DispatchResult =
  | {
      status: 'committed'
      event: ModelEvent
      new_cursor: number
      store: CanonicalStore
      event_log: EventLog
      inverse_index: InverseIndex
    }
  | {
      status: 'dry_run'
      event: ModelEvent
      impact_report?: import('./integrity').ImpactReport
      store: CanonicalStore
      event_log: EventLog
      inverse_index: InverseIndex
    }
  | {
      status: 'rejected'
      reason: 'validation_failed' | 'revision_conflict' | 'invariant_violated' | 'error'
      errors: string[]
      revision_diff?: { expected: number; actual: number }
    }

interface StaleCommandRoot {
  kind: 'mark_stale' | 'clear_stale'
  target: EntityRef
  reason?: string
}

function createModelEvent(
  command: Command,
  patches: ReadonlyArray<Operation>,
  inversePatches: ReadonlyArray<Operation>,
  integrityActions: ReadonlyArray<import('./integrity').IntegrityAction>,
  source: ModelEvent['source'],
  metadata?: Record<string, unknown>,
): ModelEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    command,
    patches,
    inverse_patches: inversePatches,
    integrity_actions: integrityActions,
    source,
    metadata,
  }
}

function applyPatches(store: CanonicalStore, patches: ReadonlyArray<Operation>): CanonicalStore {
  return applyPatch(structuredClone(store), patches as Operation[], true, true).newDocument
}

function retryPendingPersistence(eventLog: EventLog): EventLog {
  let nextRevision = eventLog.persisted_revision
  const remaining: ModelEvent[] = []
  let lastError = eventLog.last_persist_error

  for (const event of eventLog.pending_persisted_events) {
    try {
      persistEventSync(event, eventLog.analysis_id)
      nextRevision = incrementRevisionSync(eventLog.analysis_id, event.id)
      lastError = undefined
    } catch (error) {
      remaining.push(event)
      lastError = error instanceof Error ? error.message : 'Failed to persist event.'
    }
  }

  return {
    ...eventLog,
    persisted_revision: nextRevision,
    pending_persisted_events: remaining,
    last_persist_error: lastError,
  }
}

function preprocessCommand(
  store: CanonicalStore,
  command: Command,
): { command: Command; impactReport?: import('./integrity').ImpactReport } {
  if (command.kind === 'batch') {
    let nextStore = store
    const commands: Command[] = []
    let impactReport: import('./integrity').ImpactReport | undefined

    for (const nested of command.commands) {
      const result = preprocessCommand(nextStore, nested)
      commands.push(result.command)
      impactReport ??= result.impactReport
      nextStore = reduceStore(nextStore, result.command)
    }

    return {
      command: {
        ...command,
        commands,
      },
      impactReport,
    }
  }

  if (!isDeleteCommand(command)) {
    return { command }
  }

  const target = createEntityRef(
    command.kind.slice('delete_'.length) as EntityType,
    command.payload.id,
  )
  const index = buildInverseIndex(store)
  const impactReport = computeImpact(store, index, target)

  if (impactReport.proposed_actions.some((action) => action.kind === 'block')) {
    return { command, impactReport }
  }

  return {
    command: expandCascade(store, index, command),
    impactReport,
  }
}

function collectStaleRoots(store: CanonicalStore, command: Command): StaleCommandRoot[] {
  if (command.kind === 'batch') {
    return command.commands.flatMap((nested) => collectStaleRoots(store, nested))
  }

  if (command.kind !== 'mark_stale' && command.kind !== 'clear_stale') {
    return []
  }

  const target = findEntityRefById(store, command.payload.id)
  return target
    ? [
        {
          kind: command.kind,
          target,
          reason: command.kind === 'mark_stale' ? command.payload.reason : undefined,
        },
      ]
    : []
}

function applyStaleEffects(
  store: CanonicalStore,
  command: Command,
): CanonicalStore {
  let nextStore = store
  for (const root of collectStaleRoots(store, command)) {
    const index = buildInverseIndex(nextStore)
    if (root.kind === 'mark_stale') {
      nextStore = propagateStale(nextStore, index, root.target, root.reason ?? 'Marked stale').store
      continue
    }
    nextStore = clearStale(nextStore, index, root.target).store
  }
  return nextStore
}

export function dispatch(
  store: CanonicalStore,
  eventLog: EventLog,
  command: Command,
  opts?: { dryRun?: boolean; source?: ModelEvent['source'] },
): DispatchResult {
  const hydratedEventLog = retryPendingPersistence(eventLog)
  const actualRevision = hydratedEventLog.persisted_revision ?? hydratedEventLog.cursor
  if (
    typeof command.base_revision === 'number' &&
    command.base_revision !== actualRevision
  ) {
    return {
      status: 'rejected',
      reason: 'revision_conflict',
      errors: ['Command base_revision does not match the current persisted revision.'],
      revision_diff: {
        expected: command.base_revision,
        actual: actualRevision,
      },
    }
  }

  try {
    const { command: effectiveCommand, impactReport } = preprocessCommand(store, command)
    if (impactReport?.proposed_actions.some((action) => action.kind === 'block')) {
      return {
        status: 'rejected',
        reason: 'invariant_violated',
        errors: impactReport.proposed_actions
          .filter((action): action is Extract<typeof action, { kind: 'block' }> => action.kind === 'block')
          .map((action) => action.reason),
      }
    }

    const reduced = reduce(store, effectiveCommand)
    const staleAppliedStore = applyStaleEffects(reduced.newStore, effectiveCommand)
    const invariantResult = validateStoreInvariants(staleAppliedStore)
    if (invariantResult.errors.length > 0) {
      return {
        status: 'rejected',
        reason: 'invariant_violated',
        errors: invariantResult.errors,
      }
    }

    const patches = compare(store, staleAppliedStore)
    const inversePatches = compare(staleAppliedStore, store)
    const inverseIndex = buildInverseIndex(staleAppliedStore)
    const event = createModelEvent(
      effectiveCommand,
      patches,
      inversePatches,
      impactReport?.proposed_actions ?? [],
      opts?.source ?? 'user',
      invariantResult.warnings.length > 0
        ? { integrity_warnings: invariantResult.warnings }
        : undefined,
    )

    if (opts?.dryRun) {
      return {
        status: 'dry_run',
        event,
        impact_report: impactReport,
        store: staleAppliedStore,
        event_log: hydratedEventLog,
        inverse_index: inverseIndex,
      }
    }

    const truncatedEvents = hydratedEventLog.events.slice(0, hydratedEventLog.cursor)
    let nextEventLog: EventLog = {
      ...hydratedEventLog,
      events: [...truncatedEvents, event],
      cursor: truncatedEvents.length + 1,
    }

    try {
      persistEventSync(event, nextEventLog.analysis_id)
      nextEventLog = {
        ...nextEventLog,
        persisted_revision: incrementRevisionSync(nextEventLog.analysis_id, event.id),
        last_persist_error: undefined,
      }
    } catch (error) {
      nextEventLog = {
        ...nextEventLog,
        pending_persisted_events: [...nextEventLog.pending_persisted_events, event],
        last_persist_error:
          error instanceof Error ? error.message : 'Failed to persist canonical event.',
      }
    }

    return {
      status: 'committed',
      event,
      new_cursor: nextEventLog.cursor,
      store: staleAppliedStore,
      event_log: nextEventLog,
      inverse_index: inverseIndex,
    }
  } catch (error) {
    if (error instanceof CommandError) {
      return {
        status: 'rejected',
        reason: error.reason,
        errors: [error.message],
      }
    }

    return {
      status: 'rejected',
      reason: 'error',
      errors: [error instanceof Error ? error.message : 'Unexpected dispatch error.'],
    }
  }
}

export function undo(
  store: CanonicalStore,
  eventLog: EventLog,
): { store: CanonicalStore; eventLog: EventLog } | null {
  if (eventLog.cursor === 0) {
    return null
  }

  const event = eventLog.events[eventLog.cursor - 1]
  const nextStore = applyPatches(store, event.inverse_patches)
  return {
    store: nextStore,
    eventLog: {
      ...eventLog,
      cursor: eventLog.cursor - 1,
    },
  }
}

export function redo(
  store: CanonicalStore,
  eventLog: EventLog,
): { store: CanonicalStore; eventLog: EventLog } | null {
  if (eventLog.cursor >= eventLog.events.length) {
    return null
  }

  const event = eventLog.events[eventLog.cursor]
  const nextStore = applyPatches(store, event.patches)
  return {
    store: nextStore,
    eventLog: {
      ...eventLog,
      cursor: eventLog.cursor + 1,
    },
  }
}

export { createEventLog }

