import type {
  CoordinationBus,
  CoordinationEvent,
  CoordinationEventKind,
  CoordinationSnapshot,
} from './types'

function emptySnapshot(): CoordinationSnapshot {
  return {
    selectedRefs: [],
    focusedEntity: null,
    highlightedDependents: [],
  }
}

export function createCoordinationBus(): CoordinationBus {
  type Handler = (e: CoordinationEvent) => void

  const listeners = new Map<CoordinationEventKind, Set<Handler>>()
  let snapshot: CoordinationSnapshot = emptySnapshot()

  function updateSnapshot(event: CoordinationEvent): void {
    switch (event.kind) {
      case 'selection_changed':
        snapshot = { ...snapshot, selectedRefs: event.refs }
        break
      case 'focus_entity':
        snapshot = { ...snapshot, focusedEntity: event.ref }
        break
      case 'highlight_dependents':
        snapshot = { ...snapshot, highlightedDependents: event.dependent_refs }
        break
      case 'highlight_clear':
        snapshot = { ...snapshot, highlightedDependents: [] }
        break
      default:
        break
    }
  }

  function emit(event: CoordinationEvent): void {
    updateSnapshot(event)
    const handlers = listeners.get(event.kind)
    if (!handlers) return
    for (const handler of handlers) {
      handler(event)
    }
  }

  function subscribe(
    kind: CoordinationEventKind,
    handler: Handler,
  ): () => void {
    const existing = listeners.get(kind)
    if (existing) {
      existing.add(handler)
    } else {
      listeners.set(kind, new Set([handler]))
    }

    return () => {
      const set = listeners.get(kind)
      if (set) {
        set.delete(handler)
        if (set.size === 0) {
          listeners.delete(kind)
        }
      }
    }
  }

  function getSnapshot(): CoordinationSnapshot {
    return snapshot
  }

  return { emit, subscribe, getSnapshot }
}
