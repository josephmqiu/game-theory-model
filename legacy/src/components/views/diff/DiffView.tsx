import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { GitCommit } from 'lucide-react'

import { useAppStore } from '../../../store'
import {
  selectDiffEntries,
  type DiffEntry,
  type DiffChangeType,
} from '../../../store/selectors/diff-selectors'
import { Badge } from '../../design-system'
import type { EntityType } from '../../../types/canonical'
import { entityTypes } from '../../../types/canonical'

const CHANGE_TYPE_COLORS: Record<DiffChangeType, string> = {
  created: '#22C55E',
  updated: '#3B82F6',
  deleted: '#EF4444',
  marked_stale: '#F59E0B',
  stale_cleared: '#6366F1',
}

const ENTITY_TYPE_OPTIONS: Array<{ value: EntityType | 'all'; label: string }> = [
  { value: 'all', label: 'All Types' },
  ...entityTypes.map((t) => ({
    value: t,
    label: t.replace(/_/g, ' '),
  })),
]

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

interface DiffEntryRowProps {
  entry: DiffEntry
}

function DiffEntryRow({ entry }: DiffEntryRowProps) {
  const changeColor = CHANGE_TYPE_COLORS[entry.change_type]
  const entityType = entry.entity_ref?.type.replace(/_/g, ' ') ?? 'unknown'

  return (
    <div className="py-3 px-4 border-b border-border last:border-b-0 hover:bg-bg-card transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Badge color={changeColor}>{entry.change_type.replace(/_/g, ' ')}</Badge>
        {entry.entity_ref && <Badge>{entityType}</Badge>}
        <span className="font-mono text-[10px] text-text-dim ml-auto">
          {formatTimestamp(entry.timestamp)}
        </span>
      </div>

      {entry.field_changes.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-border">
          {entry.field_changes.map((fc, index) => (
            <div
              key={`${fc.field}-${index}`}
              className="flex items-center gap-2 py-0.5"
            >
              <span className="font-mono text-[10px] text-text-dim w-14">
                {fc.operation}
              </span>
              <span className="font-mono text-xs text-text-muted">{fc.field}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DiffView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const eventLog = useAppStore((s) => s.eventLog)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)

  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const allEntries = useMemo(
    () => selectDiffEntries(canonical, eventLog, activeGameId),
    [canonical, eventLog, activeGameId],
  )

  const filteredEntries = useMemo(() => {
    let result = allEntries

    if (entityTypeFilter !== 'all') {
      result = result.filter(
        (entry) => entry.entity_ref?.type === entityTypeFilter,
      )
    }

    if (startDate) {
      const start = new Date(startDate).getTime()
      result = result.filter((entry) => new Date(entry.timestamp).getTime() >= start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime()
      result = result.filter((entry) => new Date(entry.timestamp).getTime() <= end)
    }

    return result
  }, [allEntries, entityTypeFilter, startDate, endDate])

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page overflow-y-auto">
      <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary mb-4">
        CHANGE LOG
      </h1>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value as EntityType | 'all')}
          className="bg-bg-card border border-border rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
        >
          {ENTITY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-bg-card border border-border rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
          placeholder="Start date"
        />

        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-bg-card border border-border rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
          placeholder="End date"
        />

        <span className="font-mono text-xs text-text-muted">
          {filteredEntries.length} change{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <GitCommit size={32} className="text-text-dim mx-auto mb-3" />
            <p className="font-mono text-sm text-text-muted mb-1">No changes found</p>
            <p className="font-mono text-xs text-text-dim">
              {allEntries.length === 0
                ? 'Changes will appear as you modify the model.'
                : 'Try adjusting the filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          {filteredEntries.map((entry) => (
            <DiffEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
