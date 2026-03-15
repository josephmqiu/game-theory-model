import { useState } from 'react'
import type { ReactNode } from 'react'
import { Plus, Database } from 'lucide-react'
import { useAppStore } from '../../store'
import { Badge, ConfidenceBadge, StaleBadge, ViewTab } from '../design-system'
import { selectEvidenceLibrary } from '../../store/selectors/evidence-selectors'
import type { EvidenceTab, EvidenceEntry } from '../../store/selectors/evidence-selectors'
import { CreateEvidenceWizard } from '../editors/wizards'

const EVIDENCE_TYPE_COLORS: Record<string, string> = {
  source: '#6366F1',
  claim: '#22C55E',
  assumption: '#F59E0B',
}

const TAB_DEFS: Array<{ id: EvidenceTab; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'sources', label: 'SOURCES' },
  { id: 'claims', label: 'CLAIMS' },
  { id: 'assumptions', label: 'ASSUMPTIONS' },
]

interface EvidenceRowProps {
  entry: EvidenceEntry
}

function EvidenceRow({ entry }: EvidenceRowProps) {
  const typeColor = EVIDENCE_TYPE_COLORS[entry.type] ?? '#64748B'

  return (
    <div className="flex items-center gap-3 py-3 px-4 border-b border-border last:border-b-0 hover:bg-bg-card transition-colors rounded">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-text-primary truncate">{entry.title}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge color={typeColor}>{entry.type}</Badge>
        {entry.confidence !== undefined && <ConfidenceBadge value={entry.confidence} />}
        {entry.isStale && <StaleBadge />}
      </div>
    </div>
  )
}

export function EvidenceLibrary(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const [activeTab, setActiveTab] = useState<EvidenceTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateSource, setShowCreateSource] = useState(false)

  const allEntries = selectEvidenceLibrary(canonical, activeTab)

  const filteredEntries = searchQuery.trim()
    ? allEntries.filter((entry) =>
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allEntries

  function handleAddSource() {
    setShowCreateSource(true)
  }

  return (
    <div className="flex flex-col h-full p-6 bg-bg-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary">
          EVIDENCE LIBRARY
        </h1>
        <button
          type="button"
          className="flex items-center gap-1 px-3 py-2 font-mono text-xs font-bold text-bg-page bg-accent rounded hover:opacity-90 transition-opacity"
          onClick={handleAddSource}
        >
          <Plus size={12} />
          ADD SOURCE
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search evidence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm bg-bg-card border border-border rounded px-3 py-2 font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex border-b border-border mb-4">
        {TAB_DEFS.map((tab) => (
          <ViewTab
            key={tab.id}
            icon={<Database size={12} />}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-sm text-text-muted mb-1">No evidence found</p>
            <p className="font-mono text-xs text-text-dim">
              {searchQuery ? 'Try a different search term.' : 'Add sources, claims, and assumptions to build your evidence base.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          {filteredEntries.map((entry) => (
            <EvidenceRow key={`${entry.type}:${entry.id}`} entry={entry} />
          ))}
        </div>
      )}

      <CreateEvidenceWizard open={showCreateSource} onClose={() => setShowCreateSource(false)} />
    </div>
  )
}
