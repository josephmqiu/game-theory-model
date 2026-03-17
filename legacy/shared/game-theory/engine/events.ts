import type { Operation } from 'fast-json-patch'

import type { Command } from './commands'
import type { IntegrityAction } from './integrity'

export interface ModelEvent {
  id: string
  timestamp: string
  command: Command
  patches: ReadonlyArray<Operation>
  inverse_patches: ReadonlyArray<Operation>
  integrity_actions: ReadonlyArray<IntegrityAction>
  source: 'user' | 'ai_merge' | 'solver' | 'play_session'
  metadata?: Record<string, unknown>
}

export interface EventLog {
  readonly events: ReadonlyArray<ModelEvent>
  cursor: number
  analysis_id: string
  persisted_revision: number
  pending_persisted_events: ReadonlyArray<ModelEvent>
  last_persist_error?: string
}

export function createEventLog(
  analysisId: string,
  persistedRevision = 0,
): EventLog {
  return {
    events: [],
    cursor: 0,
    analysis_id: analysisId,
    persisted_revision: persistedRevision,
    pending_persisted_events: [],
    last_persist_error: undefined,
  }
}

