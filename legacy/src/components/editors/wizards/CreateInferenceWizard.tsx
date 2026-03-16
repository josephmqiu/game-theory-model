import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateInferenceCommand } from '../builders'
import { Button } from '../../design-system'

const createInferenceSchema = z.object({
  statement: z.string().min(1, 'Statement is required'),
  derivedFrom: z.array(z.string().min(1)).min(1, 'At least one supporting claim is required'),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1, 'Rationale is required'),
})

interface CreateInferenceWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateInferenceWizard({ open, onClose }: CreateInferenceWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [statement, setStatement] = useState('')
  const [selectedClaims, setSelectedClaims] = useState<string[]>([])
  const [confidence, setConfidence] = useState('0.7')
  const [rationale, setRationale] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const claims = Object.values(canonical.claims)

  const toggleClaim = useCallback((claimId: string) => {
    setSelectedClaims((prev) =>
      prev.includes(claimId)
        ? prev.filter((id) => id !== claimId)
        : [...prev, claimId],
    )
  }, [])

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(confidence)

    const validation = createInferenceSchema.safeParse({
      statement,
      derivedFrom: selectedClaims,
      confidence: isNaN(parsed) ? -1 : parsed,
      rationale,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.inferences))
    const command = buildCreateInferenceCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.inferences).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'inference', id: newId }])
      }
      setStatement('')
      setSelectedClaims([])
      setConfidence('0.7')
      setRationale('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [statement, selectedClaims, confidence, rationale, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setStatement('')
    setSelectedClaims([])
    setConfidence('0.7')
    setRationale('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Inference"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE INFERENCE
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[80px] resize-y"
              placeholder="State the inference"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Derived From (claims)</label>
            {claims.length === 0 ? (
              <p className="text-xs text-text-dim font-mono">No claims available</p>
            ) : (
              <div className="max-h-[120px] overflow-y-auto border border-border rounded p-2">
                {claims.map((claim) => (
                  <label
                    key={claim.id}
                    className="flex items-start gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClaims.includes(claim.id)}
                      onChange={() => toggleClaim(claim.id)}
                      className="mt-0.5"
                    />
                    <span className="font-mono text-xs text-text-primary truncate">
                      {claim.statement}
                    </span>
                  </label>
                ))}
              </div>
            )}
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
            <label className="block font-mono text-xs text-text-muted mb-1">Rationale</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Why does this inference follow from the claims?"
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
