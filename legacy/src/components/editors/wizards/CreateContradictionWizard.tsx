import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateContradictionCommand } from '../builders'
import { Button } from '../../design-system'
import { contradictionResolutionStatuses } from '../../../types/evidence'

const createContradictionSchema = z.object({
  leftRef: z.string().min(1, 'First claim is required'),
  rightRef: z.string().min(1, 'Second claim is required'),
  description: z.string().min(1, 'Description is required'),
  resolutionStatus: z.enum(contradictionResolutionStatuses),
  notes: z.string().optional(),
})

interface CreateContradictionWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateContradictionWizard({ open, onClose }: CreateContradictionWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [leftRef, setLeftRef] = useState('')
  const [rightRef, setRightRef] = useState('')
  const [description, setDescription] = useState('')
  const [resolutionStatus, setResolutionStatus] = useState<(typeof contradictionResolutionStatuses)[number]>('open')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const claims = Object.values(canonical.claims)

  const handleSubmit = useCallback(() => {
    const validation = createContradictionSchema.safeParse({
      leftRef,
      rightRef,
      description,
      resolutionStatus,
      notes: notes || undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.contradictions))
    const command = buildCreateContradictionCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.contradictions).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'contradiction', id: newId }])
      }
      setLeftRef('')
      setRightRef('')
      setDescription('')
      setResolutionStatus('open')
      setNotes('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [leftRef, rightRef, description, resolutionStatus, notes, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setLeftRef('')
    setRightRef('')
    setDescription('')
    setResolutionStatus('open')
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
        aria-label="Create Contradiction"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE CONTRADICTION
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Claim A</label>
            <select
              value={leftRef}
              onChange={(e) => setLeftRef(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select first claim...</option>
              {claims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.statement}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Claim B</label>
            <select
              value={rightRef}
              onChange={(e) => setRightRef(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select second claim...</option>
              {claims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.statement}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Describe how these claims contradict"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Resolution Status</label>
            <select
              value={resolutionStatus}
              onChange={(e) => setResolutionStatus(e.target.value as (typeof contradictionResolutionStatuses)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {contradictionResolutionStatuses.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[48px] resize-y"
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
