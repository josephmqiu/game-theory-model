import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateClaimCommand } from '../builders'
import { Button } from '../../design-system'

const createClaimSchema = z.object({
  statement: z.string().min(1, 'Statement is required'),
  confidence: z.number().min(0).max(1),
  basedOn: z.array(z.string().min(1)),
})

interface CreateClaimWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateClaimWizard({ open, onClose }: CreateClaimWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [statement, setStatement] = useState('')
  const [confidence, setConfidence] = useState('0.7')
  const [selectedObservations, setSelectedObservations] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const observations = Object.values(canonical.observations)

  const toggleObservation = useCallback((obsId: string) => {
    setSelectedObservations((prev) =>
      prev.includes(obsId)
        ? prev.filter((id) => id !== obsId)
        : [...prev, obsId],
    )
  }, [])

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(confidence)

    const validation = createClaimSchema.safeParse({
      statement,
      confidence: isNaN(parsed) ? -1 : parsed,
      basedOn: selectedObservations,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.claims))
    const command = buildCreateClaimCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.claims).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'claim', id: newId }])
      }
      setStatement('')
      setConfidence('0.7')
      setSelectedObservations([])
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [statement, confidence, selectedObservations, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setStatement('')
    setConfidence('0.7')
    setSelectedObservations([])
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Claim"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE CLAIM
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[80px] resize-y"
              placeholder="State the claim"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Confidence (0-1)</label>
            <input
              type="number"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              min="0"
              max="1"
              step="0.05"
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Based On (observations)</label>
            {observations.length === 0 ? (
              <p className="text-xs text-text-dim font-mono">No observations available</p>
            ) : (
              <div className="max-h-[120px] overflow-y-auto border border-border rounded p-2">
                {observations.map((obs) => (
                  <label
                    key={obs.id}
                    className="flex items-start gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedObservations.includes(obs.id)}
                      onChange={() => toggleObservation(obs.id)}
                      className="mt-0.5"
                    />
                    <span className="font-mono text-xs text-text-primary truncate">
                      {obs.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
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
