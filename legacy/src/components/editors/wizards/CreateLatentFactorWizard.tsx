import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateLatentFactorCommand } from '../builders'
import { Button } from '../../design-system'

const latentFactorStateSchema = z.object({
  label: z.string().min(1, 'State label is required'),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
})

const createLatentFactorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  states: z.array(latentFactorStateSchema).min(1, 'At least one state is required'),
  affects: z.array(z.string().min(1)),
})

interface CreateLatentFactorWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateLatentFactorWizard({ open, onClose }: CreateLatentFactorWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stateLabel, setStateLabel] = useState('')
  const [stateProbability, setStateProbability] = useState('0.5')
  const [stateConfidence, setStateConfidence] = useState('0.7')
  const [states, setStates] = useState<Array<{ label: string; probability: number; confidence: number }>>([])
  const [errors, setErrors] = useState<string[]>([])

  const handleAddState = useCallback(() => {
    const prob = parseFloat(stateProbability)
    const conf = parseFloat(stateConfidence)
    if (!stateLabel.trim() || isNaN(prob) || isNaN(conf)) return

    setStates((prev) => [...prev, { label: stateLabel.trim(), probability: prob, confidence: conf }])
    setStateLabel('')
    setStateProbability('0.5')
    setStateConfidence('0.7')
  }, [stateLabel, stateProbability, stateConfidence])

  const handleRemoveState = useCallback((index: number) => {
    setStates((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(() => {
    const validation = createLatentFactorSchema.safeParse({
      name,
      description: description || undefined,
      states,
      affects: [],
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.latent_factors))
    const command = buildCreateLatentFactorCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.latent_factors).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'latent_factor', id: newId }])
      }
      setName('')
      setDescription('')
      setStates([])
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [name, description, states, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setName('')
    setDescription('')
    setStates([])
    setStateLabel('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Latent Factor"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE LATENT FACTOR
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Factor name"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Describe this latent factor"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">States</label>
            {states.length > 0 && (
              <div className="border border-border rounded p-2 mb-2">
                {states.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="font-mono text-xs text-text-primary">
                      {s.label} (p={s.probability}, c={s.confidence})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveState(i)}
                      className="text-xs text-warning font-mono hover:underline"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={stateLabel}
                onChange={(e) => setStateLabel(e.target.value)}
                placeholder="State label"
                className="flex-1 bg-bg-surface border border-border rounded px-2 py-1 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                value={stateProbability}
                onChange={(e) => setStateProbability(e.target.value)}
                min="0"
                max="1"
                step="0.1"
                placeholder="prob"
                className="w-16 bg-bg-surface border border-border rounded px-2 py-1 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                value={stateConfidence}
                onChange={(e) => setStateConfidence(e.target.value)}
                min="0"
                max="1"
                step="0.1"
                placeholder="conf"
                className="w-16 bg-bg-surface border border-border rounded px-2 py-1 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              />
              <Button variant="secondary" onClick={handleAddState}>+</Button>
            </div>
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
