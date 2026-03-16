import { useState, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'

import type { EstimateValue } from '../../types/estimates'
import { estimateRepresentations } from '../../types/estimates'
import { Button } from '../design-system'

interface EstimateEditorProps {
  existing: EstimateValue
  onSave: (updated: EstimateValue) => void
  onCancel: () => void
}

interface EditorFields {
  value: number | undefined
  representation: EstimateValue['representation']
  min: number | undefined
  max: number | undefined
  confidence: number
  rationale: string
  source_claims: readonly string[]
}

function initializeFields(existing: EstimateValue): EditorFields {
  return {
    value: existing.value,
    representation: existing.representation,
    min: existing.min,
    max: existing.max,
    confidence: existing.confidence,
    rationale: existing.rationale,
    source_claims: existing.source_claims,
  }
}

export function EstimateEditor({
  existing,
  onSave,
  onCancel,
}: EstimateEditorProps): ReactNode {
  const [fields, setFields] = useState<EditorFields>(() => initializeFields(existing))

  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (!fields.rationale.trim()) {
      errors.push('Rationale is required')
    }

    if (fields.confidence < 0 || fields.confidence > 1) {
      errors.push('Confidence must be between 0 and 1')
    }

    return errors
  }, [fields.rationale, fields.confidence])

  const isValid = validationErrors.length === 0

  const updateField = useCallback(
    <K extends keyof EditorFields>(key: K, value: EditorFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleSave = useCallback(() => {
    if (!isValid) return

    // Merge semantics: preserve existing provenance fields
    const updated: EstimateValue = {
      ...existing,
      value: fields.value,
      representation: fields.representation,
      min: fields.min,
      max: fields.max,
      confidence: fields.confidence,
      rationale: fields.rationale,
      source_claims: [...fields.source_claims],
    }

    onSave(updated)
  }, [existing, fields, isValid, onSave])

  const handleSourceClaimsChange = useCallback(
    (text: string) => {
      const claims = text
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      updateField('source_claims', claims)
    },
    [updateField],
  )

  return (
    <div
      className="bg-bg-card border border-border rounded p-4"
      data-testid="estimate-editor"
    >
      <h3 className="text-xs font-mono font-bold uppercase tracking-wide text-text-muted mb-4">
        Edit Estimate
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Value</label>
          <input
            type="number"
            className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono"
            value={fields.value ?? ''}
            onChange={(e) =>
              updateField(
                'value',
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">Representation</label>
          <select
            className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono"
            value={fields.representation}
            onChange={(e) =>
              updateField(
                'representation',
                e.target.value as EstimateValue['representation'],
              )
            }
          >
            {estimateRepresentations.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(fields.representation === 'interval_estimate') && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Min</label>
            <input
              type="number"
              className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono"
              value={fields.min ?? ''}
              onChange={(e) =>
                updateField(
                  'min',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Max</label>
            <input
              type="number"
              className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono"
              value={fields.max ?? ''}
              onChange={(e) =>
                updateField(
                  'max',
                  e.target.value === '' ? undefined : Number(e.target.value),
                )
              }
            />
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs text-text-muted mb-1">
          Confidence ({fields.confidence.toFixed(2)})
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          className="w-full"
          value={fields.confidence}
          onChange={(e) => updateField('confidence', Number(e.target.value))}
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs text-text-muted mb-1">
          Rationale <span className="text-warning">*</span>
        </label>
        <textarea
          className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary min-h-[60px] resize-y"
          value={fields.rationale}
          onChange={(e) => updateField('rationale', e.target.value)}
          data-testid="rationale-input"
        />
        {!fields.rationale.trim() && (
          <div className="text-xs text-warning mt-1" data-testid="rationale-error">
            Rationale must not be empty
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="block text-xs text-text-muted mb-1">
          Source Claims (comma-separated IDs)
        </label>
        <input
          type="text"
          className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono"
          value={fields.source_claims.join(', ')}
          onChange={(e) => handleSourceClaimsChange(e.target.value)}
        />
      </div>

      {/* Read-only provenance fields */}
      {existing.supporting_inferences && existing.supporting_inferences.length > 0 && (
        <div className="mb-2">
          <label className="block text-xs text-text-muted mb-1">
            Supporting Inferences
          </label>
          <div className="text-xs font-mono text-text-muted">
            {existing.supporting_inferences.join(', ')}
          </div>
        </div>
      )}

      {existing.assumptions && existing.assumptions.length > 0 && (
        <div className="mb-2">
          <label className="block text-xs text-text-muted mb-1">Assumptions</label>
          <div className="text-xs font-mono text-text-muted">
            {existing.assumptions.join(', ')}
          </div>
        </div>
      )}

      {existing.latent_factors && existing.latent_factors.length > 0 && (
        <div className="mb-2">
          <label className="block text-xs text-text-muted mb-1">Latent Factors</label>
          <div className="text-xs font-mono text-text-muted">
            {existing.latent_factors.join(', ')}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <Button variant="primary" onClick={handleSave} disabled={!isValid}>
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
