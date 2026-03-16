import { beforeEach, describe, expect, it } from 'vitest'

import { createSampleCanonicalStore } from '../test-support/sample-analysis'
import { queryEvents, resetPersistedEventStore } from './event-persistence'
import { dispatch, redo, undo, createEventLog } from './dispatch'
import { generateEntityId } from './id-generator'

describe('command spine dispatch', () => {
  beforeEach(() => {
    resetPersistedEventStore()
  })

  it('commits add, update, delete, undo, and redo through the event log', async () => {
    const initialStore = createSampleCanonicalStore()
    const initialLog = createEventLog('/analysis.gta.json')

    const addResult = dispatch(initialStore, initialLog, {
      kind: 'add_claim',
      payload: {
        statement: 'New claim',
        based_on: ['observation_1'],
        confidence: 0.5,
      },
    })

    expect(addResult.status).toBe('committed')
    if (addResult.status !== 'committed') {
      throw new Error('Expected add to commit.')
    }

    const addedClaimId = Object.keys(addResult.store.claims).find((id) => id !== 'claim_1')
    expect(addedClaimId).toMatch(/^claim_/)

    const updateResult = dispatch(addResult.store, addResult.event_log, {
      kind: 'update_claim',
      payload: {
        id: addedClaimId!,
        confidence: 0.9,
      },
    })

    expect(updateResult.status).toBe('committed')
    if (updateResult.status !== 'committed') {
      throw new Error('Expected update to commit.')
    }
    expect(updateResult.store.claims[addedClaimId!].confidence).toBe(0.9)
    expect(addResult.store.claims[addedClaimId!].confidence).toBe(0.5)

    const deleteResult = dispatch(updateResult.store, updateResult.event_log, {
      kind: 'delete_claim',
      payload: { id: addedClaimId! },
    })

    expect(deleteResult.status).toBe('committed')
    if (deleteResult.status !== 'committed') {
      throw new Error('Expected delete to commit.')
    }
    expect(deleteResult.store.claims[addedClaimId!]).toBeUndefined()

    const undone = undo(deleteResult.store, deleteResult.event_log)
    expect(undone?.store.claims[addedClaimId!]).toMatchObject({ confidence: 0.9 })

    const redone = undone ? redo(undone.store, undone.eventLog) : null
    expect(redone?.store.claims[addedClaimId!]).toBeUndefined()

    const events = await queryEvents('/analysis.gta.json')
    expect(events).toHaveLength(3)
  })

  it('treats batch commands as one atomic undo unit and truncates forward history after undo', () => {
    const store = createSampleCanonicalStore()
    const eventLog = createEventLog('/analysis.gta.json')

    const batchResult = dispatch(store, eventLog, {
      kind: 'batch',
      label: 'add three claims',
      commands: [
        {
          kind: 'add_claim',
          payload: {
            statement: 'Claim A',
            based_on: ['observation_1'],
            confidence: 0.4,
          },
        },
        {
          kind: 'add_claim',
          payload: {
            statement: 'Claim B',
            based_on: ['observation_1'],
            confidence: 0.5,
          },
        },
        {
          kind: 'add_claim',
          payload: {
            statement: 'Claim C',
            based_on: ['observation_1'],
            confidence: 0.6,
          },
        },
      ],
    })

    expect(batchResult.status).toBe('committed')
    if (batchResult.status !== 'committed') {
      throw new Error('Expected batch to commit.')
    }
    expect(Object.keys(batchResult.store.claims)).toHaveLength(4)

    const undone = undo(batchResult.store, batchResult.event_log)
    expect(Object.keys(undone?.store.claims ?? {})).toHaveLength(1)

    const branchResult = dispatch(undone!.store, undone!.eventLog, {
      kind: 'add_claim',
      payload: {
        statement: 'Claim D',
        based_on: ['observation_1'],
        confidence: 0.7,
      },
    })

    expect(branchResult.status).toBe('committed')
    if (branchResult.status !== 'committed') {
      throw new Error('Expected branch command to commit.')
    }
    expect(branchResult.event_log.events).toHaveLength(1)
    expect(branchResult.new_cursor).toBe(1)
  })

  it('supports dry-run previews and revision conflicts', () => {
    const store = createSampleCanonicalStore()
    const eventLog = createEventLog('/analysis.gta.json')

    const dryRun = dispatch(store, eventLog, {
      kind: 'add_claim',
      id: 'claim_preview',
      payload: {
        statement: 'Preview claim',
        based_on: ['observation_1'],
        confidence: 0.55,
      },
    }, { dryRun: true })

    expect(dryRun.status).toBe('dry_run')
    if (dryRun.status !== 'dry_run') {
      throw new Error('Expected dry-run result.')
    }
    expect(dryRun.event_log.cursor).toBe(0)
    expect(store).not.toEqual(dryRun.store)

    const committed = dispatch(store, eventLog, {
      kind: 'add_claim',
      id: 'claim_preview',
      payload: {
        statement: 'Preview claim',
        based_on: ['observation_1'],
        confidence: 0.55,
      },
    })

    expect(committed.status).toBe('committed')
    if (committed.status !== 'committed') {
      throw new Error('Expected committed result.')
    }
    expect(committed.event.patches).toEqual(dryRun.event.patches)
    expect(committed.event.command).toEqual(dryRun.event.command)

    const conflict = dispatch(committed.store, committed.event_log, {
      kind: 'add_claim',
      base_revision: 0,
      payload: {
        statement: 'Conflict claim',
        based_on: ['observation_1'],
        confidence: 0.25,
      },
    })

    expect(conflict).toMatchObject({
      status: 'rejected',
      reason: 'revision_conflict',
      revision_diff: {
        expected: 0,
        actual: 1,
      },
    })
  })

  it('rejects duplicate IDs and generates stable entity IDs', () => {
    const store = createSampleCanonicalStore()
    const eventLog = createEventLog('/analysis.gta.json')

    const duplicate = dispatch(store, eventLog, {
      kind: 'add_claim',
      id: 'claim_1',
      payload: {
        statement: 'Duplicate',
        based_on: ['observation_1'],
        confidence: 0.3,
      },
    })

    expect(duplicate).toMatchObject({
      status: 'rejected',
      reason: 'validation_failed',
    })

    expect(generateEntityId('claim')).toMatch(/^claim_[a-f0-9-]+$/)
  })

  it('persists the provided pass number on trigger_revalidation events', () => {
    const store = createSampleCanonicalStore()
    const eventLog = createEventLog('/analysis.gta.json')

    const result = dispatch(store, eventLog, {
      kind: 'trigger_revalidation',
      payload: {
        trigger_condition: 'objective_function_changed',
        source_phase: 4,
        target_phases: [3, 4],
        entity_refs: [{ type: 'game', id: 'game_1' }],
        description: 'Historical evidence changed the baseline framing.',
        pass_number: 3,
      },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') {
      throw new Error('Expected trigger_revalidation to commit.')
    }

    const createdEvent = Object.values(result.store.revalidation_events)[0]
    expect(createdEvent?.pass_number).toBe(3)
    expect(createdEvent?.trigger_condition).toBe('objective_function_changed')
  })
})
