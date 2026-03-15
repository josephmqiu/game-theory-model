import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateNodeCommand } from '../builders'
import { Button } from '../../design-system'
import { gameNodeKinds } from '../../../types/canonical'

const createNodeSchema = z.object({
  formalizationId: z.string().min(1, 'Formalization is required'),
  label: z.string().min(1, 'Label is required'),
  type: z.enum(gameNodeKinds),
  actorKind: z.enum(['player', 'nature', 'environment']),
  playerId: z.string().optional(),
  description: z.string().optional(),
})

interface CreateNodeWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateNodeWizard({ open, onClose }: CreateNodeWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [label, setLabel] = useState('')
  const [type, setType] = useState<(typeof gameNodeKinds)[number]>('decision')
  const [actorKind, setActorKind] = useState<'player' | 'nature' | 'environment'>('player')
  const [playerId, setPlayerId] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const game = activeGameId ? canonical.games[activeGameId] : null
  const gamePlayers = game?.players ?? []

  const handleSubmit = useCallback(() => {
    const validation = createNodeSchema.safeParse({
      formalizationId: activeFormalizationId ?? '',
      label,
      type,
      actorKind,
      playerId: actorKind === 'player' ? playerId : undefined,
      description: description || undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.nodes))
    const command = buildCreateNodeCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.nodes).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'game_node', id: newId }])
      }
      setLabel('')
      setType('decision')
      setActorKind('player')
      setPlayerId('')
      setDescription('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [activeFormalizationId, label, type, actorKind, playerId, description, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setLabel('')
    setType('decision')
    setActorKind('player')
    setPlayerId('')
    setDescription('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Node"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE NODE
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Node label"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Node Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof gameNodeKinds)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {gameNodeKinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Actor</label>
            <select
              value={actorKind}
              onChange={(e) => setActorKind(e.target.value as 'player' | 'nature' | 'environment')}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="player">Player</option>
              <option value="nature">Nature</option>
              <option value="environment">Environment</option>
            </select>
          </div>

          {actorKind === 'player' && gamePlayers.length > 0 && (
            <div>
              <label className="block font-mono text-xs text-text-muted mb-1">Player</label>
              <select
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select player...</option>
                {gamePlayers.map((pid) => (
                  <option key={pid} value={pid}>
                    {canonical.players[pid]?.name ?? pid}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent min-h-[60px] resize-y"
              placeholder="Optional description"
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
