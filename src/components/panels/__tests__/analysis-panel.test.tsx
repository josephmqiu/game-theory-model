// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useAnalysisStore } from '@/stores/analysis-store'
import AnalysisPanel, {
  focusWorkflowStage,
} from '@/components/panels/analysis-panel'

const analysisPanelPath = join(
  process.cwd(),
  'src/components/panels/analysis-panel.tsx',
)
const workflowNavigatorPath = join(
  process.cwd(),
  'src/components/panels/analysis-workflow-navigator.tsx',
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

    expect(screen.getByTestId('workflow-navigator').textContent).toContain(
      'Guided workflow',
    )
    expect(
      screen.getByTestId('analysis-details').getAttribute('data-active-stage'),
    ).toBe('true')
    expect(screen.getByTestId('analysis-progress').textContent).toContain(
      '0 of 4 payoff cells complete',
    )
    expect(screen.getByTestId('analysis-status').textContent).toContain(
      '4 payoff cells still incomplete',
    )
    expect(screen.getByTestId('analysis-review').textContent).toContain(
      'Player 1: Strategy 1 vs Player 2: Strategy 1',
    )

    fireEvent.change(screen.getByLabelText('Player 1 name'), {
      target: { value: '   ' },
    })

    expect(screen.getByText('Player 1 name is required.')).not.toBeNull()
    expect(screen.getByTestId('analysis-status').textContent).toContain(
      '1 issue to fix',
    )
  })

  it('moves through selectable stages and keeps blocked stages disabled', () => {
    render(<AnalysisPanel />)

    fireEvent.click(
      screen.getByRole('button', { name: /Strategies stage/i }),
    )
    expect(
      screen
        .getByTestId('analysis-strategies')
        .getAttribute('data-active-stage'),
    ).toBe('true')
    expect(
      screen.getByTestId('analysis-details').getAttribute('data-active-stage'),
    ).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(
      screen.getByTestId('analysis-payoffs').getAttribute('data-active-stage'),
    ).toBe('true')

    const reviewStageButton = screen.getByRole('button', { name: /Review stage/i })
    const nextButton = screen.getByRole('button', { name: /Next/i })

    expect(reviewStageButton.getAttribute('disabled')).not.toBeNull()
    expect(nextButton.getAttribute('disabled')).not.toBeNull()

    fireEvent.click(reviewStageButton)
    expect(
      screen.getByTestId('analysis-payoffs').getAttribute('data-active-stage'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /Previous/i }))
    expect(
      screen
        .getByTestId('analysis-strategies')
        .getAttribute('data-active-stage'),
    ).toBe('true')
  })

  it('returns from a blocked persisted stage to the blocker', () => {
    const state = useAnalysisStore.getState()
    useAnalysisStore.setState({
      ...state,
      workflow: { currentStage: 'review' },
    })

    render(<AnalysisPanel />)

    expect(
      screen.getByTestId('analysis-review').getAttribute('data-active-stage'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /Return to blocker/i }))
    expect(
      screen.getByTestId('analysis-payoffs').getAttribute('data-active-stage'),
    ).toBe('true')
  })

  it('focuses the matching workflow section when it exists', () => {
    const section = document.createElement('section')
    section.id = 'analysis-strategies'
    const scrollIntoView = vi.fn()
    const focus = vi.fn()

    Object.defineProperty(section, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
    })
    Object.defineProperty(section, 'focus', {
      value: focus,
      configurable: true,
    })

    document.body.appendChild(section)

    focusWorkflowStage('strategies')

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    expect(focus).toHaveBeenCalledWith({
      preventScroll: true,
    })
  })

  it('updates the review progress when a payoff cell is completed', () => {
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

    expect(screen.getByTestId('analysis-progress').textContent).toContain(
      '1 of 4 payoff cells complete',
    )
    expect(screen.getByTestId('analysis-status').textContent).toContain(
      '3 payoff cells still incomplete',
    )
  })

  it('drops the old phase copy from the manual modeling panel', () => {
    const source = readFileSync(analysisPanelPath, 'utf8')

    expect(source).not.toContain(
      '1. Analysis details',
    )
    expect(source).not.toContain(
      '2. Player and strategy setup',
    )
    expect(source).not.toContain(
      '3. Payoff matrix entry',
    )
    expect(source).toContain('workflow-navigator')
    expect(source).toContain('data-active-stage')
    const navigatorSource = readFileSync(workflowNavigatorPath, 'utf8')
    expect(navigatorSource).toContain('Guided workflow')
    expect(navigatorSource).toContain('Return to blocker')
  })
})
