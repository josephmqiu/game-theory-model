import type { ReactNode } from 'react'
import { useAppStore } from '../../store'

export function StatusBar(): ReactNode {
  const fileMeta = useAppStore((s) => s.fileMeta)

  const filePath = fileMeta.path ?? 'No file open'
  const saveStatus = fileMeta.error
    ? `Error: ${fileMeta.error}`
    : fileMeta.dirty
      ? 'Unsaved changes'
      : 'Saved'

  return (
    <footer className="flex items-center justify-between h-7 px-4 border-t border-border-subtle flex-shrink-0">
      <span className="font-mono text-xs text-text-dim truncate max-w-[40%]">{filePath}</span>
      <span className={`font-mono text-xs ${fileMeta.error ? 'text-warning' : 'text-text-dim'}`}>{saveStatus}</span>
      <span className="font-mono text-xs text-text-dim">v0.1.0</span>
    </footer>
  )
}
