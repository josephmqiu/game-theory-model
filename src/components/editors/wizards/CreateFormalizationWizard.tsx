import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateFormalizationCommand } from '../builders'
import { Button } from '../../design-system'
import { formalizationPurposes, abstractionLevels } from '../../../types/auxiliary'

const createFormalizationSchema = z.object({
  gameId: z.string().min(1, 'Game is required'),
  kind: z.enum(['normal_form', 'extensive_form']),
  purpose: z.enum(formalizationPurposes),
  abstractionLevel: z.enum(abstractionLevels),
})

interface CreateFormalizationWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateFormalizationWizard({ open, onClose }: CreateFormalizationWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const setActiveFormalization = useAppStore((s) => s.setActiveFormalization)

  const [kind, setKind] = useState<'normal_form' | 'extensive_form'>('extensive_form')
  const [purpose, setPurpose] = useState<(typeof formalizationPurposes)[number]>('explanatory')
  const [abstractionLevel, setAbstractionLevel] = useState<(typeof abstractionLevels)[number]>('medium')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const validation = createFormalizationSchema.safeParse({
      gameId: activeGameId ?? '',
      kind,
      purpose,
      abstractionLevel,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const command = buildCreateFormalizationCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const formId = Object.keys(result.store.formalizations).find(
        (id) =>
          result.store.formalizations[id]?.game_id === activeGameId &&
          result.store.formalizations[id]?.kind === kind,
      )
      if (formId) {
        setActiveFormalization(formId)
      }
      setKind('extensive_form')
      setPurpose('explanatory')
      setAbstractionLevel('medium')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [activeGameId, kind, purpose, abstractionLevel, dispatch, setActiveFormalization, onClose])

  const handleCancel = useCallback(() => {
    setKind('extensive_form')
    setPurpose('explanatory')
    setAbstractionLevel('medium')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  const gameName = activeGameId ? (canonical.games[activeGameId]?.name ?? activeGameId) : 'No game selected'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Formalization"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE FORMALIZATION
        </h2>

        <div className="text-xs font-mono text-text-muted mb-4">
          Game: {gameName}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'normal_form' | 'extensive_form')}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="extensive_form">Extensive Form</option>
              <option value="normal_form">Normal Form</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as (typeof formalizationPurposes)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {formalizationPurposes.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Abstraction Level</label>
            <select
              value={abstractionLevel}
              onChange={(e) => setAbstractionLevel(e.target.value as (typeof abstractionLevels)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {abstractionLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
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
