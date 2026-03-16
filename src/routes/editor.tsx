import { createFileRoute } from '@tanstack/react-router'
import {
  Target,
  ChevronRight,
  FileText,
  Users,
  BarChart3,
  Clock,
  MessageSquare,
  Settings,
} from 'lucide-react'

export const Route = createFileRoute('/editor')({
  component: EditorPage,
  ssr: false,
  head: () => ({
    meta: [{ title: 'Editor — Game Theory Analyzer' }],
  }),
})

const PHASES = [
  { id: 1, label: 'Grounding' },
  { id: 2, label: 'Players' },
  { id: 3, label: 'Base Games' },
  { id: 4, label: 'Cross-Game' },
  { id: 5, label: 'Dynamics' },
  { id: 6, label: 'Formalization' },
  { id: 7, label: 'Assumptions' },
  { id: 8, label: 'Elimination' },
  { id: 9, label: 'Scenarios' },
  { id: 10, label: 'Meta-Check' },
] as const

const NAV_ITEMS = [
  { icon: BarChart3, label: 'Overview', id: 'overview' },
  { icon: FileText, label: 'Evidence', id: 'evidence' },
  { icon: Users, label: 'Players', id: 'players' },
  { icon: Target, label: 'Scenarios', id: 'scenarios' },
  { icon: Clock, label: 'Timeline', id: 'timeline' },
] as const

function EditorPage() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="h-10 flex items-center justify-between border-b border-border px-4 shrink-0 app-region-drag">
        <div className="flex items-center gap-2 app-region-no-drag">
          <Target size={16} className="text-primary" />
          <span className="text-sm font-medium">Untitled Analysis</span>
        </div>
        <div className="flex items-center gap-2 app-region-no-drag">
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <MessageSquare size={14} />
            AI
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border flex flex-col shrink-0 overflow-y-auto">
          {/* Nav items */}
          <nav className="p-2 space-y-0.5">
            {NAV_ITEMS.map(({ icon: Icon, label, id }) => (
              <button
                key={id}
                type="button"
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>

          {/* Phases */}
          <div className="px-2 mt-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">
              Phases
            </h3>
            <div className="space-y-0.5">
              {PHASES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-mono">
                    {id}
                  </span>
                  {label}
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">Overview</h2>
            <p className="text-muted-foreground mb-8">
              Start a new analysis or open an existing .gta.json file.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {PHASES.map(({ id, label }) => (
                <div
                  key={id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-mono">
                      {id}
                    </span>
                    <h3 className="text-sm font-medium">{label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Not started</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Inspector panel placeholder */}
        <aside className="w-64 border-l border-border shrink-0 overflow-y-auto p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Inspector
          </h3>
          <p className="text-sm text-muted-foreground">
            Select an entity to view details
          </p>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center justify-between border-t border-border px-4 text-xs text-muted-foreground shrink-0">
        <span>Manual Mode</span>
        <span>No file loaded</span>
      </footer>
    </div>
  )
}
