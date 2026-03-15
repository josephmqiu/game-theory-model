import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button, Badge, ConfidenceBadge, StaleBadge, Card } from '../index'

describe('Design System', () => {
  it('renders primary button', () => {
    render(<Button variant="primary">Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders secondary button', () => {
    render(<Button variant="secondary">Cancel</Button>)
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders badge', () => {
    render(<Badge>ACTIVE</Badge>)
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('renders confidence badge with value', () => {
    render(<ConfidenceBadge value={0.85} />)
    expect(screen.getByText('0.85')).toBeInTheDocument()
  })

  it('renders stale badge', () => {
    render(<StaleBadge />)
    expect(screen.getByText('STALE')).toBeInTheDocument()
  })

  it('renders card with title and children', () => {
    render(<Card title="Test Card"><p>Content</p></Card>)
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
