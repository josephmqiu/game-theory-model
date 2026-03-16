import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateSourceCommand } from '../builders'
import { Button } from '../../design-system'
import { sourceKinds } from '../../../types/evidence'

const createSourceSchema = z.object({
  kind: z.enum(sourceKinds),
  title: z.string().min(1, 'Title is required'),
  url: z.string().optional(),
  publisher: z.string().optional(),
  notes: z.string().optional(),
})

interface CreateEvidenceWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateEvidenceWizard({ open, onClose }: CreateEvidenceWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [kind, setKind] = useState<(typeof sourceKinds)[number]>('web')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [publisher, setPublisher] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const validation = createSourceSchema.safeParse({
      kind,
      title,
      url: url || undefined,
      publisher: publisher || undefined,
      notes: notes || undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.sources))
    const command = buildCreateSourceCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.sources).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'source', id: newId }])
      }
      setKind('web')
      setTitle('')
      setUrl('')
      setPublisher('')
      setNotes('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [kind, title, url, publisher, notes, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setKind('web')
    setTitle('')
    setUrl('')
    setPublisher('')
    setNotes('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Source"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          ADD SOURCE
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Source title"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as (typeof sourceKinds)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {sourceKinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">URL (optional)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Publisher (optional)</label>
            <input
              type="text"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Publisher name"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Additional notes"
            />
          </div>

          {errors.length > 0 && (
            <div className="text-warning text-xs font-mono">
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Create</Button>
        </div>
      </div>
    </div>
  )
}
