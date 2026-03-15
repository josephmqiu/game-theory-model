import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { useAppStore } from '../../store'
import { Button } from '../design-system'

function formatIssues(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  return value
    .map((issue) => {
      if (typeof issue === 'string') return issue
      try {
        return JSON.stringify(issue)
      } catch {
        return String(issue)
      }
    })
    .join('\n')
}

export function RecoveryView(): ReactNode {
  const recovery = useAppStore((s) => s.recovery)
  const retryRecovery = useAppStore((s) => s.retryRecovery)
  const newAnalysis = useAppStore((s) => s.newAnalysis)
  const clearFileError = useAppStore((s) => s.clearFileError)

  const [draft, setDraft] = useState(recovery.active ? recovery.raw_json : '')

  const details = useMemo(() => {
    if (!recovery.active) return null
    return formatIssues(recovery.error.issues ?? recovery.error.structural_issues)
  }, [recovery])

  const handleRetry = useCallback(() => {
    clearFileError()
    void retryRecovery(draft)
  }, [clearFileError, retryRecovery, draft])

  const handleStartFresh = useCallback(() => {
    clearFileError()
    newAnalysis()
  }, [clearFileError, newAnalysis])

  if (!recovery.active) {
    return null
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg-page p-8">
      <div className="w-full max-w-4xl rounded border border-warning/40 bg-bg-card p-6">
        <h1 className="font-mono text-lg font-bold tracking-widest text-warning mb-3">
          RECOVERY MODE
        </h1>
        <p className="text-sm text-text-primary mb-2">
          The file could not be loaded during the {recovery.stage} stage.
        </p>
        <p className="font-mono text-xs text-warning mb-4">{recovery.error.message}</p>

        {details && (
          <pre className="mb-4 max-h-40 overflow-auto rounded bg-bg-surface p-3 text-xs text-text-muted whitespace-pre-wrap">
            {details}
          </pre>
        )}

        <label className="block text-xs font-mono text-text-muted mb-2">Recovery JSON</label>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-[320px] w-full rounded border border-border bg-bg-surface p-3 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
        />

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={handleStartFresh}>Start Fresh</Button>
          <Button variant="primary" onClick={handleRetry}>Retry Load</Button>
        </div>
      </div>
    </div>
  )
}
