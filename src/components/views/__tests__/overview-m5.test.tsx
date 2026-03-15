import { useEffect } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { PlatformProvider } from '../../../platform'
import {
  registerProposalGroup,
  resetConversationStore,
  resetMcpStore,
  resetPipelineStore,
  setMcpConnectionStatus,
  useAppStore,
} from '../../../store'
import { StoreProvider } from '../../../store'
import { OverviewScreen } from '../overview/OverviewScreen'

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <StoreProvider>{children}</StoreProvider>
    </PlatformProvider>
  )
}

function ProposalSeedHarness() {
  const eventLog = useAppStore((state) => state.eventLog)
  const sourceCount = useAppStore((state) => Object.keys(state.canonical.sources).length)

  useEffect(() => {
    registerProposalGroup({
      phase: 1,
      content: 'Review the proposed grounding evidence.',
      proposals: [
        {
          id: 'proposal_source',
          description: 'Add proposed source',
          phase: 1,
          phase_execution_id: 'phase_execution_1',
          base_revision: eventLog.persisted_revision,
          status: 'pending',
          commands: [
            {
              kind: 'add_source',
              id: 'source_m5_test',
              payload: {
                kind: 'manual',
                title: 'Test source',
                captured_at: new Date().toISOString(),
                quality_rating: 'high',
              },
            },
          ],
          entity_previews: [
            {
              entity_type: 'source',
              action: 'add',
              entity_id: 'source_m5_test',
              preview: { title: 'Test source' },
              accepted: false,
            },
          ],
          conflicts: [],
        },
      ],
    })
  // Seed once for the test store instance.
  }, [])

  return (
    <>
      <OverviewScreen />
      <div data-testid="source-count">{sourceCount}</div>
    </>
  )
}

function ManualModeHarness() {
  const setManualMode = useAppStore((state) => state.setManualMode)

  useEffect(() => {
    setManualMode(true)
  }, [setManualMode])

  return <OverviewScreen />
}

describe('M5 overview shell', () => {
  beforeEach(() => {
    resetConversationStore()
    resetPipelineStore()
    resetMcpStore()
  })

  it('shows no-client guidance when no MCP client is connected', () => {
    setMcpConnectionStatus({
      transport: 'stdio',
      connected: false,
      connected_at: null,
      last_activity: null,
    })

    render(
      <Providers>
        <OverviewScreen />
      </Providers>,
    )

    expect(screen.getByText(/No MCP client is connected/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run Next Phase/i })).toBeDisabled()
    expect(screen.getByText(/Start an analysis before running phases/i)).toBeInTheDocument()
  })

  it('accepts inline proposals and updates the canonical store through the command spine', async () => {
    setMcpConnectionStatus({
      transport: 'stdio',
      connected: true,
      client_name: 'Test Client',
      connected_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    })

    render(
      <Providers>
        <ProposalSeedHarness />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText('Add proposed source')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Accept'))

    await waitFor(() => expect(screen.getByTestId('source-count')).toHaveTextContent('1'))
  })

  it('hides the conversation composer in manual mode', async () => {
    render(
      <Providers>
        <ManualModeHarness />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByText(/Manual mode is active/i)).toBeInTheDocument())
    expect(screen.queryByText('Send')).not.toBeInTheDocument()
  })
})
