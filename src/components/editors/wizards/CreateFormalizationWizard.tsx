import { useCallback, useEffect, useMemo, useState } from 'react'
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
  rowPlayerId: z.string().optional(),
  colPlayerId: z.string().optional(),
  rowStrategies: z.array(z.string()).optional(),
  colStrategies: z.array(z.string()).optional(),
}).superRefine((value, ctx) => {
  if (value.kind !== 'normal_form') {
    return
  }

  if (!value.rowPlayerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rowPlayerId'],
      message: 'Row player is required for normal-form setup',
    })
  }

  if (!value.colPlayerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['colPlayerId'],
      message: 'Column player is required for normal-form setup',
    })
  }

  if (value.rowPlayerId && value.colPlayerId && value.rowPlayerId === value.colPlayerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['colPlayerId'],
      message: 'Normal-form setup requires two distinct players',
    })
  }

  if (!value.rowStrategies || value.rowStrategies.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rowStrategies'],
      message: 'Add at least one row strategy',
    })
  }

  if (!value.colStrategies || value.colStrategies.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['colStrategies'],
      message: 'Add at least one column strategy',
    })
  }
})

interface CreateFormalizationWizardProps {
  open: boolean
  onClose: () => void
}

function parseStrategies(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
}

export function CreateFormalizationWizard({ open, onClose }: CreateFormalizationWizardProps): ReactNode {
  const dispatch = useAppStore((s) => s.dispatch)
  const canonical = useAppStore((s) => s.canonical)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const setActiveFormalization = useAppStore((s) => s.setActiveFormalization)

  const [kind, setKind] = useState<'normal_form' | 'extensive_form'>('extensive_form')
  const [purpose, setPurpose] = useState<(typeof formalizationPurposes)[number]>('explanatory')
  const [abstractionLevel, setAbstractionLevel] = useState<(typeof abstractionLevels)[number]>('moderate')
  const [rowPlayerId, setRowPlayerId] = useState('')
  const [colPlayerId, setColPlayerId] = useState('')
  const [rowStrategiesText, setRowStrategiesText] = useState('Cooperate, Defect')
  const [colStrategiesText, setColStrategiesText] = useState('Cooperate, Defect')
  const [errors, setErrors] = useState<string[]>([])

  const activeGame = activeGameId ? canonical.games[activeGameId] : null
  const availablePlayers = useMemo(
    () => (activeGame?.players ?? []).map((id) => ({ id, name: canonical.players[id]?.name ?? id })),
    [activeGame, canonical.players],
  )

  useEffect(() => {
    if (availablePlayers.length >= 2) {
      setRowPlayerId((current) => current || availablePlayers[0]!.id)
      setColPlayerId((current) => current || availablePlayers[1]!.id)
    }
  }, [availablePlayers])

  const handleSubmit = useCallback(() => {
    const validation = createFormalizationSchema.safeParse({
      gameId: activeGameId ?? '',
      kind,
      purpose,
      abstractionLevel,
      rowPlayerId: kind === 'normal_form' ? rowPlayerId : undefined,
      colPlayerId: kind === 'normal_form' ? colPlayerId : undefined,
      rowStrategies: kind === 'normal_form' ? parseStrategies(rowStrategiesText) : undefined,
      colStrategies: kind === 'normal_form' ? parseStrategies(colStrategiesText) : undefined,
    })

    if (!validation.success) {
      setErrors(validation.error.issues.map((issue) => issue.message))
      return
    }

    const buildResult = buildCreateFormalizationCommand(validation.data)
    const result = dispatch(buildResult)

    if (result.status === 'committed') {
      setActiveFormalization(buildResult.formalizationId)
      setKind('extensive_form')
      setPurpose('explanatory')
      setAbstractionLevel('moderate')
      setRowStrategiesText('Cooperate, Defect')
      setColStrategiesText('Cooperate, Defect')
      setErrors([])
      onClose()
    } else if (result.status === 'rejected') {
      setErrors(result.errors)
    }
  }, [
    activeGameId,
    kind,
    purpose,
    abstractionLevel,
    rowPlayerId,
    colPlayerId,
    rowStrategiesText,
    colStrategiesText,
    dispatch,
    setActiveFormalization,
    onClose,
  ])

  const handleCancel = useCallback(() => {
    setKind('extensive_form')
    setPurpose('explanatory')
    setAbstractionLevel('moderate')
    setRowStrategiesText('Cooperate, Defect')
    setColStrategiesText('Cooperate, Defect')
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
        onKeyDown={(event) => { if (event.key === 'Escape') handleCancel() }}
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
              onChange={(event) => setKind(event.target.value as 'normal_form' | 'extensive_form')}
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
              onChange={(event) => setPurpose(event.target.value as (typeof formalizationPurposes)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {formalizationPurposes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted mb-1">Abstraction Level</label>
            <select
              value={abstractionLevel}
              onChange={(event) => setAbstractionLevel(event.target.value as (typeof abstractionLevels)[number])}
              className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {abstractionLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {kind === 'normal_form' && (
            <>
              <div className="rounded border border-border bg-bg-surface px-3 py-2 text-xs text-text-muted">
                Normal-form setup requires two players and seed strategies so the matrix is immediately editable.
              </div>

              <div>
                <label className="block font-mono text-xs text-text-muted mb-1">Row Player</label>
                <select
                  value={rowPlayerId}
                  onChange={(event) => setRowPlayerId(event.target.value)}
                  className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select row player...</option>
                  {availablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-text-muted mb-1">Column Player</label>
                <select
                  value={colPlayerId}
                  onChange={(event) => setColPlayerId(event.target.value)}
                  className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select column player...</option>
                  {availablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-text-muted mb-1">Row Strategies</label>
                <input
                  type="text"
                  value={rowStrategiesText}
                  onChange={(event) => setRowStrategiesText(event.target.value)}
                  className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
                  placeholder="Comma-separated strategies"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-text-muted mb-1">Column Strategies</label>
                <input
                  type="text"
                  value={colStrategiesText}
                  onChange={(event) => setColStrategiesText(event.target.value)}
                  className="w-full bg-bg-surface border border-border rounded px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-accent"
                  placeholder="Comma-separated strategies"
                />
              </div>
            </>
          )}

          {errors.length > 0 && (
            <div className="text-warning text-xs font-mono">
              {errors.map((err, index) => (
                <p key={index}>{err}</p>
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
