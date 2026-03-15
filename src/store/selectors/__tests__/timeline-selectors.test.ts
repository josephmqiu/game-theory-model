import { describe, it, expect } from 'vitest'

import { useTimelineEntries } from '../timeline-selectors'
import { emptyCanonicalStore } from '../../../types/canonical'
import { createEventLog, type EventLog, type ModelEvent } from '../../../engine/events'

function makeEvent(overrides: Partial<ModelEvent> = {}): ModelEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: '2026-03-14T10:00:00Z',
    command: { kind: 'add_game', payload: { name: 'Test', description: 'A game', semantic_labels: [], players: [], status: 'active', formalizations: [], coupling_links: [], key_assumptions: [], created_at: '2026-03-14T10:00:00Z', updated_at: '2026-03-14T10:00:00Z' } },
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

describe('useTimelineEntries', () => {
  it('returns empty array for empty event log', () => {
    const canonical = emptyCanonicalStore()
    const eventLog = createEventLog('test')

    const result = useTimelineEntries(canonical, eventLog)

    expect(result).toEqual([])
  })

  it('produces timeline entries from model events', () => {
    const canonical = emptyCanonicalStore()
    const event = makeEvent()
    const eventLog = makeEventLog([event])

    const result = useTimelineEntries(canonical, eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: event.id,
      kind: 'model_time',
      timestamp: event.timestamp,
    })
    expect(result[0]!.label).toContain('game')
  })

  it('classifies evidence entity changes as evidence_update', () => {
    const canonical = emptyCanonicalStore()
    const event = makeEvent({
      command: {
        kind: 'add_assumption',
        payload: {
          statement: 'Test assumption',
          type: 'structural',
          sensitivity: 'medium',
          confidence: 0.8,
        },
      },
      patches: [{ op: 'add', path: '/assumptions/a1', value: {} }],
      inverse_patches: [{ op: 'remove', path: '/assumptions/a1' }],
    })
    const eventLog = makeEventLog([event])

    const result = useTimelineEntries(canonical, eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('evidence_update')
  })

  it('classifies mark_stale as evidence_update', () => {
    const canonical = emptyCanonicalStore()
    const event = makeEvent({
      command: {
        kind: 'mark_stale',
        payload: { id: 'a1', reason: 'Outdated info' },
      },
    })
    const eventLog = makeEventLog([event])

    const result = useTimelineEntries(canonical, eventLog)

    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('evidence_update')
  })

  it('only includes events up to cursor', () => {
    const canonical = emptyCanonicalStore()
    const events = [makeEvent(), makeEvent(), makeEvent()]
    const eventLog = {
      ...makeEventLog(events),
      cursor: 2,
    }

    const result = useTimelineEntries(canonical, eventLog)

    expect(result).toHaveLength(2)
  })
})
