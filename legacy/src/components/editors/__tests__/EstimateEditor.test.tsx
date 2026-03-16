import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { EstimateEditor } from '../EstimateEditor'
import type { EstimateValue } from '../../../types/estimates'

function makeEstimate(overrides: Partial<EstimateValue> = {}): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value: 5,
    confidence: 0.8,
    rationale: 'Standard payoff estimate',
    source_claims: ['c1'],
    supporting_inferences: ['inf1'],
    assumptions: ['a1'],
    latent_factors: ['lf1'],
    ...overrides,
  }
}

describe('EstimateEditor', () => {
  it('rejects save without rationale', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <EstimateEditor
        existing={makeEstimate({ rationale: '' })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()

    fireEvent.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('preserves provenance fields on save (merge semantics)', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const existing = makeEstimate()

    render(
      <EstimateEditor
        existing={existing}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    // Modify confidence via range slider
    const confidenceSlider = screen.getByRole('slider')
    fireEvent.change(confidenceSlider, { target: { value: '0.95' } })

    // Click save
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0]![0] as EstimateValue

    // Edited field should be updated
    expect(saved.confidence).toBe(0.95)

    // Provenance fields should be preserved from existing
    expect(saved.supporting_inferences).toEqual(['inf1'])
    expect(saved.assumptions).toEqual(['a1'])
    expect(saved.latent_factors).toEqual(['lf1'])

    // Original fields not edited should remain
    expect(saved.value).toBe(5)
    expect(saved.rationale).toBe('Standard payoff estimate')
  })

  it('shows validation error for empty rationale', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <EstimateEditor
        existing={makeEstimate({ rationale: '' })}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByTestId('rationale-error')).toHaveTextContent(
      'Rationale must not be empty',
    )
  })

  it('enables save when rationale is provided', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <EstimateEditor
        existing={makeEstimate()}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    const saveButton = screen.getByText('Save')
    expect(saveButton).not.toBeDisabled()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <EstimateEditor
        existing={makeEstimate()}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('displays read-only provenance fields', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <EstimateEditor
        existing={makeEstimate()}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByText('Supporting Inferences')).toBeInTheDocument()
    expect(screen.getByText('inf1')).toBeInTheDocument()
    expect(screen.getByText('Assumptions')).toBeInTheDocument()
    expect(screen.getByText('a1')).toBeInTheDocument()
    expect(screen.getByText('Latent Factors')).toBeInTheDocument()
    expect(screen.getByText('lf1')).toBeInTheDocument()
  })
})
