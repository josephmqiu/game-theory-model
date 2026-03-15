import { describe, it, expect } from 'vitest'

import { useDiffEntries } from '../diff-selectors'
import { createEventLog, type EventLog, type ModelEvent } from '../../../engine/events'

function makeEvent(overrides: Partial<ModelEvent> = {}): ModelEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: '2026-03-14T10:00:00Z',
    command: {
      kind: 'add_game',
      payload: {
        name: 'Test',
        description: 'A game',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T10:00:00Z',
        updated_at: '2026-03-14T10:00:00Z',
      },
    },
    patches: [{ op: 'add', path: '/games/g1', value: {} }],
    inverse_patches: [{ op: 'remove', path: '/games/g1' }],
    integrity_actions: [],
    source: 'user',
    ...overrides,
  }
}

function makeEventLog(events: ModelEvent[]): EventLog {
  const log = createEventLog('test-analysis')
  return {
    ...log,
    events,
    cursor: events.length,
  }
}

describe('useDiffEntries', () => {
  it('returns empty array for empty event log', () => {
    const eventLog = createEventLog('test')
    const result = useDiffEntries(eventLog)
    expect(result).toEqual([])
  })

  it('produces diff entries from add commands', () => {
    const event = makeEvent()
    const eventLog = makeEventLog([event])

    const result = useDiffEntries(eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.change_type).toBe('created')
    expect(result[0]!.entity_ref).toEqual({ type: 'game', id: 'g1' })
    expect(result[0]!.root_cause_event_id).toBe(event.id)
  })

  it('extracts field changes from update patches', () => {
    const event = makeEvent({
      command: {
        kind: 'update_game',
        payload: { id: 'g1', name: 'Updated Name' },
      },
      patches: [
        { op: 'replace', path: '/games/g1/name', value: 'Updated Name' },
        { op: 'replace', path: '/games/g1/updated_at', value: '2026-03-14T11:00:00Z' },
      ],
    })
    const eventLog = makeEventLog([event])

    const result = useDiffEntries(eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.change_type).toBe('updated')
    expect(result[0]!.field_changes).toHaveLength(2)
    expect(result[0]!.field_changes).toContainEqual({
      field: 'name',
      operation: 'replace',
    })
  })

  it('classifies delete commands correctly', () => {
    const event = makeEvent({
      command: { kind: 'delete_game', payload: { id: 'g1' } },
      patches: [{ op: 'remove', path: '/games/g1' }],
    })
    const eventLog = makeEventLog([event])

    const result = useDiffEntries(eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.change_type).toBe('deleted')
  })

  it('classifies mark_stale correctly', () => {
    const event = makeEvent({
      command: { kind: 'mark_stale', payload: { id: 'a1', reason: 'Outdated' } },
      patches: [{ op: 'replace', path: '/assumptions/a1/stale_markers', value: [] }],
    })
    const eventLog = makeEventLog([event])

    const result = useDiffEntries(eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.change_type).toBe('marked_stale')
  })

  it('only processes events up to cursor', () => {
    const events = [makeEvent(), makeEvent(), makeEvent()]
    const eventLog = {
      ...makeEventLog(events),
      cursor: 1,
    }

    const result = useDiffEntries(eventLog)

    expect(result).toHaveLength(1)
  })
})
