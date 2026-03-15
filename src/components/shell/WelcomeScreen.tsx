import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Plus, FolderOpen, BookOpen, Wifi, Hexagon } from 'lucide-react'
import { useAppStore } from '../../store'
import { usePlatform } from '../../platform'
import type { RecentFile } from '../../platform'
import { EmptyStateNoAI } from './EmptyStateNoAI'

interface ActionCardProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
}

function ActionCard({ icon, title, description, onClick, disabled = false }: ActionCardProps) {
  return (
    <button
      className="bg-bg-card border border-border p-6 w-60 rounded text-left hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="text-accent mb-3">{icon}</div>
      <div className="font-mono font-bold text-sm text-accent tracking-wide mb-1">{title}</div>
      <div className="font-mono text-xs text-text-muted leading-relaxed">{description}</div>
    </button>
  )
}

interface RecentFileRowProps {
  file: RecentFile
}

function RecentFileRow({ file }: RecentFileRowProps) {
  const lastOpened = new Date(file.lastOpened).toLocaleDateString()
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-border last:border-b-0 hover:bg-bg-card transition-colors rounded">
      <span className="font-mono text-sm text-text-primary truncate flex-1">{file.name}</span>
      <span className="font-mono text-xs text-text-muted ml-4 flex-shrink-0">{lastOpened}</span>
    </div>
  )
}

export function WelcomeScreen(): ReactNode {
  const newAnalysis = useAppStore((s) => s.newAnalysis)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { fileService } = usePlatform()

  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [showNoAI, setShowNoAI] = useState(false)

  useEffect(() => {
    fileService.getRecentFiles().then((files) => {
      setRecentFiles(files)
    })
  }, [fileService])

  function handleNewAnalysis() {
    newAnalysis()
    setActiveView('board')
  }

  function handleOpenFile() {
    alert('File open coming soon')
  }

  function handleLoadExample() {
    fileService
      .loadFixture('sample')
      .then(() => {
        setActiveView('board')
      })
      .catch(() => {
        setActiveView('board')
      })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-12 bg-bg-page">
      <div className="flex flex-col items-center mb-12">
        <div className="text-accent mb-4">
          <Hexagon size={48} strokeWidth={1.5} />
        </div>
        <h1 className="font-mono font-bold text-2xl tracking-widest text-text-primary mb-1">
          STRATEGIC LENS
        </h1>
        <p className="font-mono text-xs text-text-muted tracking-widest">
          GAME THEORY ANALYSIS PLATFORM
        </p>
      </div>

      <div className="flex gap-4 mb-12 flex-wrap justify-center">
        <ActionCard
          icon={<Plus size={24} />}
          title="CREATE NEW ANALYSIS"
          description="Start a new strategic analysis from scratch."
          onClick={handleNewAnalysis}
        />
        <ActionCard
          icon={<FolderOpen size={24} />}
          title="OPEN FILE"
          description="Open an existing .gta.json analysis file."
          onClick={handleOpenFile}
        />
        <ActionCard
          icon={<BookOpen size={24} />}
          title="LOAD EXAMPLE"
          description="Load a pre-built example to explore the platform."
          onClick={handleLoadExample}
        />
        <ActionCard
          icon={<Wifi size={24} />}
          title="CONNECT AI CLIENT"
          description="Configure an AI provider for assisted analysis."
          onClick={() => setShowNoAI(true)}
        />
      </div>

      {recentFiles.length > 0 && (
        <div className="w-full max-w-xl mb-8">
          <h2 className="font-mono text-xs font-bold tracking-widest text-text-muted mb-2 uppercase">
            Recent Files
          </h2>
          <div className="border border-border rounded bg-bg-card overflow-hidden">
            {recentFiles.map((file) => (
              <RecentFileRow key={file.path} file={file} />
            ))}
          </div>
        </div>
      )}

      {showNoAI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border rounded p-6 w-[480px]">
            <EmptyStateNoAI
              onSetupGuide={() => setShowNoAI(false)}
              onContinueWithoutAI={() => setShowNoAI(false)}
            />
          </div>
        </div>
      )}

      <div className="font-mono text-xs text-text-dim tracking-wider mt-auto pt-8">
        v0.1.0 — LOCAL-FIRST ANALYSIS
      </div>
    </div>
  )
}
