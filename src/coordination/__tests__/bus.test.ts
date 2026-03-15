import { describe, it, expect, vi } from 'vitest'

import { createCoordinationBus } from '../bus'
import type { CoordinationEvent } from '../types'

function makeEvent(
  overrides: Partial<CoordinationEvent> & { kind: CoordinationEvent['kind'] },
): CoordinationEvent {
  return {
    source_view: 'graph',
    correlation_id: crypto.randomUUID(),
    ...overrides,
  } as CoordinationEvent
}

describe('CoordinationBus', () => {
  it('delivers events to subscribers', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()

    bus.subscribe('selection_changed', handler)

    const event = makeEvent({
      kind: 'selection_changed',
      refs: [{ type: 'game', id: 'g1' }],
    })
    bus.emit(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('does not deliver events to unsubscribed handlers', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()

    const unsubscribe = bus.subscribe('selection_changed', handler)
    unsubscribe()

    bus.emit(
      makeEvent({
        kind: 'selection_changed',
        refs: [{ type: 'game', id: 'g1' }],
      }),
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not deliver events of a different kind', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()

    bus.subscribe('focus_entity', handler)

    bus.emit(
      makeEvent({
        kind: 'selection_changed',
        refs: [],
      }),
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers for the same kind', () => {
    const bus = createCoordinationBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    bus.subscribe('highlight_clear', handler1)
    bus.subscribe('highlight_clear', handler2)

    bus.emit(makeEvent({ kind: 'highlight_clear' }))

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('updates snapshot on selection_changed', () => {
    const bus = createCoordinationBus()
    const refs = [
      { type: 'game' as const, id: 'g1' },
      { type: 'player' as const, id: 'p1' },
    ]

    bus.emit(makeEvent({ kind: 'selection_changed', refs }))

    const snapshot = bus.getSnapshot()
    expect(snapshot.selectedRefs).toEqual(refs)
  })

  it('updates snapshot on focus_entity', () => {
    const bus = createCoordinationBus()
    const ref = { type: 'game_node' as const, id: 'n1' }

    bus.emit(makeEvent({ kind: 'focus_entity', ref }))

    const snapshot = bus.getSnapshot()
    expect(snapshot.focusedEntity).toEqual(ref)
  })

  it('updates snapshot on highlight_dependents', () => {
    const bus = createCoordinationBus()
    const rootRef = { type: 'game_node' as const, id: 'n1' }
    const dependentRefs = [
      { type: 'game_edge' as const, id: 'e1' },
      { type: 'game_node' as const, id: 'n2' },
    ]

    bus.emit(
      makeEvent({
        kind: 'highlight_dependents',
        root_ref: rootRef,
        dependent_refs: dependentRefs,
      }),
    )

    const snapshot = bus.getSnapshot()
    expect(snapshot.highlightedDependents).toEqual(dependentRefs)
  })

  it('clears highlighted dependents on highlight_clear', () => {
    const bus = createCoordinationBus()
    const rootRef = { type: 'game_node' as const, id: 'n1' }

    bus.emit(
      makeEvent({
        kind: 'highlight_dependents',
        root_ref: rootRef,
        dependent_refs: [{ type: 'game_edge' as const, id: 'e1' }],
      }),
    )

    expect(bus.getSnapshot().highlightedDependents).toHaveLength(1)

    bus.emit(makeEvent({ kind: 'highlight_clear' }))

    expect(bus.getSnapshot().highlightedDependents).toEqual([])
  })

  it('returns empty snapshot initially', () => {
    const bus = createCoordinationBus()
    const snapshot = bus.getSnapshot()

    expect(snapshot.selectedRefs).toEqual([])
    expect(snapshot.focusedEntity).toBeNull()
    expect(snapshot.highlightedDependents).toEqual([])
  })

  it('does not affect snapshot for view_requested events', () => {
    const bus = createCoordinationBus()
    const before = bus.getSnapshot()

    bus.emit(makeEvent({ kind: 'view_requested', view: 'matrix' }))

    const after = bus.getSnapshot()
    expect(after).toEqual(before)
  })

  it('cleans up listener set when last handler is removed', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()

    const unsub = bus.subscribe('scroll_to', handler)
    unsub()

    // Emitting after full cleanup should not throw
    bus.emit(
      makeEvent({
        kind: 'scroll_to',
        ref: { type: 'game_node' as const, id: 'n1' },
      }),
    )

    expect(handler).not.toHaveBeenCalled()
  })
})
