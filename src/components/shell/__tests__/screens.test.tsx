import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreProvider } from '../../../store'
import { PlatformProvider } from '../../../platform'
import { WelcomeScreen } from '../WelcomeScreen'
import { WorkflowBoard } from '../WorkflowBoard'
import { PlayersRegistry } from '../PlayersRegistry'
import { EvidenceLibrary } from '../EvidenceLibrary'

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <PlatformProvider>
      <StoreProvider>{ui}</StoreProvider>
    </PlatformProvider>,
  )
}

describe('WelcomeScreen', () => {
  it('renders action cards', () => {
    renderWithProviders(<WelcomeScreen />)
    expect(screen.getByText('CREATE NEW ANALYSIS')).toBeInTheDocument()
    expect(screen.getByText('OPEN FILE')).toBeInTheDocument()
    expect(screen.getByText('LOAD EXAMPLE')).toBeInTheDocument()
    expect(screen.getByText('CONNECT AI CLIENT')).toBeInTheDocument()
  })

  it('renders logo area', () => {
    renderWithProviders(<WelcomeScreen />)
    expect(screen.getByText('STRATEGIC LENS')).toBeInTheDocument()
    expect(screen.getByText('GAME THEORY ANALYSIS PLATFORM')).toBeInTheDocument()
  })

  it('renders version footer', () => {
    renderWithProviders(<WelcomeScreen />)
    expect(screen.getByText('v0.1.0 — LOCAL-FIRST ANALYSIS')).toBeInTheDocument()
  })
})

describe('WorkflowBoard', () => {
  it('renders column headers', () => {
    renderWithProviders(<WorkflowBoard />)
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
    expect(screen.getByText('MODELING')).toBeInTheDocument()
    expect(screen.getByText('FORMALIZED')).toBeInTheDocument()
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
  })

  it('renders board title and add button', () => {
    renderWithProviders(<WorkflowBoard />)
    expect(screen.getByText('ANALYSIS WORKFLOW')).toBeInTheDocument()
    expect(screen.getByText('ADD')).toBeInTheDocument()
  })
})

describe('PlayersRegistry', () => {
  it('renders title and add button', () => {
    renderWithProviders(<PlayersRegistry />)
    expect(screen.getByText('PLAYERS')).toBeInTheDocument()
    expect(screen.getByText('ADD PLAYER')).toBeInTheDocument()
  })

  it('renders empty state when no players', () => {
    renderWithProviders(<PlayersRegistry />)
    expect(screen.getByText('No players yet')).toBeInTheDocument()
  })
})

describe('EvidenceLibrary', () => {
  it('renders tab filter', () => {
    renderWithProviders(<EvidenceLibrary />)
    expect(screen.getByText('ALL')).toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
    expect(screen.getByText('CLAIMS')).toBeInTheDocument()
    expect(screen.getByText('ASSUMPTIONS')).toBeInTheDocument()
  })

  it('renders title and add button', () => {
    renderWithProviders(<EvidenceLibrary />)
    expect(screen.getByText('EVIDENCE LIBRARY')).toBeInTheDocument()
    expect(screen.getByText('ADD SOURCE')).toBeInTheDocument()
  })

  it('renders search input', () => {
    renderWithProviders(<EvidenceLibrary />)
    expect(screen.getByPlaceholderText('Search evidence...')).toBeInTheDocument()
  })
})
