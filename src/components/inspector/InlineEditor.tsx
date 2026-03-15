import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Check, XIcon } from 'lucide-react'

import { useAppStore } from '../../store'
import type { EntityRef, CanonicalStore, EntityType } from '../../types/canonical'
import type { Command } from '../../engine/commands'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  options?: ReadonlyArray<string>
}

function getFieldDefs(entityType: EntityType): FieldDef[] {
  switch (entityType) {
    case 'game':
      return [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'status', label: 'Status', type: 'select', options: ['active', 'paused', 'resolved'] },
      ]
    case 'player':
      return [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'type', label: 'Type', type: 'select', options: ['state', 'organization', 'individual', 'coalition', 'market', 'public'] },
      ]
    case 'game_node':
      return [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]
    case 'game_edge':
      return [
        { key: 'label', label: 'Label', type: 'text' },
      ]
    case 'source':
      return [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'url', label: 'URL', type: 'text' },
        { key: 'publisher', label: 'Publisher', type: 'text' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]
    case 'assumption':
      return [
        { key: 'statement', label: 'Statement', type: 'textarea' },
        { key: 'type', label: 'Type', type: 'select', options: ['structural', 'behavioral', 'payoff', 'timing', 'belief', 'simplification'] },
        { key: 'sensitivity', label: 'Sensitivity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      ]
    case 'claim':
      return [
        { key: 'statement', label: 'Statement', type: 'textarea' },
      ]
    case 'inference':
      return [
        { key: 'statement', label: 'Statement', type: 'textarea' },
      ]
    default:
      return []
  }
}

function getEntityValues(
  canonical: CanonicalStore,
  entityRef: EntityRef,
): Record<string, unknown> | null {
  switch (entityRef.type) {
    case 'game':
      return canonical.games[entityRef.id] ?? null
    case 'player':
      return canonical.players[entityRef.id] ?? null
    case 'game_node':
      return canonical.nodes[entityRef.id] ?? null
    case 'game_edge':
      return canonical.edges[entityRef.id] ?? null
    case 'source':
      return canonical.sources[entityRef.id] ?? null
    case 'assumption':
      return canonical.assumptions[entityRef.id] ?? null
    case 'claim':
      return canonical.claims[entityRef.id] ?? null
    case 'inference':
      return canonical.inferences[entityRef.id] ?? null
    case 'formalization':
      return canonical.formalizations[entityRef.id] ?? null
    default:
      return null
  }
}

function buildUpdateCommand(
  entityType: EntityType,
  id: string,
  changes: Record<string, unknown>,
): Command {
  return {
    kind: `update_${entityType}` as Command['kind'],
    payload: { id, ...changes },
  } as Command
}

interface InlineEditorProps {
  entityRef: EntityRef
  canonical: CanonicalStore
}

export function InlineEditor({ entityRef, canonical }: InlineEditorProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)

  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])

  const fieldDefs = getFieldDefs(entityRef.type)
  const entity = getEntityValues(canonical, entityRef)

  const startEditing = useCallback(() => {
    if (!entity) return

    const initial: Record<string, string> = {}
    for (const field of fieldDefs) {
      const val = (entity as Record<string, unknown>)[field.key]
      initial[field.key] = val != null ? String(val) : ''
    }
    setValues(initial)
    setErrors([])
    setEditing(true)
  }, [entity, fieldDefs])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setValues({})
    setErrors([])
  }, [])

  const saveEditing = useCallback(() => {
    if (!entity) return

    const changes: Record<string, unknown> = {}
    let hasChanges = false

    for (const field of fieldDefs) {
      const currentVal = (entity as Record<string, unknown>)[field.key]
      const newVal = values[field.key] ?? ''
      const currentStr = currentVal != null ? String(currentVal) : ''

      if (newVal !== currentStr) {
        changes[field.key] = newVal || undefined
        hasChanges = true
      }
    }

    if (!hasChanges) {
      setEditing(false)
      return
    }

    const command = buildUpdateCommand(entityRef.type, entityRef.id, changes)
    const result = dispatch(command)

    if (result.status === 'committed') {
      setEditing(false)
      setValues({})
      setErrors([])
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [entity, fieldDefs, values, entityRef, dispatch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelEditing()
      }
    },
    [cancelEditing],
  )

  if (!entity || fieldDefs.length === 0) {
    return null
  }

  if (!editing) {
    return (
      <button
        onClick={startEditing}
        className="flex items-center gap-1 text-[11px] font-mono text-accent hover:text-text-primary transition-colors mt-3"
        data-testid="inline-edit-button"
      >
        <Pencil size={10} />
        Edit
      </button>
    )
  }

  return (
    <div className="mt-3 border-t border-border pt-3" onKeyDown={handleKeyDown}>
      <div className="flex flex-col gap-3">
        {fieldDefs.map((field) => (
          <div key={field.key}>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wide mb-1">
              {field.label}
            </label>
            {field.type === 'text' && (
              <input
                type="text"
                value={values[field.key] ?? ''}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
                className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              />
            )}
            {field.type === 'textarea' && (
              <textarea
                value={values[field.key] ?? ''}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
                className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent min-h-[48px] resize-y"
              />
            )}
            {field.type === 'select' && field.options && (
              <select
                value={values[field.key] ?? ''}
                onChange={(e) =>
                  setValues({ ...values, [field.key]: e.target.value })
                }
                className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="text-warning text-[10px] font-mono mt-2">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={saveEditing}
          className="flex items-center gap-1 px-2 py-1 bg-accent text-bg-page rounded font-mono text-[10px] font-bold hover:opacity-90"
        >
          <Check size={10} />
          Save
        </button>
        <button
          onClick={cancelEditing}
          className="flex items-center gap-1 px-2 py-1 border border-border text-text-muted rounded font-mono text-[10px] hover:text-text-primary"
        >
          <XIcon size={10} />
          Cancel
        </button>
      </div>
    </div>
  )
}
