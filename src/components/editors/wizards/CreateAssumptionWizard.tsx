import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateAssumptionCommand } from '../builders'
import { Button } from '../../design-system'
import { assumptionTypes, assumptionSensitivities } from '../../../types/evidence'

const createAssumptionSchema = z.object({
  statement: z.string().min(1, 'Statement is required'),
  type: z.enum(assumptionTypes),
  sensitivity: z.enum(assumptionSensitivities),
  confidence: z.number().min(0).max(1),
})

interface CreateAssumptionWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateAssumptionWizard({ open, onClose }: CreateAssumptionWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [statement, setStatement] = useState('')
  const [type, setType] = useState<(typeof assumptionTypes)[number]>('structural')
  const [sensitivity, setSensitivity] = useState<(typeof assumptionSensitivities)[number]>('medium')
  const [confidence, setConfidence] = useState('0.7')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(confidence)

    const validation = createAssumptionSchema.safeParse({
      statement,
      type,
      sensitivity,
      confidence: isNaN(parsed) ? -1 : parsed,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const command = buildCreateAssumptionCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const assumptionId = Object.keys(result.store.assumptions).find(
        (id) => result.store.assumptions[id]?.statement === statement,
      )
      if (assumptionId) {
        setInspectedRefs([{ type: 'assumption', id: assumptionId }])
      }
      setStatement('')
      setType('structural')
      setSensitivity('medium')
      setConfidence('0.7')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [statement, type, sensitivity, confidence, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setStatement('')
    setType('structural')
    setSensitivity('medium')
    setConfidence('0.7')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Assumption"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE ASSUMPTION
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[80px] resize-y"
              placeholder="State the assumption clearly"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof assumptionTypes)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {assumptionTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Sensitivity</label>
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(e.target.value as (typeof assumptionSensitivities)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {assumptionSensitivities.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
