import { useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { useAppStore } from '../../../store'
import { buildCreateEdgeCommand } from '../builders'
import { Button } from '../../design-system'

const createEdgeSchema = z.object({
  formalizationId: z.string().min(1, 'Formalization is required'),
  from: z.string().min(1, 'Source node is required'),
  to: z.string().min(1, 'Target node is required'),
  label: z.string().min(1, 'Label is required'),
})

interface CreateEdgeWizardProps {
  open: boolean
  onClose: () => void
}

export function CreateEdgeWizard({ open, onClose }: CreateEdgeWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [label, setLabel] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const availableNodes = useMemo(() => {
    if (!activeFormalizationId) return []
    return Object.values(canonical.nodes).filter(
      (n) => n.formalization_id === activeFormalizationId,
    )
  }, [canonical.nodes, activeFormalizationId])

  const handleSubmit = useCallback(() => {
    const validation = createEdgeSchema.safeParse({
      formalizationId: activeFormalizationId ?? '',
      from,
      to,
      label,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((i) => i.message))
      return
    }

    const keysBefore = new Set(Object.keys(canonical.edges))
    const command = buildCreateEdgeCommand(validation.data)
    const result = dispatch(command)

    if (result.status === 'committed') {
      const newId = Object.keys(result.store.edges).find((id) => !keysBefore.has(id))
      if (newId) {
        setInspectedRefs([{ type: 'game_edge', id: newId }])
      }
      setFrom('')
      setTo('')
      setLabel('')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [activeFormalizationId, from, to, label, canonical, dispatch, setInspectedRefs, onClose])

  const handleCancel = useCallback(() => {
    setFrom('')
    setTo('')
    setLabel('')
    setErrors([])
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-bg-card border border-border rounded p-6 w-[480px] max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-label="Create Edge"
        onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
      >
        <h2 className="font-mono font-bold text-sm tracking-widest text-text-primary mb-4">
          CREATE EDGE
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="Action / transition label"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">From Node</label>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select source node...</option>
              {availableNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">To Node</label>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Select target node...</option>
              {availableNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.label}</option>
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
