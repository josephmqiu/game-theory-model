import type { CanonicalStore, EntityType } from '../../types/canonical'
import type { EventLog, ModelEvent } from '../../engine/events'
import { parseCrudCommandKind } from '../../engine/commands'

export type TimelineEntryKind = 'event_time' | 'model_time' | 'evidence_update'

export interface TimelineEntry {
  id: string
  label: string
  entity_ref: { type: EntityType; id: string } | null
  kind: TimelineEntryKind
  timestamp: string
}

function classifyEventKind(event: ModelEvent): TimelineEntryKind {
  const cmd = event.command
  if (cmd.kind === 'batch') {
    return 'model_time'
  }

  const parsed = parseCrudCommandKind(cmd.kind)
  if (!parsed) {
    if (cmd.kind === 'mark_stale' || cmd.kind === 'clear_stale') {
      return 'evidence_update'
    }
    return 'model_time'
  }

  const evidenceTypes: ReadonlyArray<EntityType> = [
    'source',
    'observation',
    'claim',
    'inference',
    'assumption',
    'contradiction',
    'derivation',
  ]

  if (evidenceTypes.includes(parsed.entityType)) {
    return 'evidence_update'
  }

  return 'model_time'
}

function buildLabel(event: ModelEvent, canonical: CanonicalStore): string {
  const cmd = event.command

  if (cmd.kind === 'batch') {
    return `Batch: ${cmd.label}`
  }

  if (cmd.kind === 'mark_stale') {
    return `Marked stale: ${cmd.payload.id}`
  }

  if (cmd.kind === 'clear_stale') {
    return `Cleared stale: ${cmd.payload.id}`
  }

  if (cmd.kind === 'update_payoff') {
    const node = canonical.nodes[cmd.payload.node_id]
    return `Updated payoff at ${node?.label ?? cmd.payload.node_id}`
  }

  if (cmd.kind === 'update_normal_form_payoff') {
    return `Updated normal-form payoff (cell ${cmd.payload.cell_index})`
  }

  const parsed = parseCrudCommandKind(cmd.kind)
  if (!parsed) {
    return cmd.kind
  }

  const entityName = resolveEntityName(canonical, parsed.entityType, cmd.payload)
  const operationLabel = parsed.operation === 'add'
    ? 'Created'
    : parsed.operation === 'update'
      ? 'Updated'
      : 'Deleted'

  return `${operationLabel} ${parsed.entityType.replace(/_/g, ' ')}: ${entityName}`
}

function resolveEntityName(
  canonical: CanonicalStore,
  entityType: EntityType,
  payload: Record<string, unknown>,
): string {
  const id = (payload.id as string | undefined) ?? ''

  switch (entityType) {
    case 'game':
      return (payload.name as string) ?? canonical.games[id]?.name ?? id
    case 'player':
      return (payload.name as string) ?? canonical.players[id]?.name ?? id
    case 'game_node':
      return (payload.label as string) ?? canonical.nodes[id]?.label ?? id
    case 'game_edge':
      return (payload.label as string) ?? canonical.edges[id]?.label ?? id
    case 'source':
      return (payload.title as string) ?? canonical.sources[id]?.title ?? id
    case 'assumption':
      return (payload.statement as string) ?? canonical.assumptions[id]?.statement ?? id
    case 'claim':
      return (payload.statement as string) ?? canonical.claims[id]?.statement ?? id
    default:
      return id || entityType
  }
}

function extractEntityRef(
  event: ModelEvent,
): { type: EntityType; id: string } | null {
  const cmd = event.command

  if (cmd.kind === 'batch') {
    return null
  }

  if (cmd.kind === 'mark_stale' || cmd.kind === 'clear_stale') {
    return null
  }

  if (cmd.kind === 'update_payoff') {
    return { type: 'game_node', id: cmd.payload.node_id }
  }

  if (cmd.kind === 'update_normal_form_payoff') {
    return { type: 'formalization', id: cmd.payload.formalization_id }
  }

  const parsed = parseCrudCommandKind(cmd.kind)
  if (!parsed) {
    return null
  }

  const id = (cmd.payload as Record<string, unknown>).id as string | undefined
  if (!id) {
    return null
  }

  return { type: parsed.entityType, id }
}

export function useTimelineEntries(
  canonical: CanonicalStore,
  eventLog: EventLog,
): TimelineEntry[] {
  const activeEvents = eventLog.events.slice(0, eventLog.cursor)

  return activeEvents.map((event) => ({
    id: event.id,
    label: buildLabel(event, canonical),
    entity_ref: extractEntityRef(event),
    kind: classifyEventKind(event),
    timestamp: event.timestamp,
  }))
}
