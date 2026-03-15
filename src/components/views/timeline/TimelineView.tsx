import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Clock, Database, GitBranch } from 'lucide-react'

import { useAppStore } from '../../../store'
import {
  selectTimelineEntries,
  type TimelineEntry,
  type TimelineEntryKind,
} from '../../../store/selectors/timeline-selectors'
import { Badge } from '../../design-system'

const KIND_CONFIG: Record<
  TimelineEntryKind,
  { label: string; color: string; icon: ReactNode }
> = {
  event_time: {
    label: 'EVENT',
    color: '#6366F1',
    icon: <Clock size={12} />,
  },
  model_time: {
    label: 'MODEL',
    color: '#22C55E',
    icon: <GitBranch size={12} />,
  },
  evidence_update: {
    label: 'EVIDENCE',
    color: '#F59E0B',
    icon: <Database size={12} />,
  },
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return timestamp
  }
}

interface TimelineEntryRowProps {
  entry: TimelineEntry
}

function TimelineEntryRow({ entry }: TimelineEntryRowProps) {
  const config = KIND_CONFIG[entry.kind]
  const entityType = entry.entity_ref?.type.replace(/_/g, ' ') ?? null

  return (
    <div className="flex gap-3 py-3 px-4 border-b border-border last:border-b-0 hover:bg-bg-card transition-colors">
      <div className="flex-shrink-0 mt-0.5 text-text-muted">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-text-primary truncate">{entry.label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-[10px] text-text-dim">
            {formatTimestamp(entry.timestamp)}
          </span>
          {entityType && (
            <Badge color={config.color}>{entityType}</Badge>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        <Badge color={config.color}>{config.label}</Badge>
      </div>
    </div>
  )
}

interface SwimlaneSectionProps {
  kind: TimelineEntryKind
  entries: TimelineEntry[]
}

function SwimlaneSection({ kind, entries }: SwimlaneSectionProps) {
  const config = KIND_CONFIG[kind]

  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-2 px-4 py-2 mb-2 border-b-2"
        style={{ borderColor: config.color }}
      >
        <span className="flex-shrink-0">{config.icon}</span>
        <span
          className="font-mono font-bold text-xs tracking-widest"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
        <span
          className="font-mono text-xs rounded px-1"
          style={{ color: config.color, backgroundColor: `${config.color}26` }}
        >
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="font-mono text-xs text-text-dim px-4 py-3">No entries</div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          {entries.map((entry) => (
            <TimelineEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TimelineView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const eventLog = useAppStore((s) => s.eventLog)

  const entries = useMemo(
    () => selectTimelineEntries(canonical, eventLog),
    [canonical, eventLog],
  )

  const grouped = useMemo(() => {
    const groups: Record<TimelineEntryKind, TimelineEntry[]> = {
      event_time: [],
      model_time: [],
      evidence_update: [],
    }

    for (const entry of entries) {
      groups[entry.kind].push(entry)
    }

    return groups
  }, [entries])

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page overflow-y-auto">
      <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary mb-6">
        TIMELINE
      </h1>

      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-sm text-text-muted mb-1">No timeline entries yet</p>
            <p className="font-mono text-xs text-text-dim">
              Timeline entries appear as you make changes to the model.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <SwimlaneSection kind="model_time" entries={grouped.model_time} />
          <SwimlaneSection kind="evidence_update" entries={grouped.evidence_update} />
          <SwimlaneSection kind="event_time" entries={grouped.event_time} />
        </div>
      )}
    </div>
  )
}
