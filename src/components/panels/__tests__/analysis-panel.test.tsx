// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useAnalysisStore } from '@/stores/analysis-store'
import AnalysisPanel from '@/components/panels/analysis-panel'

const analysisPanelPath = join(
  process.cwd(),
  'src/components/panels/analysis-panel.tsx',
)

describe('AnalysisPanel', () => {
  beforeEach(() => {
    useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
  })

  it('updates analysis title, player names, and strategy names', () => {
    render(<AnalysisPanel />)

    fireEvent.change(screen.getByLabelText('Analysis title'), {
      target: { value: 'Pricing Game' },
    })
    fireEvent.change(screen.getByLabelText('Player 1 name'), {
      target: { value: 'Incumbent' },
    })
    fireEvent.change(screen.getByLabelText('Player 1 strategy 1'), {
      target: { value: 'High price' },
    })

    const analysis = useAnalysisStore.getState().analysis
    expect(analysis.name).toBe('Pricing Game')
    expect(analysis.players[0].name).toBe('Incumbent')
    expect(analysis.players[0].strategies[0].name).toBe('High price')
  })

  it('round-trips payoff inputs into the analysis store', () => {
    render(<AnalysisPanel />)

    fireEvent.change(
      screen.getByLabelText('Player 1 payoff for Strategy 1 vs Strategy 1'),
      {
        target: { value: '7' },
      },
    )
    fireEvent.change(
      screen.getByLabelText('Player 2 payoff for Strategy 1 vs Strategy 1'),
      {
        target: { value: '3' },
      },
    )

    expect(useAnalysisStore.getState().analysis.profiles[0].payoffs).toEqual([
      7,
      3,
    ])
  })

  it('shows validation state for incomplete and invalid inputs', () => {
    render(<AnalysisPanel />)

    expect(screen.getByTestId('analysis-status').textContent).toContain(
      '4 payoff cells still incomplete',
    )

    fireEvent.change(screen.getByLabelText('Player 1 name'), {
      target: { value: '   ' },
    })

    expect(screen.getByText('Player 1 name is required.')).not.toBeNull()
    expect(screen.getByTestId('analysis-status').textContent).toContain(
      '1 issue to fix',
    )
  })

  it('drops the Phase 2 memory-only copy from the shell text', () => {
    const source = readFileSync(analysisPanelPath, 'utf8')

    expect(source).not.toContain(
      'Phase 2 keeps this analysis in session memory only.',
    )
    expect(source).not.toContain(
      'Save, load, solver logic, and AI-assisted workflows are intentionally deferred to later phases.',
    )
  })
})
