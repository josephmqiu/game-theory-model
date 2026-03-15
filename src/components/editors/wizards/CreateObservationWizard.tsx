import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateObservationCommand } from '../builders'
import { Button } from '../../design-system'

const createObservationSchema = z.object({
  sourceId: z.string().min(1, 'Source is required'),
  text: z.string().min(1, 'Observation text is required'),
})

interface CreateObservationWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateObservationWizard({ open, onClose }: CreateObservationWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [sourceId, setSourceId] = useState('')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const sources = Object.values(canonical.sources)

  const handleSubmit = useCallback(() => {
    const validation = createObservationSchema.safeParse({ sourceId, text })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.observations))
    const command = buildCreateObservationCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.observations).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'observation', id: newId }])
      }
      setSourceId('')
      setText('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [sourceId, text, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setSourceId('')
    setText('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Observation"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE OBSERVATION
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Source</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select source...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? s.url ?? s.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Observation Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[80px] resize-y"
              placeholder="What was observed in the source?"
              autoFocus
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
