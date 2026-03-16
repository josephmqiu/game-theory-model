import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreatePlaybookCommand } from '../builders'
import { Button } from '../../design-system'

const createPlaybookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  formalizationId: z.string().min(1, 'Formalization is required'),
  notes: z.string().optional(),
})

interface CreatePlaybookWizardProps {
  open: boolean
  onClose: () => void
}

export function CreatePlaybookWizard({ open, onClose }: CreatePlaybookWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const validation = createPlaybookSchema.safeParse({
      name,
      formalizationId: activeFormalizationId ?? '',
      notes: notes || undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.playbooks))
    const command = buildCreatePlaybookCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.playbooks).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'playbook', id: newId }])
      }
      setName('')
      setNotes('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [name, notes, activeFormalizationId, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setName('')
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
        aria-label="Create Playbook"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE PLAYBOOK
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Playbook name"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Additional notes about this playbook"
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
