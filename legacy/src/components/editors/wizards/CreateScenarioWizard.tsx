import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateScenarioCommand } from '../builders'
import { Button } from '../../design-system'
import { scenarioProbabilityModels } from '../../../types/evidence'

const createScenarioSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  formalizationId: z.string().min(1, 'Formalization is required'),
  narrative: z.string().min(1, 'Narrative is required'),
  probabilityModel: z.enum(scenarioProbabilityModels),
})

interface CreateScenarioWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateScenarioWizard({ open, onClose }: CreateScenarioWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [name, setName] = useState('')
  const [narrative, setNarrative] = useState('')
  const [probabilityModel, setProbabilityModel] = useState<(typeof scenarioProbabilityModels)[number]>('independent')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const validation = createScenarioSchema.safeParse({
      name,
      formalizationId: activeFormalizationId ?? '',
      narrative,
      probabilityModel,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.scenarios))
    const command = buildCreateScenarioCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.scenarios).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'scenario', id: newId }])
      }
      setName('')
      setNarrative('')
      setProbabilityModel('independent')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [name, narrative, probabilityModel, activeFormalizationId, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setName('')
    setNarrative('')
    setProbabilityModel('independent')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Scenario"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE SCENARIO
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Scenario name"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Probability Model</label>
            <select
              value={probabilityModel}
              onChange={(e) => setProbabilityModel(e.target.value as (typeof scenarioProbabilityModels)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {scenarioProbabilityModels.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Narrative</label>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[100px] resize-y"
              placeholder="Describe how this scenario unfolds"
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
