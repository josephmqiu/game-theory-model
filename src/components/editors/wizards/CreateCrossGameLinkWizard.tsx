import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateCrossGameLinkCommand } from '../builders'
import { Button } from '../../design-system'
import { crossGameLinkEffectTypes } from '../../../types/evidence'

const createCrossGameLinkSchema = z.object({
  sourceGameId: z.string().min(1, 'Source game is required'),
  targetGameId: z.string().min(1, 'Target game is required'),
  triggerRef: z.string().min(1, 'Trigger reference is required'),
  effectType: z.enum(crossGameLinkEffectTypes),
  targetRef: z.string().min(1, 'Target reference is required'),
  rationale: z.string().min(1, 'Rationale is required'),
  targetPlayerId: z.string().optional(),
})

interface CreateCrossGameLinkWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateCrossGameLinkWizard({ open, onClose }: CreateCrossGameLinkWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [sourceGameId, setSourceGameId] = useState('')
  const [targetGameId, setTargetGameId] = useState('')
  const [triggerRef, setTriggerRef] = useState('')
  const [effectType, setEffectType] = useState<(typeof crossGameLinkEffectTypes)[number]>('payoff_shift')
  const [targetRef, setTargetRef] = useState('')
  const [rationale, setRationale] = useState('')
  const [targetPlayerId, setTargetPlayerId] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const games = Object.values(canonical.games)

  const handleSubmit = useCallback(() => {
    const validation = createCrossGameLinkSchema.safeParse({
      sourceGameId,
      targetGameId,
      triggerRef,
      effectType,
      targetRef,
      rationale,
      targetPlayerId: targetPlayerId || undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.cross_game_links))
    const command = buildCreateCrossGameLinkCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.cross_game_links).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'cross_game_link', id: newId }])
      }
      setSourceGameId('')
      setTargetGameId('')
      setTriggerRef('')
      setEffectType('payoff_shift')
      setTargetRef('')
      setRationale('')
      setTargetPlayerId('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [sourceGameId, targetGameId, triggerRef, effectType, targetRef, rationale, targetPlayerId, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setSourceGameId('')
    setTargetGameId('')
    setTriggerRef('')
    setEffectType('payoff_shift')
    setTargetRef('')
    setRationale('')
    setTargetPlayerId('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Cross-Game Link"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE CROSS-GAME LINK
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Source Game</label>
            <select
              value={sourceGameId}
              onChange={(e) => setSourceGameId(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select source game...</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Target Game</label>
            <select
              value={targetGameId}
              onChange={(e) => setTargetGameId(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select target game...</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Effect Type</label>
            <select
              value={effectType}
              onChange={(e) => setEffectType(e.target.value as (typeof crossGameLinkEffectTypes)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {crossGameLinkEffectTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Trigger Reference (entity ID)</label>
            <input
              type="text"
              value={triggerRef}
              onChange={(e) => setTriggerRef(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="e.g. edge or node ID that triggers the link"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Target Reference (entity ID)</label>
            <input
              type="text"
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="e.g. node or player ID affected"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Target Player (optional)</label>
            <input
              type="text"
              value={targetPlayerId}
              onChange={(e) => setTargetPlayerId(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Player ID (required for some effect types)"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Rationale</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Why does this cross-game link exist?"
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
