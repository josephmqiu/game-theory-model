import { describe, it, expect } from 'vitest'

import { createCoordinationBus } from '../bus'

function makeCorrelationId(): string {
  return `test-${Math.random().toString(36).slice(2)}`
}

describe('Cross-view coordination', () => {
  it('selection_changed updates snapshot', () => {
    const bus = createCoordinationBus()

    expect(bus.getSnapshot().selectedRefs).toEqual([])

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [
        { type: 'game_node', id: 'n1' },
        { type: 'game_node', id: 'n2' },
      ],
    })

    expect(bus.getSnapshot().selectedRefs).toEqual([
      { type: 'game_node', id: 'n1' },
      { type: 'game_node', id: 'n2' },
    ])
  })

  it('selection_changed replaces prior selection in snapshot', () => {
    const bus = createCoordinationBus()

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [{ type: 'game_node', id: 'n1' }],
    })

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [{ type: 'game_node', id: 'n3' }],
    })

    expect(bus.getSnapshot().selectedRefs).toEqual([{ type: 'game_node', id: 'n3' }])
  })

  it('focus_entity updates snapshot', () => {
    const bus = createCoordinationBus()

    expect(bus.getSnapshot().focusedEntity).toBeNull()

    bus.emit({
      kind: 'focus_entity',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      ref: { type: 'claim', id: 'c1' },
    })

    expect(bus.getSnapshot().focusedEntity).toEqual({ type: 'claim', id: 'c1' })
  })

  it('focus_entity from inspector replaces previous focusedEntity in snapshot', () => {
    const bus = createCoordinationBus()

    bus.emit({
      kind: 'focus_entity',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      ref: { type: 'observation', id: 'obs1' },
    })

    bus.emit({
      kind: 'focus_entity',
      // Inspector uses 'graph' as source_view (it is a panel attached to the graph view)
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      ref: { type: 'claim', id: 'c2' },
    })

    expect(bus.getSnapshot().focusedEntity).toEqual({ type: 'claim', id: 'c2' })
  })

  it('highlight_dependents and highlight_clear cycle', () => {
    const bus = createCoordinationBus()

    expect(bus.getSnapshot().highlightedDependents).toEqual([])

    bus.emit({
      kind: 'highlight_dependents',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      root_ref: { type: 'claim', id: 'c1' },
      dependent_refs: [
        { type: 'game_node', id: 'n1' },
        { type: 'game_node', id: 'n2' },
      ],
    })

    expect(bus.getSnapshot().highlightedDependents).toEqual([
      { type: 'game_node', id: 'n1' },
      { type: 'game_node', id: 'n2' },
    ])

    bus.emit({
      kind: 'highlight_clear',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
    })

    expect(bus.getSnapshot().highlightedDependents).toEqual([])
  })

  it('highlight_dependents subscriber receives event', () => {
    const bus = createCoordinationBus()
    const received: string[] = []

    bus.subscribe('highlight_dependents', (event) => {
      if (event.kind === 'highlight_dependents') {
        for (const ref of event.dependent_refs) {
          received.push(ref.id)
        }
      }
    })

    bus.emit({
      kind: 'highlight_dependents',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      root_ref: { type: 'source', id: 's1' },
      dependent_refs: [
        { type: 'game_node', id: 'n5' },
        { type: 'game_node', id: 'n6' },
      ],
    })

    expect(received).toEqual(['n5', 'n6'])
  })

  it('highlight_clear subscriber receives event after highlight_dependents', () => {
    const bus = createCoordinationBus()
    let clearCount = 0

    bus.subscribe('highlight_clear', () => {
      clearCount += 1
    })

    bus.emit({
      kind: 'highlight_dependents',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      root_ref: { type: 'claim', id: 'c1' },
      dependent_refs: [{ type: 'game_node', id: 'n1' }],
    })

    bus.emit({
      kind: 'highlight_clear',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
    })

    expect(clearCount).toBe(1)
    expect(bus.getSnapshot().highlightedDependents).toEqual([])
  })

  it('view_requested event does not affect selection, focus, or highlight snapshot', () => {
    const bus = createCoordinationBus()

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [{ type: 'game_node', id: 'n1' }],
    })

    bus.emit({
      kind: 'focus_entity',
      source_view: 'evidence_notebook',
      correlation_id: makeCorrelationId(),
      ref: { type: 'claim', id: 'c1' },
    })

    bus.emit({
      kind: 'view_requested',
      source_view: 'board',
      correlation_id: makeCorrelationId(),
      view: 'graph',
      gameId: 'g1',
    })

    const snapshot = bus.getSnapshot()
    expect(snapshot.selectedRefs).toEqual([{ type: 'game_node', id: 'n1' }])
    expect(snapshot.focusedEntity).toEqual({ type: 'claim', id: 'c1' })
    expect(snapshot.highlightedDependents).toEqual([])
  })

  it('multiple event kinds can be subscribed independently', () => {
    const bus = createCoordinationBus()
    const selectionEvents: number[] = []
    const focusEvents: number[] = []

    bus.subscribe('selection_changed', () => selectionEvents.push(1))
    bus.subscribe('focus_entity', () => focusEvents.push(1))

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [],
    })

    bus.emit({
      kind: 'focus_entity',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      ref: { type: 'game', id: 'g1' },
    })

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: makeCorrelationId(),
      refs: [{ type: 'game_node', id: 'n1' }],
    })

    expect(selectionEvents).toHaveLength(2)
    expect(focusEvents).toHaveLength(1)
  })
})
