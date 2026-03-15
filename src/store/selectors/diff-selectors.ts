import type { EntityType } from '../../types/canonical'
import type { EventLog, ModelEvent } from '../../engine/events'
import { parseCrudCommandKind } from '../../engine/commands'

export type DiffChangeType = 'created' | 'updated' | 'deleted' | 'marked_stale' | 'stale_cleared'

export interface DiffFieldChange {
  field: string
  operation: 'add' | 'replace' | 'remove'
}

export interface DiffEntry {
  id: string
  entity_ref: { type: EntityType; id: string } | null
  change_type: DiffChangeType
  timestamp: string
  field_changes: DiffFieldChange[]
  root_cause_event_id: string
}

function extractEntityTypeFromPatchPath(path: string): EntityType | null {
  const segments = path.split('/').filter((s) => s.length > 0)
  if (segments.length === 0) return null

  const collectionToType: Record<string, EntityType> = {
    games: 'game',
    formalizations: 'formalization',
    players: 'player',
    nodes: 'game_node',
    edges: 'game_edge',
    sources: 'source',
    observations: 'observation',
    claims: 'claim',
    inferences: 'inference',
    assumptions: 'assumption',
    contradictions: 'contradiction',
    derivations: 'derivation',
    latent_factors: 'latent_factor',
    cross_game_links: 'cross_game_link',
    scenarios: 'scenario',
    playbooks: 'playbook',
  }

  return collectionToType[segments[0] ?? ''] ?? null
}

function extractEntityIdFromPatchPath(path: string): string | null {
  const segments = path.split('/').filter((s) => s.length > 0)
  return segments[1] ?? null
}

function extractFieldFromPatchPath(path: string): string | null {
  const segments = path.split('/').filter((s) => s.length > 0)
  return segments[2] ?? null
}

function commandToChangeType(event: ModelEvent): DiffChangeType {
  const cmd = event.command

  if (cmd.kind === 'mark_stale') return 'marked_stale'
  if (cmd.kind === 'clear_stale') return 'stale_cleared'

  const parsed = parseCrudCommandKind(cmd.kind)
  if (!parsed) return 'updated'

  switch (parsed.operation) {
    case 'add':
      return 'created'
    case 'update':
      return 'updated'
    case 'delete':
      return 'deleted'
  }
}

function eventToDiffEntries(event: ModelEvent): DiffEntry[] {
  const changeType = commandToChangeType(event)

  // Group patches by entity
  const entityPatches = new Map<string, { type: EntityType; id: string; fields: DiffFieldChange[] }>()

  for (const patch of event.patches) {
    const entityType = extractEntityTypeFromPatchPath(patch.path)
    const entityId = extractEntityIdFromPatchPath(patch.path)

    if (!entityType || !entityId) continue

    const key = `${entityType}:${entityId}`
    const existing = entityPatches.get(key)

    const field = extractFieldFromPatchPath(patch.path)
    const fieldChange: DiffFieldChange | null = field
      ? {
          field,
          operation: patch.op === 'add' ? 'add' : patch.op === 'remove' ? 'remove' : 'replace',
        }
      : null

    if (existing) {
      if (fieldChange) {
        existing.fields.push(fieldChange)
      }
    } else {
      entityPatches.set(key, {
        type: entityType,
        id: entityId,
        fields: fieldChange ? [fieldChange] : [],
      })
    }
  }

  // If no patches produced entity references, still create an entry from the command
  if (entityPatches.size === 0) {
    return [
      {
        id: event.id,
        entity_ref: null,
        change_type: changeType,
        timestamp: event.timestamp,
        field_changes: [],
        root_cause_event_id: event.id,
      },
    ]
  }

  return Array.from(entityPatches.values()).map((entity, index) => ({
    id: `${event.id}-${index}`,
    entity_ref: { type: entity.type, id: entity.id },
    change_type: changeType,
    timestamp: event.timestamp,
    field_changes: entity.fields,
    root_cause_event_id: event.id,
  }))
}

export function selectDiffEntries(eventLog: EventLog): DiffEntry[] {
  const activeEvents = eventLog.events.slice(0, eventLog.cursor)
  return activeEvents.flatMap(eventToDiffEntries)
}
