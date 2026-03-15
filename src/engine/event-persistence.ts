import type { ModelEvent } from './events'

export interface PersistedEvent {
  id: string
  timestamp: string
  command_json: string
  patches_json: string
  source: 'user' | 'ai_merge' | 'solver' | 'play_session'
  analysis_id: string
}

export interface CanonicalRevision {
  analysis_id: string
  revision: number
  last_event_id: string
  updated_at: string
}

interface EventPersistenceAdapter {
  persistEventSync(event: ModelEvent, analysisId: string): void
  queryEventsSync(
    analysisId: string,
    opts?: {
      since?: string
      limit?: number
      source?: ModelEvent['source']
    },
  ): PersistedEvent[]
  getCanonicalRevisionSync(analysisId: string): number
  incrementRevisionSync(analysisId: string, eventId: string): number
  reset?(): void
}

class MemoryEventPersistenceAdapter implements EventPersistenceAdapter {
  readonly events = new Map<string, PersistedEvent[]>()
  readonly revisions = new Map<string, CanonicalRevision>()

  persistEventSync(event: ModelEvent, analysisId: string): void {
    const persisted: PersistedEvent = {
      id: event.id,
      timestamp: event.timestamp,
      command_json: JSON.stringify(event.command),
      patches_json: JSON.stringify(event.patches),
      source: event.source,
      analysis_id: analysisId,
    }

    const events = this.events.get(analysisId) ?? []
    events.push(persisted)
    this.events.set(analysisId, events)
  }

  queryEventsSync(
    analysisId: string,
    opts?: {
      since?: string
      limit?: number
      source?: ModelEvent['source']
    },
  ): PersistedEvent[] {
    let events = [...(this.events.get(analysisId) ?? [])]
    if (opts?.since) {
      events = events.filter((event) => event.timestamp > opts.since!)
    }
    if (opts?.source) {
      events = events.filter((event) => event.source === opts.source)
    }
    if (typeof opts?.limit === 'number') {
      events = events.slice(-opts.limit)
    }
    return events
  }

  getCanonicalRevisionSync(analysisId: string): number {
    return this.revisions.get(analysisId)?.revision ?? 0
  }

  incrementRevisionSync(analysisId: string, eventId: string): number {
    const revision = this.getCanonicalRevisionSync(analysisId) + 1
    this.revisions.set(analysisId, {
      analysis_id: analysisId,
      revision,
      last_event_id: eventId,
      updated_at: new Date().toISOString(),
    })
    return revision
  }

  reset(): void {
    this.events.clear()
    this.revisions.clear()
  }
}

let activeAdapter: EventPersistenceAdapter = new MemoryEventPersistenceAdapter()

export function setEventPersistenceAdapter(adapter: EventPersistenceAdapter): void {
  activeAdapter = adapter
}

export function resetEventPersistenceAdapter(): void {
  activeAdapter = new MemoryEventPersistenceAdapter()
}

export function resetPersistedEventStore(): void {
  activeAdapter.reset?.()
}

export function persistEventSync(event: ModelEvent, analysisId: string): void {
  activeAdapter.persistEventSync(event, analysisId)
}

export async function persistEvent(event: ModelEvent, analysisId: string): Promise<void> {
  persistEventSync(event, analysisId)
}

export function queryEventsSync(
  analysisId: string,
  opts?: {
    since?: string
    limit?: number
    source?: ModelEvent['source']
  },
): PersistedEvent[] {
  return activeAdapter.queryEventsSync(analysisId, opts)
}

export async function queryEvents(
  analysisId: string,
  opts?: {
    since?: string
    limit?: number
    source?: ModelEvent['source']
  },
): Promise<PersistedEvent[]> {
  return queryEventsSync(analysisId, opts)
}

export function getCanonicalRevisionSync(analysisId: string): number {
  return activeAdapter.getCanonicalRevisionSync(analysisId)
}

export async function getCanonicalRevision(analysisId: string): Promise<number> {
  return getCanonicalRevisionSync(analysisId)
}

export function incrementRevisionSync(analysisId: string, eventId: string): number {
  return activeAdapter.incrementRevisionSync(analysisId, eventId)
}

export async function incrementRevision(
  analysisId: string,
  eventId: string,
): Promise<number> {
  return incrementRevisionSync(analysisId, eventId)
}
