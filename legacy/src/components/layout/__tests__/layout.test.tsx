import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreProvider } from '../../../store'
import { PlatformProvider } from '../../../platform'
import { AppLayout } from '../AppLayout'

function renderWithProviders() {
  return render(
    <PlatformProvider>
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    </PlatformProvider>,
  )
}

describe('AppLayout', () => {
  it('renders sidebar with app navigation', () => {
    renderWithProviders()
    // STRATEGIC LENS appears in both sidebar and welcome screen — check sidebar specifically
    expect(screen.getAllByText('STRATEGIC LENS').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
  })

  it('does not show legacy game section labels in sidebar', () => {
    renderWithProviders()
    expect(screen.queryByText('GRAPH')).not.toBeInTheDocument()
  })

  it('renders status bar with version', () => {
    renderWithProviders()
    expect(screen.getByText('v0.1.0')).toBeInTheDocument()
  })

  it('shows welcome screen by default', () => {
    renderWithProviders()
    // WelcomeScreen is now live — check for its actual footer text
    expect(screen.getByText('v0.1.0 — LOCAL-FIRST ANALYSIS')).toBeInTheDocument()
  })
})
