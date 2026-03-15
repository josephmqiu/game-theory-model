import type { EntityRef } from '../types'
import type { ViewType } from '../store/app-store'

interface BaseCoordinationEvent {
  source_view: ViewType
  correlation_id: string
}

export type CoordinationEvent =
  | BaseCoordinationEvent & { kind: 'selection_changed'; refs: EntityRef[] }
  | BaseCoordinationEvent & { kind: 'focus_entity'; ref: EntityRef }
  | BaseCoordinationEvent & { kind: 'scroll_to'; ref: EntityRef }
  | BaseCoordinationEvent & {
      kind: 'highlight_dependents'
      root_ref: EntityRef
      dependent_refs: EntityRef[]
    }
  | BaseCoordinationEvent & { kind: 'highlight_clear' }
  | BaseCoordinationEvent & { kind: 'view_requested'; view: ViewType; gameId?: string }
  | BaseCoordinationEvent & { kind: 'stale_entities_changed'; stale_refs: EntityRef[] }

export type CoordinationEventKind = CoordinationEvent['kind']

export interface CoordinationSnapshot {
  selectedRefs: EntityRef[]
  focusedEntity: EntityRef | null
  highlightedDependents: EntityRef[]
}

export interface CoordinationBus {
  emit(event: CoordinationEvent): void
  subscribe(
    kind: CoordinationEventKind,
    handler: (e: CoordinationEvent) => void,
  ): () => void
  getSnapshot(): CoordinationSnapshot
}
